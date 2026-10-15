import { randomBytes, createHash } from "node:crypto";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry } from "./membership.ts";
import { assertGrantSubset, type Actor, type ScopeRef } from "./authorization.ts";
import { permissions as allPermissions, type Permission } from "../../contracts/src/permissions.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { encryptPrivate } from "./private-crypto.ts";
import type { createAuth } from "./auth-runtime.ts";

type InvitationGrant = { scope: ScopeRef; role: "owner" | "admin" | "operator" | "viewer" | "custom"; permissions: Permission[] };

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createInvitation(pool: Pool, actor: Actor, input: { scope: ScopeRef; email: string; grants: InvitationGrant[] }, identity: ReturnType<typeof createAuth>, encryptionKey: string, publicUrl: string) {
	const email = input.email.trim().toLowerCase();
	const ancestry = await scopeAncestry(pool, input.scope);
	await requirePermission(pool, actor, input.scope, "members.manage");
	for (const grant of input.grants) {
		if (!(await scopeAncestry(pool, grant.scope)).some((parent) => parent.type === input.scope.type && parent.id === input.scope.id)) throw new AppError("invalid_scope", 400, "Invited access must belong to this scope");
		const held = await requirePermission(pool, actor, grant.scope, "members.manage");
		assertGrantSubset(held, grant.permissions);
		if (grant.role === "owner") {
			await requirePermission(pool, actor, grant.scope, "ownership.transfer");
			if (allPermissions.some((permission) => !grant.permissions.includes(permission))) throw new AppError("owner_permissions", 400, "Owner requires all permissions");
		}
	}

	let user = (await pool.query('SELECT id FROM auth."user" WHERE lower(email)=$1', [email])).rows[0];
	const admitted = user && (await pool.query("SELECT 1 FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active", [ancestry[0].id, user.id])).rowCount;
	if (!admitted) await requirePermission(pool, actor, ancestry[0], "members.admit");
	if (!user) {
		try {
			user = (await identity.api.createUser({ body: { email, name: email.split("@")[0] } })).user;
		} catch (cause) {
			user = (await pool.query('SELECT id FROM auth."user" WHERE lower(email)=$1', [email])).rows[0];
			if (!user) throw cause;
		}
	}

	const token = randomBytes(32).toString("base64url");

	return transaction(pool, async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["invitation:" + ancestry[0].id + ":" + email]);
		for (const grant of input.grants) {
			const held = await requirePermission(db, actor, grant.scope, "members.manage");
			assertGrantSubset(held, grant.permissions);
			if ((await db.query("SELECT 1 FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type=$2 AND scope_id=$3", [user.id, grant.scope.type, grant.scope.id])).rowCount) throw new AppError("already_member", 409, "This person already has direct access to one of the selected scopes");
		}

		const pending = await db.query("SELECT 1 FROM payloadbay.invitation WHERE installation_id=$1 AND email=$2 AND state='pending' AND expires_at>clock_timestamp() AND scope_type=$3 AND scope_id=$4", [ancestry[0].id, email, input.scope.type, input.scope.id]);
		if (pending.rowCount) throw new AppError("invitation_pending", 409, "An invitation is already pending for this email and scope");
		if (!admitted) {
			await requirePermission(db, actor, ancestry[0], "members.admit");
			await db.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,$2,true) ON CONFLICT(installation_id,user_id) DO UPDATE SET active=true", [ancestry[0].id, user.id]);
		}

		const invitation = (await db.query("INSERT INTO payloadbay.invitation(installation_id,scope_type,scope_id,email,token_digest,grants,created_by,newly_admitted) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,expires_at", [ancestry[0].id, input.scope.type, input.scope.id, email, digest(token), JSON.stringify(input.grants), actor.userId, !admitted])).rows[0];
		const payload = { email, invitationId: invitation.id, url: new URL("/invitations/" + token, publicUrl).href };
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,expiry,claim_deadline_at) VALUES('invitation_mail',$1,$2,$3,clock_timestamp()+interval '30 seconds') RETURNING id,generation", [encryptPrivate(payload, encryptionKey), "invitation:" + invitation.id, invitation.expires_at])).rows[0];
		await db.query("SELECT payloadbay.enqueue('platform_job',$1::json,clock_timestamp(),$2,10::smallint)", [JSON.stringify({ jobId: job.id, generation: job.generation }), `platform:${job.id}:${job.generation}`]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'invitation.created',$4)", [actor.userId, input.scope.type, input.scope.id, invitation.id]);

		return {
			id: invitation.id,
			email,
			state: "pending",
			expiresAt: invitation.expires_at,
		};
	});
}

