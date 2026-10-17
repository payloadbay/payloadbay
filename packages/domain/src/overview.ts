import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { listResources } from "./resources.ts";
import { requirePermission } from "./membership.ts";
import { transaction } from "./db.ts";

/** Exact 24-hour aggregates over projects the actor can inspect, not a sampled event page. */
export async function dashboardOverview(pool: Pool, actor: Actor) {
	const projects = await listResources(pool, actor, "project");
	const ids = projects.filter((project) => project.permissions.includes("metadata.read")).map((project) => project.id);
	const result = await pool.query(
		`WITH hours AS (
 SELECT generate_series(date_trunc('hour',now())-interval '23 hours',date_trunc('hour',now()),interval '1 hour') AS hour
 ), incoming AS (
 SELECT date_trunc('hour',e.received_at) AS hour,count(*)::int AS ingress,count(*) FILTER(WHERE e.ingress_outcome='accept')::int AS accepted,count(*) FILTER(WHERE e.ingress_outcome='reject')::int AS rejected,count(*) FILTER(WHERE e.ingress_outcome='respondOnly')::int AS responded,count(*) FILTER(WHERE e.ingress_outcome='error')::int AS errored
 FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE ep.project_id=ANY($1::uuid[]) AND e.received_at>=date_trunc('hour',now())-interval '23 hours' GROUP BY 1
 ), outgoing AS (
 SELECT date_trunc('hour',a.started_at) AS hour,count(*)::int AS deliveries,count(*) FILTER(WHERE a.status_code BETWEEN 200 AND 299)::int AS delivered,count(*) FILTER(WHERE a.ended_at IS NOT NULL AND (a.status_code IS NULL OR a.status_code NOT BETWEEN 200 AND 299))::int AS failed
 FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.endpoint ep ON ep.id=x.endpoint_id WHERE ep.project_id=ANY($1::uuid[]) AND a.started_at>=date_trunc('hour',now())-interval '23 hours' GROUP BY 1
 ), processing AS (
 SELECT date_trunc('hour',x.created_at) AS hour,count(*)::int AS executions FROM payloadbay.execution x JOIN payloadbay.endpoint ep ON ep.id=x.endpoint_id WHERE ep.project_id=ANY($1::uuid[]) AND x.created_at>=date_trunc('hour',now())-interval '23 hours' GROUP BY 1
 ) SELECT h.hour,COALESCE(i.ingress,0)::int AS ingress,COALESCE(i.accepted,0)::int AS accepted,COALESCE(i.rejected,0)::int AS rejected,COALESCE(i.responded,0)::int AS responded,COALESCE(i.errored,0)::int AS errored,COALESCE(o.deliveries,0)::int AS deliveries,COALESCE(o.delivered,0)::int AS delivered,COALESCE(o.failed,0)::int AS failed,COALESCE(p.executions,0)::int AS executions FROM hours h LEFT JOIN incoming i USING(hour) LEFT JOIN outgoing o USING(hour) LEFT JOIN processing p USING(hour) ORDER BY h.hour`,
		[ids],
	);
	const series = result.rows.map((row) => ({ ...row, hour: row.hour.toISOString() }));
	const totals = Object.fromEntries(["ingress", "accepted", "rejected", "responded", "errored", "deliveries", "delivered", "failed", "executions"].map((key) => [key, series.reduce((sum, row) => sum + row[key], 0)]));
	const recent = (await pool.query(`SELECT x.id,x.state,x.attempt_number,x.created_at,ep.name AS endpoint_name,ep.project_id,ep.id AS endpoint_id,p.name AS project_name FROM payloadbay.execution x JOIN payloadbay.endpoint ep ON ep.id=x.endpoint_id JOIN payloadbay.project p ON p.id=ep.project_id WHERE ep.project_id=ANY($1::uuid[]) ORDER BY x.created_at DESC,x.id DESC LIMIT 12`, [ids])).rows;

	return { series, totals, recent };
}

/** Installation-only operational metadata; encrypted payloads and raw upstream errors stay private. */
export async function readJobAdministration(pool: Pool, actor: Actor, installationId: string) {
	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "instance", id: installationId }, "jobs.read");
		const rows = (await db.query(`SELECT id,kind,state,attempt_number,max_attempts,created_at,due_at FROM payloadbay.platform_job ORDER BY (state IN ('queued','running')) DESC,due_at,id LIMIT 100`)).rows;

		const backlog = (
			await db.query(
				`SELECT ep.priority,count(*)::int AS due_count,
 floor(extract(epoch FROM (statement_timestamp()-min(x.created_at))))::int AS oldest_queued_seconds,
 floor(extract(epoch FROM (statement_timestamp()-min(x.due_at))))::int AS oldest_due_seconds
 FROM payloadbay.execution x JOIN payloadbay.endpoint ep ON ep.id=x.endpoint_id
 JOIN payloadbay.project p ON p.id=ep.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id
 WHERE w.installation_id=$1 AND x.state IN ('queued','retry_wait')
 AND x.due_at<=statement_timestamp() AND NOT ep.paused
 GROUP BY ep.priority ORDER BY ep.priority`,
				[installationId],
			)
		).rows;

		return {
			acknowledgmentLatency: null,
			backlog: backlog.map((row) => ({
				priority: row.priority,
				dueCount: row.due_count,
				oldestQueuedSeconds: row.oldest_queued_seconds,
				oldestDueSeconds: row.oldest_due_seconds,
			})),
			items: rows.map((row) => ({
				id: row.id,
				kind: row.kind,
				state: row.state,
				attemptNumber: row.attempt_number,
				maxAttempts: row.max_attempts,
				createdAt: row.created_at.toISOString(),
				dueAt: row.due_at.toISOString(),
			})),
		};
	});
}
