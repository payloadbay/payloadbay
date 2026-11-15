import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry } from "./membership.ts";
import { assertGrantSubset, type Actor, type ScopeRef } from "./authorization.ts";
import { permissions as allPermissions, type Permission } from "../../contracts/src/permissions.ts";
import { AppError } from "../../contracts/src/errors.ts";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(
	pool: Pool,
	actor: Actor,
	input: {
		scope: ScopeRef;
		name: string;
		permissions: readonly Permission[];
		expiresAt: Date;
		workspaceIds?: readonly string[];
	},
) {
	if (!input.name.trim() || input.name.length > 100 || !Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now() || input.expiresAt.getTime() > Date.now() + 366 * 86400000) throw new AppError("invalid_input", 400, "Provide a name and future expiry within one year");

	return transaction(pool, async (db) => {
		const held = await requirePermission(db, actor, input.scope, "tokens.manage");
		assertGrantSubset(held, input.permissions);
		const workspaceIds = input.workspaceIds ? [...new Set(input.workspaceIds)] : null;
		if (workspaceIds) {
			if (input.scope.type !== "organization" || workspaceIds.length === 0 || workspaceIds.length > 200 || workspaceIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new AppError("invalid_input", 400, "Choose workspaces within the organization");
			const allowed = await db.query("SELECT id FROM payloadbay.workspace WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND archived_at IS NULL", [input.scope.id, workspaceIds]);
			if (allowed.rowCount !== workspaceIds.length) throw new AppError("invalid_input", 400, "Choose workspaces within the organization");
		}

		const secret = "pb_" + randomBytes(32).toString("base64url");
		const result = await db.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,name,permissions,hash,expires_at,workspace_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,permissions,expires_at,workspace_ids", [actor.userId, input.scope.type, input.scope.id, input.name.trim(), input.permissions, hash(secret), input.expiresAt, workspaceIds]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'token.created',$4)", [actor.userId, input.scope.type, input.scope.id, result.rows[0].id]);

		return { ...result.rows[0], secret };
	});
}

export async function authenticateToken(pool: Pool, secret: string): Promise<Actor | null> {
	if (!/^pb_[A-Za-z0-9_-]{43}$/.test(secret)) return null;
	const row = (await pool.query("SELECT id,user_id,scope_type,scope_id,permissions,personal FROM payloadbay.api_token WHERE hash=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()", [hash(secret)])).rows[0];
	if (!row) return null;
	const scope: ScopeRef = { type: row.scope_type, id: row.scope_id };
	try {
		const ancestry = await scopeAncestry(pool, scope);
		if (!(await pool.query("SELECT 1 FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active", [ancestry[0].id, row.user_id])).rowCount) return null;
	} catch (error) {
		if (error instanceof AppError && error.code === "not_found") return null;
		throw error;
	}

	return {
		userId: row.user_id,
		token: {
			id: row.id,
			scope,
			personal: row.personal,
			permissions: row.permissions,
		},
	};
}

export async function listTokens(pool: Pool, actor: Actor, scope: ScopeRef) {
	await requirePermission(pool, actor, scope, "tokens.manage");

	return (await pool.query("SELECT id,name,permissions,workspace_ids,expires_at,revoked_at,created_at FROM payloadbay.api_token WHERE user_id=$1 AND scope_type=$2 AND scope_id=$3 AND NOT personal ORDER BY created_at DESC LIMIT 200", [actor.userId, scope.type, scope.id])).rows;
}

export async function revokeToken(pool: Pool, actor: Actor, scope: ScopeRef, id: string) {
	return transaction(pool, async (db) => {
		await requirePermission(db, actor, scope, "tokens.manage");
		const row = await db.query("UPDATE payloadbay.api_token SET revoked_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND scope_type=$3 AND scope_id=$4 AND NOT personal AND revoked_at IS NULL RETURNING id", [id, actor.userId, scope.type, scope.id]);
		if (!row.rowCount) throw new AppError("not_found", 404, "Token unavailable");
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'token.revoked',$4)", [actor.userId, scope.type, scope.id, id]);
	});
}

async function personalAdmission(pool: Pool, actor: Actor) {
	if (actor.token) throw new AppError("forbidden", 403, "Manage personal keys through your signed-in account");
	const row = (await pool.query("SELECT installation_id FROM payloadbay.admission WHERE user_id=$1 AND active", [actor.userId])).rows[0];
	if (!row) throw new AppError("unauthenticated", 401, "Authentication required");

	return row.installation_id as string;
}

export async function createPersonalToken(pool: Pool, actor: Actor, input: { name: string; permissions: readonly Permission[]; expiresAt: Date }) {
	const installationId = await personalAdmission(pool, actor);
	if (!input.name.trim() || input.name.length > 100 || !Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now() || input.expiresAt.getTime() > Date.now() + 366 * 86400000 || input.permissions.some((permission) => !allPermissions.includes(permission))) throw new AppError("invalid_input", 400, "Provide a valid name, permissions and expiry within one year");
	const secret = "pb_" + randomBytes(32).toString("base64url");
	const result = await pool.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,personal,name,permissions,hash,expires_at) VALUES($1,'instance',$2,true,$3,$4,$5,$6) RETURNING id,name,permissions,expires_at,workspace_ids", [actor.userId, installationId, input.name.trim(), input.permissions, hash(secret), input.expiresAt]);

	return { ...result.rows[0], secret };
}

export async function listPersonalTokens(pool: Pool, actor: Actor) {
	await personalAdmission(pool, actor);

	return (await pool.query("SELECT id,name,permissions,workspace_ids,expires_at,revoked_at,created_at FROM payloadbay.api_token WHERE user_id=$1 AND personal ORDER BY created_at DESC LIMIT 200", [actor.userId])).rows;
}

export async function revokePersonalToken(pool: Pool, actor: Actor, id: string) {
	await personalAdmission(pool, actor);
	const row = await pool.query("UPDATE payloadbay.api_token SET revoked_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND personal AND revoked_at IS NULL RETURNING id", [id, actor.userId]);
	if (!row.rowCount) throw new AppError("not_found", 404, "Key unavailable");
}
