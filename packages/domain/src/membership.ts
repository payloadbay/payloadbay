import { transaction } from "./db.ts";
import type { Pool, PoolClient } from "pg";
import { previewReviewerEmail } from "./preview.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { permissions, type Permission } from "../../contracts/src/permissions.ts";
import { effectivePermissions, assertGrantSubset, rolePermissions, type ScopeRef, type Actor } from "./authorization.ts";

export async function scopeAncestry(db: Pool | PoolClient, scope: ScopeRef): Promise<ScopeRef[]> {
	if (scope.type === "instance") {
		const result = await db.query("SELECT id FROM payloadbay.installation WHERE id=$1 AND bootstrap_state='complete'", [scope.id]);
		if (!result.rowCount) throw new AppError("not_found", 404, "Resource unavailable");

		return [scope];
	}

	if (scope.type === "organization") {
		const result = (await db.query("SELECT o.installation_id FROM payloadbay.organization o JOIN payloadbay.installation i ON i.id=o.installation_id WHERE o.id=$1 AND o.archived_at IS NULL AND i.bootstrap_state='complete'", [scope.id])).rows[0];
		if (!result) throw new AppError("not_found", 404, "Resource unavailable");

		return [{ type: "instance", id: result.installation_id }, scope];
	}

	if (scope.type === "workspace") {
		const result = (await db.query("SELECT w.installation_id,w.organization_id FROM payloadbay.workspace w JOIN payloadbay.organization o ON o.id=w.organization_id AND o.installation_id=w.installation_id JOIN payloadbay.installation i ON i.id=w.installation_id WHERE w.id=$1 AND w.archived_at IS NULL AND o.archived_at IS NULL AND i.bootstrap_state='complete'", [scope.id])).rows[0];
		if (!result) throw new AppError("not_found", 404, "Resource unavailable");

		return [{ type: "instance", id: result.installation_id }, { type: "organization", id: result.organization_id }, scope];
	}

	const result = (await db.query("SELECT p.workspace_id,w.installation_id,w.organization_id FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id JOIN payloadbay.organization o ON o.id=w.organization_id AND o.installation_id=w.installation_id JOIN payloadbay.installation i ON i.id=w.installation_id WHERE p.id=$1 AND p.archived_at IS NULL AND w.archived_at IS NULL AND o.archived_at IS NULL AND i.bootstrap_state='complete'", [scope.id])).rows[0];
	if (!result) throw new AppError("not_found", 404, "Resource unavailable");

	return [{ type: "instance", id: result.installation_id }, { type: "organization", id: result.organization_id }, { type: "workspace", id: result.workspace_id }, scope];
}

export async function actorPermissions(db: Pool | PoolClient, actor: Actor, scope: ScopeRef) {
	const ancestry = await scopeAncestry(db, scope);
	const active = await db.query("SELECT active FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active", [ancestry[0].id, actor.userId]);
	if (!active.rowCount) throw new AppError("unauthenticated", 401, "Authentication required");
	const rows = (await db.query("SELECT scope_type,scope_id,permissions FROM payloadbay.grant_record WHERE user_id=$1", [actor.userId])).rows;
	let result = effectivePermissions(
		rows.map((row) => ({ scopeType: row.scope_type, scopeId: row.scope_id, permissions: row.permissions })),
		ancestry,
	);
	if (actor.token) {
		const token = (await db.query("SELECT id,scope_type,scope_id,permissions,workspace_ids FROM payloadbay.api_token WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp()", [actor.token.id, actor.userId])).rows[0];
		if (!token || !ancestry.some((s) => s.type === token.scope_type && s.id === token.scope_id)) throw new AppError("unauthenticated", 401, "Authentication required");
		if (token.workspace_ids !== null && !ancestry.some((s) => s.type === "workspace" && token.workspace_ids.includes(s.id))) return new Set<Permission>();
		result = new Set([...result].filter((permission) => token.permissions.includes(permission)));
	}

	return result;
}

