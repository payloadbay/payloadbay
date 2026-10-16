import { resolveOrganizationPolicy } from "./organization-policy.ts";
import { recordEndpointUsage } from "./usage.ts";
import { appendChange } from "./changes.ts";
import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";

export async function scheduleDispatch(
	client: PoolClient,
	execution: {
		id: string;
		endpoint_id: string;
		dispatch_generation: number;
		due_at: Date;
	},
	priority: number,
) {
	const key = `execution:${execution.id}:${execution.dispatch_generation}`;
	const job = (await client.query("SELECT payloadbay.enqueue('process_event',$1::json,$2,$3,$4::smallint) AS id", [JSON.stringify({ executionId: execution.id, generation: execution.dispatch_generation, endpointId: execution.endpoint_id }), execution.due_at, key, priority])).rows[0].id;
	await client.query(`INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,graphile_job_id,job_key,claim_deadline_at) VALUES($1,$2,$3,$4,$5,GREATEST($6::timestamptz,clock_timestamp())+interval '30 seconds')`, [execution.id, execution.endpoint_id, execution.dispatch_generation, job, key, execution.due_at]);
}

export async function recoverExpired(pool: Pool) {
	return transaction(pool, async (client) => {
		const candidates = await client.query(`SELECT e.*,p.priority,p.project_id FROM payloadbay.execution e JOIN payloadbay.endpoint p ON p.id=e.endpoint_id LEFT JOIN payloadbay.dispatch d ON d.execution_id=e.id AND d.generation=e.dispatch_generation
   WHERE NOT p.paused AND ((e.state='running' AND e.lease_expiry<=clock_timestamp()) OR(e.state IN ('queued','retry_wait') AND e.due_at<=clock_timestamp() AND(d.claim_deadline_at<=clock_timestamp() OR d.execution_id IS NULL)))
   ORDER BY e.due_at,e.id FOR UPDATE OF e SKIP LOCKED LIMIT 100`);
		const recovered: string[] = [];
		const changes: { id: string; projectId: string }[] = [];
		for (const candidate of candidates.rows) {
			if (candidate.attempt_number >= candidate.max_attempts) {
				await client.query("UPDATE payloadbay.execution SET state='failed_terminal',dispatch_generation=dispatch_generation+1,lease_owner=NULL,lease_expiry=NULL,final_result=$2::jsonb WHERE id=$1", [candidate.id, JSON.stringify({ kind: "fail", reason: "processing_attempts_exhausted" })]);
				await client.query("UPDATE payloadbay.managed_operation SET state='uncertain' WHERE execution_id=$1 AND state='sending'", [candidate.id]);
				await recordEndpointUsage(client, candidate.endpoint_id, "execution.failed", candidate.id);
				changes.push({ id: candidate.id, projectId: candidate.project_id });
				recovered.push(candidate.id);
				continue;
			}

			const fresh = (await client.query(`UPDATE payloadbay.execution SET dispatch_generation=dispatch_generation+1,state='queued',lease_owner=NULL,lease_expiry=NULL,due_at=clock_timestamp() WHERE id=$1 AND dispatch_generation=$2 RETURNING *`, [candidate.id, candidate.dispatch_generation])).rows[0];
			if (!fresh) continue;
			await scheduleDispatch(client, fresh, candidate.priority);
			recovered.push(fresh.id);
			changes.push({ id: fresh.id, projectId: candidate.project_id });
		}

		for (const change of changes) await appendChange(client, { scope: { type: "project", id: change.projectId }, kind: "execution.changed", resourceId: change.id });

		return recovered;
	});
}

export type Authority = {
	executionId: string;
	generation: number;
	owner: string;
	endpointId: string;
};

export class FenceError extends Error {
	readonly code = "stale_execution";
	constructor() {
		super("Execution authority expired or changed");
	}
}

export async function assertAuthority(client: PoolClient, authority: Authority, lock = false) {
	if (lock) await client.query("SELECT id FROM payloadbay.execution WHERE id=$1 FOR UPDATE", [authority.executionId]);
	const result = await client.query(`SELECT * FROM payloadbay.execution WHERE id=$1 AND dispatch_generation=$2 AND lease_owner=$3 AND endpoint_id=$4 AND state='running' AND lease_expiry>clock_timestamp()`, [authority.executionId, authority.generation, authority.owner, authority.endpointId]);
	if (!result.rowCount) throw new FenceError();

	return result.rows[0];
}

