import type { Pool, PoolClient } from "pg";
import { organizationLimits, organizationPolicyInput, type OrganizationPolicy } from "../../contracts/src/organization-policy.ts";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import type { z } from "zod";
import { AppError } from "../../contracts/src/errors.ts";

/** Local policy is independent of payment/license services and user permission grants. */
export async function resolveOrganizationPolicy(db: Pool | PoolClient, organizationId: string): Promise<OrganizationPolicy> {
	const row = (await db.query("SELECT o.id,i.deployment_mode,p.version,p.limits,p.processing_concurrency FROM payloadbay.organization o JOIN payloadbay.installation i ON i.id=o.installation_id LEFT JOIN payloadbay.organization_policy p ON p.organization_id=o.id WHERE o.id=$1", [organizationId])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Organization unavailable");
	if (!row.version && row.deployment_mode === "hosted") throw new AppError("organization_policy_required", 503, "An operator must configure this organization's policy");
	const parsed = organizationLimits.safeParse(row.version ? row.limits : { workspaces: null, projects: null, admission: null });
	if (!parsed.success || !["self_hosted", "hosted"].includes(row.deployment_mode)) throw new AppError("organization_policy_invalid", 503, "Organization policy requires operator attention");

	return {
		organizationId,
		deploymentMode: row.deployment_mode,
		version: row.version ?? 0,
		limits: parsed.data,
		processingConcurrency: row.processing_concurrency ?? 4,
	};
}

export async function setOrganizationPolicy(pool: Pool, actor: Actor, input: z.infer<typeof organizationPolicyInput>) {
	const parsed = organizationPolicyInput.safeParse(input);
	if (!parsed.success) throw new AppError("invalid_policy", 400, "Check organization policy values");
	const value = parsed.data;

	return transaction(pool, async (db) => {
		const organization = (await db.query("SELECT installation_id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [value.organizationId])).rows[0];
		if (!organization) throw new AppError("not_found", 404, "Organization unavailable");
		await requirePermission(db, actor, { type: "instance", id: organization.installation_id }, "settings.manage");
		const prior = (await db.query("SELECT version FROM payloadbay.organization_policy WHERE organization_id=$1", [value.organizationId])).rows[0];
		if ((prior?.version ?? 0) !== value.expectedVersion) throw new AppError("version_conflict", 409, "Policy changed; reload before saving");
		if (value.limits.admission) await ensureAdmissionWindow(db, value.organizationId, value.limits.admission);
		const version = value.expectedVersion + 1;
		await db.query("INSERT INTO payloadbay.organization_policy(organization_id,version,limits,processing_concurrency,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id) DO UPDATE SET version=EXCLUDED.version,limits=EXCLUDED.limits,processing_concurrency=EXCLUDED.processing_concurrency,updated_by=EXCLUDED.updated_by,updated_at=clock_timestamp()", [value.organizationId, version, JSON.stringify(value.limits), value.processingConcurrency, actor.userId]);
		const policy = await resolveOrganizationPolicy(db, value.organizationId);
		await db.query("INSERT INTO payloadbay.organization_policy_revision(organization_id,version,snapshot,created_by) VALUES($1,$2,$3,$4)", [value.organizationId, version, JSON.stringify(policy), actor.userId]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'organization',$2::uuid,'organization.policy.updated',($2::uuid)::text,$3)", [actor.userId, value.organizationId, JSON.stringify({ version })]);

		return policy;
	});
}

/** Resource counts and the ensuing insert share the organization's transaction lock. */
export async function assertResourceCapacity(db: PoolClient, organizationId: string, resource: "workspace" | "project") {
	await db.query("SELECT id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [organizationId]);
	const policy = await resolveOrganizationPolicy(db, organizationId);
	const limit = resource === "workspace" ? policy.limits.workspaces : policy.limits.projects;
	if (limit === null) return;
	const query = resource === "workspace" ? "SELECT count(*)::int AS n FROM payloadbay.workspace WHERE organization_id=$1 AND archived_at IS NULL" : "SELECT count(*)::int AS n FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE w.organization_id=$1 AND w.archived_at IS NULL AND p.archived_at IS NULL";
	const count = (await db.query(query, [organizationId])).rows[0].n;
	if (count >= limit) throw new AppError("organization_limit_reached", 409, `${resource === "workspace" ? "Workspace" : "Project"} limit reached for this organization`);
}

async function ensureAdmissionWindow(db: PoolClient, organizationId: string, window: { from: string; to: string }) {
	await db.query(
		`INSERT INTO payloadbay.admission_window_counter(organization_id,window_start,window_end,quantity)
 SELECT $1::uuid,$2::timestamptz,$3::timestamptz,COALESCE(sum(quantity),0)
 FROM payloadbay.usage_fact WHERE organization_id=$1 AND metric='ingress.accepted' AND occurred_at>=$2 AND occurred_at<$3
 ON CONFLICT(organization_id,window_start,window_end) DO NOTHING`,
		[organizationId, window.from, window.to],
	);
}

/** A configured window never resets implicitly or invents a billing period. */
export async function mayAcceptIngress(db: PoolClient, organizationId: string) {
	await db.query("SELECT id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [organizationId]);
	const policy = await resolveOrganizationPolicy(db, organizationId);
	const window = policy.limits.admission;
	if (!window) return true;
	const now = (await db.query("SELECT clock_timestamp() AS now")).rows[0].now as Date;
	if (now.getTime() < Date.parse(window.from) || now.getTime() >= Date.parse(window.to)) return false;
	await ensureAdmissionWindow(db, organizationId, window);
	const row = (await db.query("SELECT quantity::text FROM payloadbay.admission_window_counter WHERE organization_id=$1 AND window_start=$2 AND window_end=$3", [organizationId, window.from, window.to])).rows[0];

	return BigInt(row.quantity) < BigInt(window.limit);
}

/** Customer-visible operational policy; commercial writes remain instance-operator only. */
export async function readOrganizationPolicy(db: Pool, actor: Actor, organizationId: string) {
	await requirePermission(db, actor, { type: "organization", id: organizationId }, "metadata.read");

	return resolveOrganizationPolicy(db, organizationId);
}
