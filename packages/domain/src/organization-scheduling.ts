import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { resolveOrganizationPolicy } from "./organization-policy.ts";
import { AppError } from "../../contracts/src/errors.ts";

/** Graphile calls this before claiming a job; independent lanes retain reserved workers. */
export async function nextOrganizationFlags(pool: Pool, lane: "critical" | "bulk") {
	return transaction(pool, async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["organization-dispatch:" + lane]);
		await db.query("INSERT INTO payloadbay.organization_dispatch_turn(organization_id,lane) SELECT id,$1 FROM payloadbay.organization ON CONFLICT DO NOTHING", [lane]);
		const organizations = (await db.query("SELECT id FROM payloadbay.organization ORDER BY id")).rows as { id: string }[];
		const candidates = (
			await db.query(
				`SELECT turn.organization_id FROM payloadbay.organization_dispatch_turn turn
 WHERE turn.lane=$1 AND EXISTS (
 SELECT 1 FROM payloadbay.execution x JOIN payloadbay.endpoint e ON e.id=x.endpoint_id
 JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id
 JOIN payloadbay.dispatch d ON d.execution_id=x.id AND d.generation=x.dispatch_generation
 JOIN graphile_worker.jobs j ON j.id=d.graphile_job_id
 WHERE w.organization_id=turn.organization_id AND NOT e.paused AND x.state IN ('queued','retry_wait')
 AND x.attempt_number<x.max_attempts AND x.due_at<=clock_timestamp() AND j.run_at<=clock_timestamp()
 AND j.locked_at IS NULL AND j.attempts<j.max_attempts
 AND (($1='critical' AND j.priority<=0) OR ($1='bulk' AND j.priority>0))
 ) ORDER BY turn.last_selected_at,turn.organization_id`,
				[lane],
			)
		).rows as { organization_id: string }[];
		let selected: string | undefined;
		for (const candidate of candidates) {
			let policy;
			try {
				policy = await resolveOrganizationPolicy(db, candidate.organization_id);
			} catch (error) {
				// Invalid local policy blocks its own work, not healthy neighbors or mail.
				if (error instanceof AppError && ["organization_policy_required", "organization_policy_invalid"].includes(error.code)) continue;
				throw error;
			}

			const occupied = (await db.query("SELECT count(*)::int AS n FROM payloadbay.execution x JOIN payloadbay.endpoint e ON e.id=x.endpoint_id JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE w.organization_id=$1 AND x.state='running' AND x.lease_expiry>clock_timestamp()", [candidate.organization_id])).rows[0].n;
			if (occupied >= policy.processingConcurrency) continue;
			selected = candidate.organization_id;
			await db.query("UPDATE payloadbay.organization_dispatch_turn SET last_selected_at=clock_timestamp() WHERE organization_id=$1 AND lane=$2", [selected, lane]);
			break;
		}

		const excluded = ["platform", lane === "critical" ? "bulk" : "critical", ...organizations.filter((organization) => organization.id !== selected).map((organization) => "organization:" + organization.id)];
		if (!selected) excluded.push(lane);

		return excluded;
	});
}
