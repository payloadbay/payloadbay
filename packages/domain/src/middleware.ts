import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry } from "./membership.ts";
import type { Actor, ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";
import { resolveSharedModules, pinSourceImports } from "./shared-code.ts";
import { secretForUse } from "./secrets.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";
import type { PinnedMiddleware } from "./pipeline.ts";

export type MiddlewareScope = ScopeRef | { type: "endpoint"; id: string };
type Compiler = (input: unknown) => ReturnType<typeof compile>;

const rank = {
	instance: 0,
	workspace: 1,
	project: 2,
	endpoint: 3,
};

export async function middlewareActorScope(db: Pool | PoolClient, scope: MiddlewareScope): Promise<ScopeRef> {
	if (scope.type !== "endpoint") return scope;
	const row = (await db.query("SELECT project_id FROM payloadbay.endpoint WHERE id=$1", [scope.id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Ingress route unavailable");

	return { type: "project", id: row.project_id };
}

export async function middlewareScopes(db: Pool | PoolClient, scope: MiddlewareScope): Promise<MiddlewareScope[]> {
	const actorScope = await middlewareActorScope(db, scope);
	const ancestors = await scopeAncestry(db, actorScope);

	return scope.type === "endpoint" ? [...ancestors, scope] : ancestors;
}

export type BindingInput = {
	scope: MiddlewareScope;
	stage: "ingress" | "processing";
	name: string;
	body: string;
	position: number;
	failurePolicy: "required" | "optional";
	overridePolicy: "allowed" | "forbidden";
	requiredAction?: "retry" | "fail";
	originBindingId?: string;
	sharedBindings?: Record<string, string>;
	secretBindings?: Record<string, string>;
	compile: Compiler;
};

async function compileBinding(db: PoolClient, actor: Actor, input: BindingInput) {
	const domainScope = await middlewareActorScope(db, input.scope);
	await requirePermission(db, actor, domainScope, "code.edit");
	await requirePermission(db, actor, domainScope, "code.publish");
	const ancestry = await scopeAncestry(db, domainScope);
	const secrets: Record<string, string> = Object.create(null);
	if (!input.name.trim() || input.name.length > 100 || !Number.isInteger(input.position) || input.position < 0 || input.position > 10000 || Buffer.byteLength(input.body) > 131072) throw new AppError("invalid_middleware", 400, "Provide a middleware name, position and bounded body");
	for (const [name, id] of Object.entries(input.secretBindings ?? {})) {
		if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(name)) throw new AppError("invalid_secret_binding", 400, "Choose a secret binding name");
		const secret = await secretForUse(db, actor, id);
		if (!ancestry.some((parent) => parent.type === secret.scope_type && parent.id === secret.scope_id)) throw new AppError("invalid_secret_binding", 400, "Secret is outside middleware scope");
		secrets[name] = id;
	}

	const bindings = /^\s*(?:import|export)\s/m.test(input.body) ? await pinSourceImports(db, actor, domainScope, input.body, input.sharedBindings) : (input.sharedBindings ?? {});
	const sharedModules = await resolveSharedModules(db, actor, domainScope, bindings);
	const compiled = await input.compile({
		stage: input.stage + "_middleware",
		body: input.body,
		sourceId: input.stage + "-middleware",
		sharedModules,
	});
	const revision = (await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [compiled.stage, compiled.body, compiled.bodyDigest, compiled.sdkVersion, compiled.bundle, compiled.bundleDigest, JSON.stringify(compiled.sourceMap)])).rows[0].id;

	return {
		revision,
		manifest: {
			modules: compiled.sharedVersions,
			secrets,
			sdkVersion: compiled.sdkVersion,
			compatibilityDate: compiled.compatibilityDate,
			compatibilityFlags: compiled.compatibilityFlags,
		},
		domainScope,
	};
}

function publicBinding(row: Record<string, unknown>, editable: boolean) {
	return {
		id: row.id as string,
		name: row.name as string,
		scope: { type: row.scope_type as MiddlewareScope["type"], id: row.scope_id as string },
		stage: row.stage as "ingress" | "processing",
		position: row.position as number,
		failurePolicy: row.failure_policy as "required" | "optional",
		overridePolicy: row.override_policy as "allowed" | "forbidden",
		requiredAction: row.required_action as "retry" | "fail",
		originBindingId: row.origin_binding_id as string | null,
		revisionId: row.code_revision_id as string,
		version: row.version as number,
		enabled: row.enabled as boolean,
		editable,
	};
}

async function checkOrigin(db: PoolClient, actor: Actor, scope: MiddlewareScope, id: string, stage: string) {
	const row = (await db.query("SELECT * FROM payloadbay.middleware_binding WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Origin middleware unavailable");
	await requirePermission(db, actor, await middlewareActorScope(db, { type: row.scope_type, id: row.scope_id }), "code.read");
	const ancestry = await middlewareScopes(db, scope);
	if (!ancestry.some((parent) => parent.type === row.scope_type && parent.id === row.scope_id) || row.stage !== stage) throw new AppError("invalid_middleware_origin", 400, "Origin must belong to the same stage and ancestor scope");
	if (rank[row.scope_type as MiddlewareScope["type"]] < rank[scope.type] && row.override_policy === "forbidden") throw new AppError("middleware_override_forbidden", 403, "Parent middleware does not allow child overrides");

	return row;
}

export async function createMiddlewareBinding(pool: Pool, actor: Actor, input: BindingInput) {
	return transaction(pool, async (db) => {
		const domainScope = await middlewareActorScope(db, input.scope);
		await requirePermission(db, actor, domainScope, "code.publish");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["middleware:" + input.scope.type + ":" + input.scope.id]);
		if (input.originBindingId) await checkOrigin(db, actor, input.scope, input.originBindingId, input.stage);
		const { revision, manifest } = await compileBinding(db, actor, input);
		const row = (
			await db.query("INSERT INTO payloadbay.middleware_binding(scope_type,scope_id,code_revision_id,stage,position,failure_policy,override_policy,origin_binding_id,name,required_action,compiled_manifest,shared_bindings,secret_bindings) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *", [
				input.scope.type,
				input.scope.id,
				revision,
				input.stage,
				input.position,
				input.failurePolicy,
				input.overridePolicy,
				input.originBindingId ?? null,
				input.name.trim(),
				input.requiredAction ?? "retry",
				JSON.stringify(manifest),
				JSON.stringify(input.sharedBindings ?? {}),
				JSON.stringify(input.secretBindings ?? {}),
			])
		).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'middleware.created',$4)", [actor.userId, domainScope.type, domainScope.id, row.id]);
		await appendChange(db, {
			scope: domainScope,
			kind: "configuration.changed",
			resourceId: row.id,
			capability: "code.read",
		});

		return publicBinding(row, true);
	});
}

export async function middlewareSnapshot(db: PoolClient, endpointId: string): Promise<PinnedMiddleware[]> {
	const scopes = await middlewareScopes(db, { type: "endpoint", id: endpointId });
	for (const scope of scopes) await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["middleware:" + scope.type + ":" + scope.id]);
	const rows = (await db.query("SELECT b.*,r.bundle,r.sdk_version FROM payloadbay.middleware_binding b JOIN payloadbay.stage_revision r ON r.id=b.code_revision_id WHERE b.scope_id=ANY($1::uuid[]) AND b.enabled", [scopes.map((scope) => scope.id)])).rows.filter((row) => scopes.some((scope) => scope.type === row.scope_type && scope.id === row.scope_id));
	const selected = new Map<string, (typeof rows)[number]>();
	for (const row of rows.sort((a, b) => rank[a.scope_type as MiddlewareScope["type"]] - rank[b.scope_type as MiddlewareScope["type"]] || a.position - b.position || a.id.localeCompare(b.id))) {
		let origin = row;
		const visited = new Set<string>();
		while (origin.origin_binding_id) {
			if (visited.size >= 32 || visited.has(origin.id)) throw new AppError("middleware_origin_cycle", 409, "Middleware origin chain is invalid");
			visited.add(origin.id);
			const parent = (await db.query("SELECT * FROM payloadbay.middleware_binding WHERE id=$1", [origin.origin_binding_id])).rows[0];
			if (!parent || parent.stage !== row.stage || !scopes.some((scope) => scope.type === parent.scope_type && scope.id === parent.scope_id) || rank[parent.scope_type as MiddlewareScope["type"]] > rank[row.scope_type as MiddlewareScope["type"]]) throw new AppError("invalid_middleware_origin", 409, "Middleware origin is outside the effective scope");
			if (rank[parent.scope_type as MiddlewareScope["type"]] < rank[row.scope_type as MiddlewareScope["type"]] && parent.override_policy === "forbidden") throw new AppError("middleware_override_forbidden", 409, "Parent middleware no longer allows this override");
			origin = parent;
		}

		const family = origin.id;
		const current = selected.get(family);
		if (current && current.id !== row.id && rank[current.scope_type as MiddlewareScope["type"]] < rank[row.scope_type as MiddlewareScope["type"]] && current.override_policy === "forbidden") throw new AppError("middleware_override_forbidden", 409, "Effective parent middleware cannot be overridden");
		if (!current || rank[current.scope_type as MiddlewareScope["type"]] < rank[row.scope_type as MiddlewareScope["type"]] || visited.has(current.id)) selected.set(family, row);
		else if (rank[current.scope_type as MiddlewareScope["type"]] === rank[row.scope_type as MiddlewareScope["type"]] && !current.origin_binding_id) selected.set(family, row);
	}

	return [...selected.values()]
		.sort((a, b) => rank[a.scope_type as MiddlewareScope["type"]] - rank[b.scope_type as MiddlewareScope["type"]] || a.position - b.position || a.id.localeCompare(b.id))
		.map((row) => ({
			id: row.id,
			scopeType: row.scope_type,
			scopeId: row.scope_id,
			stage: row.stage,
			position: row.position,
			revisionId: row.code_revision_id,
			bundle: row.bundle,
			failurePolicy: row.failure_policy,
			requiredAction: row.required_action,
			version: row.version,
			originBindingId: row.origin_binding_id,
			secretBindings: row.compiled_manifest.secrets ?? {},
			manifest: row.compiled_manifest,
		}));
}