export async function listInvitations(pool: Pool, actor: Actor, scope: ScopeRef) {
	await requirePermission(pool, actor, scope, "members.manage");
	const ancestry = await scopeAncestry(pool, scope);

	return (await pool.query("SELECT id,email,grants,expires_at,state FROM payloadbay.invitation WHERE installation_id=$3 AND state='pending' AND expires_at>clock_timestamp() AND (($1='instance') OR (scope_type=$1 AND scope_id=$2) OR grants @> $4::jsonb) ORDER BY created_at DESC LIMIT 200", [scope.type, scope.id, ancestry[0].id, JSON.stringify([{ scope }])])).rows;
}

export async function invitationDetails(pool: Pool, token: string) {
	if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError("not_found", 404, "Invitation unavailable");
	const row = (await pool.query("SELECT email,state,expires_at,grants FROM payloadbay.invitation WHERE token_digest=$1", [digest(token)])).rows[0];
	if (!row || row.state !== "pending" || new Date(row.expires_at).getTime() <= Date.now()) throw new AppError("not_found", 404, "Invitation expired, cancelled or already accepted");

	return { email: row.email, expiresAt: row.expires_at, grants: row.grants };
}

export async function acceptInvitation(pool: Pool, actor: Actor, token: string) {
	if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError("not_found", 404, "Invitation unavailable");

	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT * FROM payloadbay.invitation WHERE token_digest=$1 AND state='pending' AND expires_at>clock_timestamp() FOR UPDATE", [digest(token)])).rows[0];
		const user = (await db.query('SELECT email,"emailVerified" FROM auth."user" WHERE id=$1', [actor.userId])).rows[0];
		if (!row || !user?.emailVerified || user.email.toLowerCase() !== row.email) throw new AppError("invitation_identity", 403, "Sign in with the email address that received this invitation");
		await requirePermission(db, { userId: row.created_by }, { type: row.scope_type, id: row.scope_id }, "members.manage");
		const admission = await db.query("SELECT 1 FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active FOR SHARE", [row.installation_id, actor.userId]);
		if (!admission.rowCount) throw new AppError("inactive_admission", 403, "Your instance access is not active");
		for (const grant of [...(row.grants as InvitationGrant[])].sort((a, b) => (a.scope.type + a.scope.id).localeCompare(b.scope.type + b.scope.id))) {
			await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["grant:" + grant.scope.type + ":" + grant.scope.id]);
			const held = await requirePermission(db, { userId: row.created_by }, grant.scope, "members.manage");
			assertGrantSubset(held, grant.permissions);
			if (grant.role === "owner") await requirePermission(db, { userId: row.created_by }, grant.scope, "ownership.transfer");
			await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,scope_type,scope_id) DO NOTHING", [actor.userId, grant.scope.type, grant.scope.id, grant.role, grant.permissions]);
		}

		await db.query("UPDATE payloadbay.invitation SET state='accepted',accepted_by=$2 WHERE id=$1", [row.id, actor.userId]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'invitation.accepted',$4)", [actor.userId, row.scope_type, row.scope_id, row.id]);

		return { accepted: true };
	});
}

export async function cancelInvitation(pool: Pool, actor: Actor, id: string) {
	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT * FROM payloadbay.invitation WHERE id=$1 FOR UPDATE", [id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Invitation unavailable");
		await requirePermission(db, actor, { type: row.scope_type, id: row.scope_id }, "members.manage");
		if (row.state !== "pending") throw new AppError("invitation_closed", 409, "Invitation is no longer pending");
		await db.query("UPDATE payloadbay.invitation SET state='cancelled' WHERE id=$1", [id]);
		if (row.newly_admitted) await db.query("UPDATE payloadbay.admission a SET active=false FROM auth.\"user\" u WHERE a.user_id=u.id AND a.installation_id=$1 AND lower(u.email)=$2 AND NOT EXISTS(SELECT 1 FROM payloadbay.grant_record g WHERE g.user_id=u.id) AND NOT EXISTS(SELECT 1 FROM payloadbay.invitation i WHERE i.email=$2 AND i.state='pending' AND i.expires_at>clock_timestamp())", [row.installation_id, row.email]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'invitation.cancelled',$4)", [actor.userId, row.scope_type, row.scope_id, id]);

		return { cancelled: true };
	});
}
