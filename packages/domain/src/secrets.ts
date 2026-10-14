import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { requirePermission, scopeAncestry, actorPermissions } from "./membership.ts";
import type { Actor, ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function createSecret(pool: Pool, actor: Actor, input: { scope: ScopeRef; name: string; value: string }, key: string) {
	if (!input.name.trim() || input.name.length > 100 || /[\x00-\x1f]/.test(input.name) || !input.value || Buffer.byteLength(input.value) > 8192) throw new AppError("invalid_input", 400, "Provide a secret name and value within 8 KiB");

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, input.scope, "secrets.manage");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["secret:" + input.scope.type + ":" + input.scope.id + ":" + input.name.trim()]);
		const next = (await db.query("SELECT COALESCE(max(version),0)+1 AS version FROM payloadbay.secret_version WHERE scope_type=$1 AND scope_id=$2 AND name=$3", [input.scope.type, input.scope.id, input.name.trim()])).rows[0].version;
		const created = (await db.query("INSERT INTO payloadbay.secret_version(scope_type,scope_id,name,version,encrypted_value,key_id) VALUES($1,$2,$3,$4,$5,'v1') RETURNING id,name,version,key_id,revoked_at", [input.scope.type, input.scope.id, input.name.trim(), next, encryptPrivate({ value: input.value }, key)])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'secret.version_created',$4,$5)", [actor.userId, input.scope.type, input.scope.id, created.id, JSON.stringify({ name: created.name, version: created.version })]);

		return created;
	});
}

export async function secretForUse(db: Pool | PoolClient, actor: Actor, id: string) {
	const row = (await db.query("SELECT * FROM payloadbay.secret_version WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("secret_unavailable", 409, "Secret version unavailable");
	await requirePermission(db, actor, { type: row.scope_type, id: row.scope_id }, "secrets.use");
	if (row.revoked_at) throw new AppError("secret_revoked", 409, "Secret version has been revoked");

	return row;
}

export async function resolveSecret(pool: Pool, actor: Actor, id: string, key: string) {
	const row = await secretForUse(pool, actor, id);

	return decryptPrivate<{ value: string }>(row.encrypted_value, key).value;
}

export async function revokeSecret(pool: Pool, actor: Actor, id: string) {
	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT id,scope_type,scope_id FROM payloadbay.secret_version WHERE id=$1 FOR UPDATE", [id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Secret version unavailable");
		await requirePermission(db, actor, { type: row.scope_type, id: row.scope_id }, "secrets.manage");
		await db.query("UPDATE payloadbay.secret_version SET revoked_at=clock_timestamp() WHERE id=$1 AND revoked_at IS NULL", [id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'secret.revoked',$4)", [actor.userId, row.scope_type, row.scope_id, id]);
	});
}

export async function resolvePinnedSecrets(db: Pool | PoolClient, projectId: string, bindings: Record<string, string>, key: string) {
	const ancestry = await scopeAncestry(db, { type: "project", id: projectId });
	const values: Record<string, string> = Object.create(null);
	let bytes = 0;
	for (const [name, id] of Object.entries(bindings)) {
		const row = (await db.query("SELECT * FROM payloadbay.secret_version WHERE id=$1", [id])).rows[0];
		if (!row || !ancestry.some((s) => s.type === row.scope_type && s.id === row.scope_id)) throw new AppError("secret_unavailable", 409, "Pinned secret unavailable");
		if (row.revoked_at) throw new AppError("secret_revoked", 409, "Pinned secret has been revoked");
		values[name] = decryptPrivate<{ value: string }>(row.encrypted_value, key).value;
		bytes += Buffer.byteLength(values[name]);
		if (bytes > 65536) throw new AppError("secret_limit", 413, "Secret bindings exceed 64 KiB");
	}

	return values;
}

export async function listSecrets(pool: Pool, actor: Actor, scope: ScopeRef) {
	const held = await actorPermissions(pool, actor, scope);
	if (!held.has("secrets.manage") && !held.has("secrets.use")) throw new AppError("forbidden", 403, "You do not have access to these secrets");
	const ancestors = await scopeAncestry(pool, scope);
	const allowed: ScopeRef[] = [];
	const first = actor.token ? ancestors.findIndex((s) => s.type === actor.token!.scope.type && s.id === actor.token!.scope.id) : 0;
	for (const ancestor of ancestors.slice(first)) {
		const rights = await actorPermissions(pool, actor, ancestor);
		if (rights.has("secrets.manage") || rights.has("secrets.use")) allowed.push(ancestor);
	}

	const parameters: string[] = [];
	const clauses = allowed.map((ancestor) => {
		parameters.push(ancestor.type, ancestor.id);

		return `(scope_type=$${parameters.length - 1} AND scope_id=$${parameters.length}::uuid)`;
	});

	return (await pool.query("SELECT id,scope_type,scope_id,name,version,key_id,revoked_at FROM payloadbay.secret_version WHERE " + clauses.join(" OR ") + " ORDER BY name,version DESC,id LIMIT 200", parameters)).rows;
}