export async function getMiddlewareBinding(pool: Pool, actor: Actor, id: string) {
	const row = (await pool.query("SELECT b.*,r.body FROM payloadbay.middleware_binding b JOIN payloadbay.stage_revision r ON r.id=b.code_revision_id WHERE b.id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Middleware unavailable");
	await requirePermission(pool, actor, await middlewareActorScope(pool, { type: row.scope_type, id: row.scope_id }), "code.read");

	return {
		...publicBinding(row, true),
		body: row.body as string,
		sharedBindings: row.shared_bindings as Record<string, string>,
		secretBindings: row.secret_bindings as Record<string, string>,
	};
}

export async function updateMiddlewareBinding(
	pool: Pool,
	actor: Actor,
	input: {
		id: string;
		expectedVersion: number;
		name?: string;
		body?: string;
		position?: number;
		failurePolicy?: "required" | "optional";
		overridePolicy?: "allowed" | "forbidden";
		requiredAction?: "retry" | "fail";
		enabled?: boolean;
		sharedBindings?: Record<string, string>;
		secretBindings?: Record<string, string>;
		compile: Compiler;
	},
) {
	return transaction(pool, async (db) => {
		const previous = (await db.query("SELECT * FROM payloadbay.middleware_binding WHERE id=$1", [input.id])).rows[0];
		if (!previous) throw new AppError("not_found", 404, "Middleware unavailable");
		const scope: MiddlewareScope = { type: previous.scope_type, id: previous.scope_id };
		const domainScope = await middlewareActorScope(db, scope);
		await requirePermission(db, actor, domainScope, "code.edit");
		await requirePermission(db, actor, domainScope, "code.publish");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["middleware:" + scope.type + ":" + scope.id]);
		const row = (await db.query("SELECT b.*,r.body FROM payloadbay.middleware_binding b JOIN payloadbay.stage_revision r ON r.id=b.code_revision_id WHERE b.id=$1 FOR UPDATE OF b", [input.id])).rows[0];
		if (row.version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Middleware changed; reload before saving");
		const next: BindingInput = {
			scope,
			stage: row.stage,
			name: input.name ?? row.name,
			body: input.body ?? row.body,
			position: input.position ?? row.position,
			failurePolicy: input.failurePolicy ?? row.failure_policy,
			overridePolicy: input.overridePolicy ?? row.override_policy,
			requiredAction: input.requiredAction ?? row.required_action,
			sharedBindings: input.sharedBindings ?? row.shared_bindings,
			secretBindings: input.secretBindings ?? row.secret_bindings,
			compile: input.compile,
		};
		const { revision, manifest } = await compileBinding(db, actor, next);
		const updated = (
			await db.query("UPDATE payloadbay.middleware_binding SET name=$2,code_revision_id=$3,position=$4,failure_policy=$5,override_policy=$6,required_action=$7,compiled_manifest=$8,shared_bindings=$9,secret_bindings=$10,enabled=$11,version=version+1 WHERE id=$1 RETURNING *", [
				row.id,
				next.name.trim(),
				revision,
				next.position,
				next.failurePolicy,
				next.overridePolicy,
				next.requiredAction,
				JSON.stringify(manifest),
				JSON.stringify(next.sharedBindings),
				JSON.stringify(next.secretBindings),
				input.enabled ?? row.enabled,
			])
		).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'middleware.updated',$4,$5)", [actor.userId, domainScope.type, domainScope.id, row.id, JSON.stringify({ fromVersion: row.version, toVersion: updated.version })]);
		await appendChange(db, {
			scope: domainScope,
			kind: "configuration.changed",
			resourceId: row.id,
			capability: "code.read",
		});

		return publicBinding(updated, true);
	});
}