export async function finishExecution(pool: Pool, authority: Authority, result: { kind: "complete" | "retry" | "fail"; reason?: string; delayMs?: number }, options: { maxAttempts?: number } = {}) {
	return transaction(pool, async (client) => {
		const execution = await assertAuthority(client, authority, true);
		const retry = result.kind === "retry" && execution.attempt_number < (options.maxAttempts ?? 5);
		const state = result.kind === "complete" ? "succeeded" : retry ? "retry_wait" : "failed_terminal";
		const delay = result.delayMs ?? Math.min(60000, 1000 * 2 ** Math.max(0, execution.attempt_number - 1));
		if (!Number.isInteger(delay) || delay < 0 || delay > 3600000) throw Error("Invalid retry delay");
		const updated = (await client.query(`UPDATE payloadbay.execution SET state=$2,final_result=$3::jsonb,lease_owner=NULL,lease_expiry=NULL,dispatch_generation=dispatch_generation+$4,due_at=CASE WHEN $4=1 THEN clock_timestamp()+$5::int*interval '1 millisecond' ELSE due_at END WHERE id=$1 RETURNING *`, [execution.id, state, JSON.stringify(result), retry ? 1 : 0, delay])).rows[0];
		if (retry) {
			const endpoint = (await client.query("SELECT priority FROM payloadbay.endpoint WHERE id=$1", [execution.endpoint_id])).rows[0];
			await scheduleDispatch(client, updated, endpoint.priority);
		}

		if (!retry) await recordEndpointUsage(client, execution.endpoint_id, state === "succeeded" ? "execution.succeeded" : "execution.failed", execution.id);
		const scope = (await client.query("SELECT project_id FROM payloadbay.endpoint WHERE id=$1", [execution.endpoint_id])).rows[0];
		await appendChange(client, { scope: { type: "project", id: scope.project_id }, kind: "execution.changed", resourceId: execution.id });

		return updated;
	});
}

export async function claimExecution(pool: Pool, executionId: string, generation: number, owner: string) {
	return transaction(pool, async (db) => {
		const scope = (await db.query("SELECT w.organization_id FROM payloadbay.execution x JOIN payloadbay.endpoint e ON e.id=x.endpoint_id JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE x.id=$1", [executionId])).rows[0];
		if (!scope) return null;
		// Serialize claims across all worker processes, using database time for live capacity.
		await db.query("SELECT id FROM payloadbay.organization WHERE id=$1 FOR UPDATE", [scope.organization_id]);
		const candidate = (await db.query("SELECT e.*,p.priority FROM payloadbay.execution e JOIN payloadbay.endpoint p ON p.id=e.endpoint_id WHERE e.id=$1 AND e.dispatch_generation=$2 AND NOT p.paused AND e.state IN ('queued','retry_wait') AND e.attempt_number<e.max_attempts AND e.due_at<=clock_timestamp() FOR UPDATE OF e", [executionId, generation])).rows[0];
		if (!candidate) return null;
		const policy = await resolveOrganizationPolicy(db, scope.organization_id);
		const occupied = (await db.query("SELECT count(*)::int AS n FROM payloadbay.execution x JOIN payloadbay.endpoint e ON e.id=x.endpoint_id JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE w.organization_id=$1 AND x.state='running' AND x.lease_expiry>clock_timestamp()", [scope.organization_id])).rows[0].n;
		if (occupied >= policy.processingConcurrency) {
			const deferred = (await db.query("UPDATE payloadbay.execution SET dispatch_generation=dispatch_generation+1,due_at=clock_timestamp()+interval '1 second' WHERE id=$1 RETURNING *", [executionId])).rows[0];
			await scheduleDispatch(db, deferred, candidate.priority);

			return null;
		}

		const result = await db.query(
			`UPDATE payloadbay.execution e SET state='running',lease_owner=$3,lease_expiry=clock_timestamp()+interval '30 seconds',attempt_number=attempt_number+1
 FROM payloadbay.endpoint p WHERE e.id=$1 AND e.dispatch_generation=$2 AND e.endpoint_id=p.id AND NOT p.paused AND e.state IN ('queued','retry_wait') AND e.attempt_number<e.max_attempts AND e.due_at<=clock_timestamp()
 RETURNING e.*`,
			[executionId, generation, owner],
		);
		const claimed = result.rows[0];
		if (claimed) await recordEndpointUsage(db, claimed.endpoint_id, "processing.attempt.started", claimed.id + ":" + claimed.attempt_number);

		return claimed ?? null;
	});
}

export async function heartbeat(pool: Pool, authority: Authority) {
	return transaction(pool, async (client) => {
		try {
			await assertAuthority(client, authority, true);
		} catch (error) {
			if (error instanceof FenceError) return false;
			throw error;
		}

		const result = await client.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()+interval '30 seconds' WHERE id=$1 AND dispatch_generation=$2 AND lease_owner=$3 RETURNING id", [authority.executionId, authority.generation, authority.owner]);

		return result.rowCount === 1;
	});
}
