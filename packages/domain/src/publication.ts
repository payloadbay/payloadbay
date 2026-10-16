import { resolveSharedModules, pinSourceImports } from "./shared-code.ts";
import { middlewareSnapshot } from "./middleware.ts";
import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { secretForUse } from "./secrets.ts";
import { AppError } from "../../contracts/src/errors.ts";

type Stage = "ingress" | "processing";

async function endpointScope(db: Pool | PoolClient, id: string) {
	const row = (await db.query("SELECT * FROM payloadbay.endpoint WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Ingress route unavailable");

	return row;
}

export async function saveDraft(
	pool: Pool,
	actor: Actor,
	input: {
		endpointId: string;
		stage: Stage;
		body: string;
		sharedBindings?: Record<string, string>;
		secretBindings?: Record<string, string>;
		expectedVersion: number;
	},
) {
	if (Buffer.byteLength(input.body) > 131072) throw new AppError("body_too_large", 413, "Script body is too large");

	return transaction(pool, async (db) => {
		const endpoint = await endpointScope(db, input.endpointId);
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "code.edit");
		await db.query("SELECT id FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [endpoint.id]);
		const current = (await db.query("SELECT * FROM payloadbay.draft WHERE endpoint_id=$1 AND stage=$2", [endpoint.id, input.stage])).rows[0];
		if (!current || current.version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Draft changed; reload before saving");
		const existing = input.sharedBindings ?? current.shared_bindings;
		const sourceFile = /^\s*(?:import|export)\s/m.test(input.body);
		const bindings = sourceFile ? await pinSourceImports(db, actor, { type: "project", id: endpoint.project_id }, input.body, existing) : existing;
		const row = (await db.query("UPDATE payloadbay.draft SET body=$1,shared_bindings=COALESCE($2::jsonb,shared_bindings),secret_bindings=COALESCE($6::jsonb,secret_bindings),version=version+1 WHERE endpoint_id=$3 AND stage=$4 AND version=$5 RETURNING *", [input.body, JSON.stringify(bindings), endpoint.id, input.stage, input.expectedVersion, input.secretBindings === undefined ? null : JSON.stringify(input.secretBindings)])).rows[0];
		if (!row) throw new AppError("version_conflict", 409, "Draft changed; reload before saving");

		return row;
	});
}

import { createHash } from "node:crypto";
import { scopeAncestry } from "./membership.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";

type Compiler = (input: unknown) => ReturnType<typeof compile>;

export async function publish(
	pool: Pool,
	actor: Actor,
	input: {
		endpointId: string;
		expectedVersion: number;
		draftVersions: { ingress: number; processing: number };
		compile: Compiler;
	},
) {
	return transaction(pool, async (db) => {
		const endpoint = await endpointScope(db, input.endpointId);
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "code.publish");
		const locked = (await db.query("SELECT * FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [endpoint.id])).rows[0];
		if (locked.config_version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Ingress route changed; reload before publishing");
		const drafts = (await db.query("SELECT * FROM payloadbay.draft WHERE endpoint_id=$1 ORDER BY stage FOR UPDATE", [endpoint.id])).rows;
		if (drafts.length !== 2 || drafts.some((d) => d.version !== input.draftVersions[d.stage as Stage])) throw new AppError("version_conflict", 409, "Draft changed; reload before publishing");
		const ancestry = await scopeAncestry(db, { type: "project", id: endpoint.project_id });
		const middleware = await middlewareSnapshot(db, endpoint.id);
		const compiled = [];
		const secretBindings: Record<string, Record<string, string>> = {};
		for (const draft of drafts) {
			const sharedModules = await resolveSharedModules(db, actor, { type: "project", id: endpoint.project_id }, draft.shared_bindings);
			const bound: Record<string, string> = Object.create(null);
			for (const [name, id] of Object.entries(draft.secret_bindings as Record<string, string>)) {
				if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(name)) throw new AppError("invalid_secret_binding", 400, "Choose a valid secret binding name");
				const secret = await secretForUse(db, actor, id);
				if (!ancestry.some((scope) => scope.type === secret.scope_type && scope.id === secret.scope_id)) throw new AppError("invalid_secret_binding", 400, "Secret is outside this route scope");
				bound[name] = secret.id;
			}

			secretBindings[draft.stage] = bound;

			compiled.push(
				await input.compile({
					stage: draft.stage,
					body: draft.body,
					sourceId: draft.stage,
					sharedModules,
				}),
			);
		}

		const revisions: Record<string, string> = {};
		for (const result of compiled) {
			const revision = (await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [result.stage, result.body, result.bodyDigest, result.sdkVersion, result.bundle, result.bundleDigest, JSON.stringify(result.sourceMap)])).rows[0];
			revisions[result.stage] = revision.id;
		}

		const destinations = (await db.query("SELECT * FROM payloadbay.destination WHERE project_id=$1 ORDER BY id", [endpoint.project_id])).rows;
		const destinationSnapshot = Object.fromEntries(
			destinations.map((d) => [
				d.id,
				{
					id: d.id,
					name: d.name,
					isDefault: d.is_default,
					httpConfig: d.http_config,
					secretRefs: d.secret_refs,
					concurrency: d.concurrency,
					version: d.version,
				},
			]),
		);
		const sharedVersions = Object.fromEntries(
			compiled.map((result) => [
				result.stage,
				{
					modules: result.sharedVersions,
					secrets: secretBindings[result.stage],
					sdkVersion: result.sdkVersion,
					compatibilityDate: result.compatibilityDate,
					compatibilityFlags: result.compatibilityFlags,
				},
			]),
		);
		const digest = createHash("sha256")
			.update(
				JSON.stringify({
					revisions,
					sharedVersions,
					destinationSnapshot,
					middleware,
				}),
			)
			.digest("hex");
		const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,shared_versions,destination_snapshot,dependency_digest,created_by,effective_bindings) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [endpoint.id, revisions.ingress, revisions.processing, JSON.stringify(sharedVersions), JSON.stringify(destinationSnapshot), digest, actor.userId, JSON.stringify(middleware)])).rows[0];
		await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1,config_version=config_version+1 WHERE id=$2", [publication.id, endpoint.id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'code.published',$3)", [actor.userId, endpoint.project_id, publication.id]);

		return { id: publication.id, version: locked.config_version + 1 };
	});
}

export async function activatePublication(pool: Pool, actor: Actor, input: { endpointId: string; publicationId: string; expectedVersion: number }) {
	return transaction(pool, async (db) => {
		const endpoint = await endpointScope(db, input.endpointId);
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "code.publish");
		const locked = (await db.query("SELECT * FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [endpoint.id])).rows[0];
		if (locked.config_version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Ingress route changed; reload before rollback");
		const recorded = (await db.query("SELECT * FROM payloadbay.publication WHERE id=$1 AND endpoint_id=$2", [input.publicationId, endpoint.id])).rows[0];
		if (!recorded) throw new AppError("not_found", 404, "Publication unavailable");
		for (const stage of ["ingress", "processing"]) if (recorded.shared_versions[stage]?.sdkVersion !== "1") throw new AppError("unsupported_publication", 409, "Publication requires an unsupported script SDK");
		await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1,config_version=config_version+1 WHERE id=$2", [recorded.id, endpoint.id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'code.rolled_back',$3,$4)", [actor.userId, endpoint.project_id, recorded.id, JSON.stringify({ from: locked.active_publication_id, to: recorded.id })]);

		return { id: recorded.id, version: locked.config_version + 1 };
	});
}