export async function listMiddlewareBindings(pool: Pool, actor: Actor, scope: MiddlewareScope) {
	const domainScope = await middlewareActorScope(pool, scope);
	const held = await requirePermission(pool, actor, domainScope, "code.read");
	const scopes = await middlewareScopes(pool, scope);
	const rows = (await pool.query("SELECT * FROM payloadbay.middleware_binding WHERE scope_id=ANY($1::uuid[]) ORDER BY position,id LIMIT 200", [scopes.map((parent) => parent.id)])).rows.filter((row) => scopes.some((parent) => parent.type === row.scope_type && parent.id === row.scope_id));

	return rows.sort((a, b) => rank[a.scope_type as MiddlewareScope["type"]] - rank[b.scope_type as MiddlewareScope["type"]] || a.position - b.position || a.id.localeCompare(b.id)).map((row) => publicBinding(row, row.scope_type === scope.type && row.scope_id === scope.id && held.has("code.edit") && held.has("code.publish")));
}

/** Reorder one scope/stage atomically; parent chains and published snapshots stay unchanged. */
export async function reorderMiddlewareBindings(
	pool: Pool,
	actor: Actor,
	input: {
		scope: MiddlewareScope;
		stage: "ingress" | "processing";
		items: { id: string; version: number }[];
	},
) {
	if (!input.items.length || input.items.length > 200 || new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new AppError("invalid_order", 400, "Choose each local middleware once");

	return transaction(pool, async (db) => {
		const domainScope = await middlewareActorScope(db, input.scope);
		await requirePermission(db, actor, domainScope, "code.edit");
		await requirePermission(db, actor, domainScope, "code.publish");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["middleware:" + input.scope.type + ":" + input.scope.id]);
		const rows = (await db.query("SELECT id,version FROM payloadbay.middleware_binding WHERE scope_type=$1 AND scope_id=$2 AND stage=$3 ORDER BY id FOR UPDATE", [input.scope.type, input.scope.id, input.stage])).rows;
		if (rows.length !== input.items.length || input.items.some((item) => !rows.some((row) => row.id === item.id && row.version === item.version))) throw new AppError("version_conflict", 409, "Middleware changed; reload before reordering");
		for (const [position, item] of input.items.entries()) await db.query("UPDATE payloadbay.middleware_binding SET position=$2,version=version+1 WHERE id=$1", [item.id, position]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3::uuid,'middleware.reordered',$3::text,$4)", [actor.userId, domainScope.type, domainScope.id, JSON.stringify({ stage: input.stage, ids: input.items.map((item) => item.id) })]);
		await appendChange(db, {
			scope: domainScope,
			kind: "configuration.changed",
			resourceId: input.scope.id,
			capability: "code.read",
		});

		return { reordered: input.items.length };
	});
}
