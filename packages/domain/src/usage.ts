import type { Pool, PoolClient } from "pg";
import { usageFactInput, usageMetrics, usageWindowInput } from "../../contracts/src/usage.ts";
import type { UsageMetric } from "../../contracts/src/usage.ts";
import type { Actor } from "./authorization.ts";
import { requirePermission } from "./membership.ts";
import { AppError } from "../../contracts/src/errors.ts";

export type UsageFactInput = {
	organizationId: string;
	workspaceId?: string;
	projectId?: string;
	metric: UsageMetric;
	sourceKey: string;
};

/** One statement makes the fact and both rollups atomic; callers include it in their event transaction. */
export async function recordUsage(db: PoolClient, input: UsageFactInput) {
	const parsed = usageFactInput.safeParse(input);
	if (!parsed.success) throw new AppError("invalid_usage_fact", 400, "Usage attribution is invalid");
	const fact = parsed.data;
	if (fact.metric === "ingress.accepted") await db.query("SELECT id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [fact.organizationId]);
	const result = await db.query(
		`WITH inserted AS (
 INSERT INTO payloadbay.usage_fact(organization_id,workspace_id,project_id,metric,source_key)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,metric,source_key) DO NOTHING
 RETURNING organization_id,metric,quantity,occurred_at
 ), totals AS (
 INSERT INTO payloadbay.usage_counter(organization_id,metric,quantity)
 SELECT organization_id,metric,quantity FROM inserted
 ON CONFLICT(organization_id,metric) DO UPDATE SET quantity=payloadbay.usage_counter.quantity+EXCLUDED.quantity
 ), hours AS (
 INSERT INTO payloadbay.usage_hour(organization_id,metric,window_start,quantity)
 SELECT organization_id,metric,date_trunc('hour',occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',quantity FROM inserted
 ON CONFLICT(organization_id,metric,window_start) DO UPDATE SET quantity=payloadbay.usage_hour.quantity+EXCLUDED.quantity
 ), admission_totals AS (
 UPDATE payloadbay.admission_window_counter counter SET quantity=counter.quantity+inserted.quantity FROM inserted
 WHERE counter.organization_id=inserted.organization_id AND inserted.metric='ingress.accepted'
 AND inserted.occurred_at>=counter.window_start AND inserted.occurred_at<counter.window_end
 ) SELECT count(*)::int AS recorded FROM inserted`,
		[fact.organizationId, fact.workspaceId ?? null, fact.projectId ?? null, fact.metric, fact.sourceKey],
	);

	return result.rows[0].recorded === 1;
}

/** Resolve attribution from immutable resource ancestry, never from webhook data or a job's tenant hint. */
export async function recordEndpointUsage(db: PoolClient, endpointId: string, metric: UsageMetric, sourceKey: string) {
	const scope = (await db.query("SELECT e.project_id,p.workspace_id,w.organization_id FROM payloadbay.endpoint e JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id JOIN payloadbay.organization o ON o.id=w.organization_id AND o.installation_id=w.installation_id WHERE e.id=$1", [endpointId])).rows[0];
	if (!scope) throw new AppError("usage_scope_unavailable", 409, "Usage ownership is unavailable");

	return recordUsage(db, {
		organizationId: scope.organization_id,
		workspaceId: scope.workspace_id,
		projectId: scope.project_id,
		metric,
		sourceKey,
	});
}

/** Payload-free counts use retained facts for exact boundaries and durable lifetime counters. */
export async function readOrganizationUsage(db: Pool, actor: Actor, organizationId: string, window: { from: string; to: string }) {
	await requirePermission(db, actor, { type: "organization", id: organizationId }, "metadata.read");
	const parsed = usageWindowInput.safeParse(window);
	if (!parsed.success || Date.parse(parsed.data.from) >= Date.parse(parsed.data.to)) throw new AppError("invalid_usage_window", 400, "Choose an increasing UTC usage window");
	const rows = (
		await db.query(
			`SELECT metric,
 COALESCE((SELECT quantity FROM payloadbay.usage_counter c WHERE c.organization_id=$1 AND c.metric=m.metric),0)::text AS lifetime,
 COALESCE((SELECT sum(quantity) FROM payloadbay.usage_fact f WHERE f.organization_id=$1 AND f.metric=m.metric AND f.occurred_at>=$2 AND f.occurred_at<$3),0)::text AS window
 FROM unnest($4::text[]) AS m(metric)`,
			[organizationId, parsed.data.from, parsed.data.to, usageMetrics],
		)
	).rows as { metric: UsageMetric; lifetime: string; window: string }[];

	return {
		organizationId,
		from: parsed.data.from,
		to: parsed.data.to,
		metrics: Object.fromEntries(rows.map((row) => [row.metric, { lifetime: row.lifetime, window: row.window }])) as Record<UsageMetric, { lifetime: string; window: string }>,
	};
}
