import type { Pool } from "pg";
import { assertResourceCapacity } from "./organization-policy.ts";
import { transaction } from "./db.ts";
import { rolePermissions } from "./authorization.ts";
import { resourceInput } from "../../contracts/src/resources.ts";
import { AppError } from "../../contracts/src/errors.ts";

export type RegistrationPolicy = "invite_only" | "organization";

/** First-customer provisioning is deliberately separate from instance administration. */
export async function provisionCustomerOrganization(pool: Pool, input: { userId: string; name: string; slug: string }, policy: RegistrationPolicy) {
	if (policy !== "organization") throw new AppError("registration_disabled", 403, "Organization registration is disabled");

	return transaction(pool, async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["customer-onboarding:" + input.userId]);
		const user = (await db.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1 FOR SHARE', [input.userId])).rows[0];
		if (!user?.emailVerified) throw new AppError("email_verification_required", 403, "Verify your email before creating an organization");
		const installation = (await db.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete' FOR SHARE")).rows[0];
		if (!installation) throw new AppError("configuration_required", 503, "Instance setup must be completed first");
		const admission = (await db.query("SELECT active FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 FOR UPDATE", [installation.id, input.userId])).rows[0];
		if (admission?.active === false) throw new AppError("inactive_admission", 403, "Your instance access is not active");
		const existing = (await db.query("SELECT organization_id,workspace_id FROM payloadbay.customer_onboarding WHERE user_id=$1", [input.userId])).rows[0];
		if (existing) return { organizationId: existing.organization_id as string, workspaceId: existing.workspace_id as string };
		const parsed = resourceInput.safeParse({ parentId: installation.id, name: input.name, slug: input.slug });
		if (!parsed.success) throw new AppError("invalid_input", 400, "Provide an organization name and lowercase URL name");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,$2,true) ON CONFLICT DO NOTHING", [installation.id, input.userId]);
		const organization = (await db.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,$2,$3,$4) RETURNING id", [installation.id, parsed.data.name, parsed.data.slug, input.userId])).rows[0];
		await assertResourceCapacity(db, organization.id, "workspace");
		const workspace = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Default workspace','default',$3) RETURNING id", [installation.id, organization.id, input.userId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'organization',$2,'owner',$3)", [input.userId, organization.id, rolePermissions.owner]);
		await db.query("INSERT INTO payloadbay.customer_onboarding(user_id,organization_id,workspace_id) VALUES($1,$2,$3)", [input.userId, organization.id, workspace.id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'organization',$2::uuid,'organization.onboarded',($2::uuid)::text)", [input.userId, organization.id]);

		return { organizationId: organization.id as string, workspaceId: workspace.id as string };
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("slug_conflict", 409, "This organization URL name is already in use");
		throw error;
	});
}
