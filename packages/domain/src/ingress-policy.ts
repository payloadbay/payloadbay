import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { transaction } from "./db.ts";
import { endpointFor } from "./endpoints.ts";
import { appendChange } from "./changes.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { ingressPolicy, ingressPolicyUpdate, ingressRuleOutcome, type IngressPolicy } from "../../contracts/src/ingress-policy.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function getIngressPolicy(pool: Pool, actor: Actor, endpointId: string, encryptionKey: string) {
	await endpointFor(pool, actor, endpointId, "endpoints.configure");
	const row = (await pool.query("SELECT version,encrypted_policy FROM payloadbay.ingress_policy WHERE endpoint_id=$1", [endpointId])).rows[0];

	return { version: row?.version ?? 0, policy: row ? ingressPolicy.parse(decryptPrivate(row.encrypted_policy, encryptionKey)) : ingressPolicy.parse({}) };
}

export async function saveIngressPolicy(pool: Pool, actor: Actor, endpointId: string, input: unknown, encryptionKey: string) {
	const data = ingressPolicyUpdate.parse(input);

	return transaction(pool, async (db) => {
		const { endpoint } = await endpointFor(db, actor, endpointId, "endpoints.configure");
		await db.query("SELECT id FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [endpointId]);
		const existing = (await db.query("SELECT version FROM payloadbay.ingress_policy WHERE endpoint_id=$1 FOR UPDATE", [endpointId])).rows[0];
		if ((existing?.version ?? 0) !== data.expectedVersion) throw new AppError("version_conflict", 409, "Request protection changed; reload before saving");
		const version = data.expectedVersion + 1;
		await db.query("INSERT INTO payloadbay.ingress_policy(endpoint_id,version,encrypted_policy) VALUES($1,$2,$3) ON CONFLICT(endpoint_id) DO UPDATE SET version=EXCLUDED.version,encrypted_policy=EXCLUDED.encrypted_policy", [endpointId, version, encryptPrivate(data.policy, encryptionKey)]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'endpoint.protection_changed',$3,$4)", [
			actor.userId,
			endpoint.project_id,
			endpointId,
			JSON.stringify({
				enabled: data.policy.enabled,
				ruleCount: data.policy.rules.length,
				rateLimitEnabled: data.policy.rateLimit.enabled,
				version,
			}),
		]);
		await appendChange(db, { scope: { type: "project", id: endpoint.project_id }, kind: "configuration.changed", resourceId: endpointId });

		return { version, policy: data.policy };
	});
}

/** Database-backed route-wide quota, shared across processes and evaluated before configured code. */
export async function checkIngressPolicy(pool: Pool, endpointId: string, headers: Record<string, string>, encryptionKey: string): Promise<{ status: 403 | 429; retryAfter?: number } | null> {
	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT version,encrypted_policy FROM payloadbay.ingress_policy WHERE endpoint_id=$1 FOR SHARE", [endpointId])).rows[0];
		if (!row) return null;
		const policy: IngressPolicy = ingressPolicy.parse(decryptPrivate(row.encrypted_policy, encryptionKey));
		if (ingressRuleOutcome(policy, headers) === "block") return { status: 403 };
		if (!policy.rateLimit.enabled) return null;
		const { requests, windowSeconds } = policy.rateLimit;
		const quota = (
			await db.query(
				`INSERT INTO payloadbay.ingress_rate_bucket(endpoint_id,policy_version,window_start,hits) VALUES($1,$2,statement_timestamp(),1)
ON CONFLICT(endpoint_id) DO UPDATE SET
 window_start=CASE WHEN ingress_rate_bucket.policy_version<>$2 OR ingress_rate_bucket.window_start+($3*interval '1 second')<=statement_timestamp() THEN statement_timestamp() ELSE ingress_rate_bucket.window_start END,
 hits=CASE WHEN ingress_rate_bucket.policy_version<>$2 OR ingress_rate_bucket.window_start+($3*interval '1 second')<=statement_timestamp() THEN 1 ELSE LEAST(ingress_rate_bucket.hits+1,$4+1) END,
 policy_version=$2
RETURNING hits, GREATEST(1,ceil(extract(epoch FROM window_start+($3*interval '1 second')-statement_timestamp())))::int AS retry_after`,
				[endpointId, row.version, windowSeconds, requests],
			)
		).rows[0];

		return quota.hits > requests ? { status: 429, retryAfter: quota.retry_after } : null;
	});
}