export async function requirePermission(db: Pool | PoolClient, actor: Actor, scope: ScopeRef, permission: Permission) {
	const effective = await actorPermissions(db, actor, scope);
	if (!effective.has(permission)) throw new AppError("forbidden", 403, "Permission required");

	return effective;
}

export async function setGrant(
	pool: Pool,
	actor: Actor,
	input: {
		scope: ScopeRef;
		userId: string;
		role: keyof typeof rolePermissions | "custom";
		permissions: readonly Permission[];
		expectedVersion: number | null;
	},
) {
	return transaction(pool, async (db) => {
		// All membership changes in a scope serialize, including insertion of its first grant.
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["grant:" + input.scope.type + ":" + input.scope.id]);
		const held = await requirePermission(db, actor, input.scope, "members.manage");
		if (process.env.IS_PREVIEW === "true" && input.scope.type === "instance" && input.role !== "owner") {
			const demo = await db.query('SELECT 1 FROM auth."user" WHERE id=$1 AND email=$2', [input.userId, previewReviewerEmail]);
			if (demo.rowCount) throw new AppError("preview_identity_protected", 403, "Preview reviewer access cannot be removed");
		}

		assertGrantSubset(held, input.permissions);
		if (input.role === "owner") {
			await requirePermission(db, actor, input.scope, "ownership.transfer");
			if (permissions.some((p) => !input.permissions.includes(p))) throw new AppError("owner_permissions", 400, "Owner requires all permissions");
		}

		if (input.permissions.some((p) => !permissions.includes(p))) throw new AppError("invalid_permissions", 400, "Unknown permission");
		const ancestry = await scopeAncestry(db, input.scope);
		const admitted = await db.query("SELECT 1 FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active", [ancestry[0].id, input.userId]);
		if (!admitted.rowCount) throw new AppError("member_not_admitted", 400, "Member must first be admitted to the instance");
		const existing = (await db.query("SELECT id,role_preset,version FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type=$2 AND scope_id=$3 FOR UPDATE", [input.userId, input.scope.type, input.scope.id])).rows[0];
		if ((existing?.version ?? null) !== input.expectedVersion) throw new AppError("version_conflict", 409, "Membership changed; reload and try again");
		if (existing?.role_preset === "owner" && input.role !== "owner") {
			await requirePermission(db, actor, input.scope, "ownership.transfer");
			const owners = await db.query("SELECT g.user_id FROM payloadbay.grant_record g JOIN payloadbay.admission a ON a.user_id=g.user_id AND a.installation_id=$3 AND a.active WHERE g.scope_type=$1 AND g.scope_id=$2 AND g.role_preset='owner'", [input.scope.type, input.scope.id, ancestry[0].id]);
			if (owners.rowCount! <= 1) throw new AppError("last_owner", 409, "A scope must retain an active owner");
			if (input.scope.type !== "instance") {
				const replacement = owners.rows.find((row) => row.user_id !== input.userId).user_id;
				await db.query(`UPDATE payloadbay.${input.scope.type} SET owner_user_id=$1 WHERE id=$2 AND owner_user_id=$3`, [replacement, input.scope.id, input.userId]);
			}
		}

		const result = await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,scope_type,scope_id) DO UPDATE SET role_preset=EXCLUDED.role_preset,permissions=EXCLUDED.permissions,version=payloadbay.grant_record.version+1 RETURNING id,version", [input.userId, input.scope.type, input.scope.id, input.role, input.permissions]);
		await db.query("INSERT INTO payloadbay.audit(actor,operation,scope_type,scope_id,redacted_diff) VALUES($1,'membership.changed',$2,$3,$4)", [actor.userId, input.scope.type, input.scope.id, JSON.stringify({ userId: input.userId, role: input.role, permissions: input.permissions })]);

		return result.rows[0] as { id: string; version: number };
	});
}
