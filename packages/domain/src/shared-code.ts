import type { Pool, PoolClient } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry, actorPermissions } from "./membership.ts";
import type { Actor, ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";

type Compiler = (input: unknown) => ReturnType<typeof compile>;

function metadata(row: Record<string, unknown>) {
	return {
		id: row.id as string,
		name: row.name as string,
		scope: { type: row.scope_type as ScopeRef["type"], id: row.scope_id as string },
		sourceDigest: row.source_digest as string,
		bundleDigest: row.bundle_digest as string,
		originRevisionId: row.origin_revision_id as string | null,
		createdAt: row.created_at as Date,
	};
}

export async function getSharedVersion(db: Pool | PoolClient, actor: Actor, id: string) {
	const row = (await db.query("SELECT * FROM payloadbay.shared_module_revision WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Shared code unavailable");
	await requirePermission(db, actor, { type: row.scope_type, id: row.scope_id }, "code.read");

	return { ...metadata(row), source: row.source as string };
}

export async function createSharedVersion(
	pool: Pool,
	actor: Actor,
	input: {
		scope: ScopeRef;
		name: string;
		source: string;
		originRevisionId?: string;
		compile: Compiler;
	},
) {
	if (!/^[A-Za-z_$][\w$]{0,99}$/.test(input.name) || !input.source.trim() || Buffer.byteLength(input.source) > 131072) throw new AppError("invalid_shared_code", 400, "Choose an identifier and a source module within 128 KiB");

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, input.scope, "code.edit");
		if (input.originRevisionId) await getSharedVersion(db, actor, input.originRevisionId);
		const id = randomUUID();
		const compiled = await input.compile({
			stage: "processing",
			sourceId: "shared-validation",
			body: 'ctx.log.info("Registered exports",{names:Object.keys(Module)});return ctx.complete();',
			sharedModules: { Module: { source: input.source, revisionId: id } },
		});
		const row = (await db.query("INSERT INTO payloadbay.shared_module_revision(id,scope_type,scope_id,name,source,source_digest,bundle_digest,origin_revision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [id, input.scope.type, input.scope.id, input.name, input.source, createHash("sha256").update(input.source).digest("hex"), compiled.bundleDigest, input.originRevisionId ?? null])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'shared.version_created',$4,$5)", [actor.userId, input.scope.type, input.scope.id, id, JSON.stringify({ name: input.name, originRevisionId: input.originRevisionId ?? null })]);
		await appendChange(db, {
			scope: input.scope,
			kind: "configuration.changed",
			resourceId: id,
			capability: "code.read",
		});

		return { ...metadata(row), source: row.source as string };
	});
}

export async function copySharedVersion(
	pool: Pool,
	actor: Actor,
	input: {
		id: string;
		scope: ScopeRef;
		name?: string;
		compile: Compiler;
	},
) {
	const origin = await getSharedVersion(pool, actor, input.id);

	return createSharedVersion(pool, actor, {
		scope: input.scope,
		name: input.name ?? origin.name,
		source: origin.source,
		originRevisionId: origin.id,
		compile: input.compile,
	});
}

export async function resolveSharedModules(db: Pool | PoolClient, actor: Actor, scope: ScopeRef, bindings: Record<string, string>) {
	const ancestry = await scopeAncestry(db, scope);
	const modules: Record<string, { source: string; revisionId: string }> = Object.create(null);
	let bytes = 0;
	if (Object.keys(bindings).length > 32) throw new AppError("shared_code_limit", 413, "At most 32 shared code bindings are supported");
	for (const [name, id] of Object.entries(bindings)) {
		if (!/^[A-Za-z_$][\w$]*$/.test(name) || name === "ctx") throw new AppError("invalid_shared_binding", 400, "Choose a valid shared code binding");
		const version = await getSharedVersion(db, actor, id);
		if (!ancestry.some((parent) => parent.type === version.scope.type && parent.id === version.scope.id)) throw new AppError("invalid_shared_binding", 400, "Shared code is outside this route scope");
		bytes += Buffer.byteLength(version.source);
		if (bytes > 524288) throw new AppError("shared_code_limit", 413, "Shared dependencies exceed 512 KiB");
		modules[name] = { source: version.source, revisionId: version.id };
	}

	return modules;
}

export async function listSharedVersions(pool: Pool, actor: Actor, scope: ScopeRef) {
	await requirePermission(pool, actor, scope, "code.read");
	const ancestry = await scopeAncestry(pool, scope);
	const allowed: ScopeRef[] = [];
	const first = actor.token ? ancestry.findIndex((parent) => parent.type === actor.token!.scope.type && parent.id === actor.token!.scope.id) : 0;
	for (const parent of ancestry.slice(first)) if ((await actorPermissions(pool, actor, parent)).has("code.read")) allowed.push(parent);
	const parameters: string[] = [];
	const clauses = allowed.map((parent) => {
		parameters.push(parent.type, parent.id);

		return `(scope_type=$${parameters.length - 1} AND scope_id=$${parameters.length}::uuid)`;
	});

	return (await pool.query("SELECT id,name,scope_type,scope_id,source_digest,bundle_digest,origin_revision_id,created_at FROM payloadbay.shared_module_revision WHERE " + clauses.join(" OR ") + " ORDER BY created_at DESC,id DESC LIMIT 200", parameters)).rows.map(metadata);
}
