import type { Pool, PoolClient } from "pg";
import type { Actor } from "./authorization.ts";
import { requirePermission } from "./membership.ts";
import { organizationSecurityInput } from "../../contracts/src/organization-policy.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { transaction } from "./db.ts";

export async function requiresPasskey(db: Pool | PoolClient, userId: string, organizationId: string) {
	return Boolean((await db.query('SELECT 1 FROM payloadbay.organization_security s WHERE s.organization_id=$1 AND s.require_passkey AND NOT EXISTS(SELECT 1 FROM auth.passkey k WHERE k."userId"=$2)', [organizationId, userId])).rowCount);
}

export async function passkeyPolicyRequired(db: Pool, userId: string) {
	return Boolean(
		(
			await db.query(
				`SELECT 1 FROM payloadbay.organization_security s JOIN payloadbay.organization o ON o.id=s.organization_id AND o.archived_at IS NULL JOIN payloadbay.grant_record g ON g.user_id=$1 AND cardinality(g.permissions)>0 AND ((g.scope_type='organization' AND g.scope_id=o.id) OR (g.scope_type='workspace' AND g.scope_id IN(SELECT id FROM payloadbay.workspace WHERE organization_id=o.id AND archived_at IS NULL)) OR (g.scope_type='project' AND g.scope_id IN(SELECT p.id FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE w.organization_id=o.id AND w.archived_at IS NULL AND p.archived_at IS NULL))) WHERE s.require_passkey LIMIT 1`,
				[userId],
			)
		).rowCount,
	);
}

export async function readOrganizationSecurity(pool: Pool, actor: Actor, id: string) {
	await requirePermission(pool, actor, { type: "organization", id }, "members.manage");
	const row = (await pool.query("SELECT version,require_passkey FROM payloadbay.organization_security WHERE organization_id=$1", [id])).rows[0];

	return { version: row?.version ?? 0, requirePasskey: row?.require_passkey ?? false };
}

export async function saveOrganizationSecurity(pool: Pool, actor: Actor, id: string, input: unknown) {
	const parsed = organizationSecurityInput.safeParse(input);
	if (!parsed.success) throw new AppError("invalid_input", 400, "Provide a valid organization security policy");

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "organization", id }, "members.manage");
		await db.query("SELECT id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [id]);
		const prior = (await db.query("SELECT version FROM payloadbay.organization_security WHERE organization_id=$1", [id])).rows[0];
		if ((prior?.version ?? 0) !== parsed.data.version) throw new AppError("version_conflict", 409, "Security settings changed; reload before saving");
		if (parsed.data.requirePasskey && !(await db.query('SELECT 1 FROM auth.passkey WHERE "userId"=$1', [actor.userId])).rowCount) throw new AppError("passkey_required", 409, "Add a passkey to your account before enabling this policy");
		await db.query("INSERT INTO payloadbay.organization_security(organization_id,require_passkey,version) VALUES($1,$2,1) ON CONFLICT(organization_id) DO UPDATE SET require_passkey=EXCLUDED.require_passkey,version=payloadbay.organization_security.version+1", [id, parsed.data.requirePasskey]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'organization',$2::uuid,'organization.security_updated',($2::uuid)::text,$3)", [actor.userId, id, JSON.stringify({ requirePasskey: parsed.data.requirePasskey, version: parsed.data.version + 1 })]);

		return { version: parsed.data.version + 1, requirePasskey: parsed.data.requirePasskey };
	});
}

export async function passkeyEnrollmentRequired(db: Pool, userId: string) {
	return (await passkeyPolicyRequired(db, userId)) && !(await db.query('SELECT 1 FROM auth.passkey WHERE "userId"=$1', [userId])).rowCount;
}
