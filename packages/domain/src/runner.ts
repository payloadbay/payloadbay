import type { Pool, PoolClient } from "pg";
import { createHash, randomBytes } from "node:crypto";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { assertAuthority, type Authority } from "./execution-lease.ts";
import { runnerCompletion } from "../../contracts/src/runner.ts";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function destinationPermission(db: Pool | PoolClient, actor: Actor, destinationId: string) {
	const destination = (await db.query("SELECT project_id FROM payloadbay.destination WHERE id=$1", [destinationId])).rows[0];
	if (!destination) throw new AppError("not_found", 404, "Destination unavailable");
	await requirePermission(db, actor, { type: "project", id: destination.project_id }, "destinations.configure");
	await requirePermission(db, actor, { type: "project", id: destination.project_id }, "payload.read");

	return destination.project_id as string;
}

export async function createRunnerCredential(pool: Pool, actor: Actor, destinationId: string) {
	return transaction(pool, async (db) => {
		const projectId = await destinationPermission(db, actor, destinationId);
		await db.query("SELECT id FROM payloadbay.destination WHERE id=$1 FOR UPDATE", [destinationId]);
		await db.query("UPDATE payloadbay.runner_credential SET revoked_at=clock_timestamp() WHERE destination_id=$1 AND revoked_at IS NULL", [destinationId]);
		const token = "pabr_" + randomBytes(32).toString("hex");
		const record = (await db.query("INSERT INTO payloadbay.runner_credential(destination_id,token_digest,created_by,parent_token) VALUES($1,$2,$3,$4) RETURNING id", [destinationId, digest(token), actor.userId, actor.token ? JSON.stringify(actor.token) : null])).rows[0];
		await db.query('UPDATE payloadbay.destination SET http_config=http_config || \'{"transport":"runner"}\'::jsonb,version=version+1 WHERE id=$1', [destinationId]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'runner.credential.created',$3)", [actor.userId, projectId, destinationId]);

		return { id: record.id, token, republishRequired: true };
	});
}

export async function revokeRunnerCredential(pool: Pool, actor: Actor, destinationId: string) {
	return transaction(pool, async (db) => {
		const projectId = await destinationPermission(db, actor, destinationId);
		await db.query("UPDATE payloadbay.runner_credential SET revoked_at=clock_timestamp() WHERE destination_id=$1 AND revoked_at IS NULL", [destinationId]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'runner.credential.revoked',$3)", [actor.userId, projectId, destinationId]);

		return { revoked: true };
	});
}

async function authenticate(db: PoolClient, token: string) {
	if (!/^pabr_[a-f0-9]{64}$/.test(token)) throw new AppError("unauthenticated", 401, "Runner authentication required");
	const row = (await db.query("SELECT destination_id,created_by,parent_token FROM payloadbay.runner_credential WHERE token_digest=$1 AND revoked_at IS NULL FOR SHARE", [digest(token)])).rows[0];
	if (!row) throw new AppError("unauthenticated", 401, "Runner authentication required");
	await destinationPermission(db, { userId: row.created_by, ...(row.parent_token ? { token: row.parent_token } : {}) }, row.destination_id);

	return row.destination_id as string;
}

export async function claimRunnerDelivery(pool: Pool, token: string, encryptionKey: string) {
	return transaction(pool, async (db) => {
		const destinationId = await authenticate(db, token);
		const row = (
			await db.query(
				`SELECT q.id,q.payload,LEAST(q.expires_at,x.lease_expiry) AS expires_at FROM payloadbay.runner_delivery q
 JOIN payloadbay.delivery_attempt a ON a.id=q.id JOIN payloadbay.execution x ON x.id=a.execution_id
 WHERE q.destination_id=$1 AND q.lease_digest IS NULL AND q.payload IS NOT NULL AND q.expires_at>clock_timestamp()+interval '1 second'
 AND a.ended_at IS NULL AND x.state='running' AND x.dispatch_generation=a.generation AND x.lease_expiry>clock_timestamp()+interval '1 second'
 ORDER BY q.expires_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED`,
				[destinationId],
			)
		).rows[0];
		if (!row) return null;
		const leaseToken = randomBytes(32).toString("hex");
		await db.query("UPDATE payloadbay.runner_delivery SET lease_digest=$2 WHERE id=$1", [row.id, digest(leaseToken)]);
		const payload = decryptPrivate<{
			method: string;
			headers: Record<string, string>;
			bodyBase64: string;
			idempotencyKey: string;
		}>(row.payload, encryptionKey);

		return {
			...payload,
			id: row.id,
			leaseToken,
			leaseExpiresAt: new Date(row.expires_at).toISOString(),
		};
	});
}

export type RunnerResult = { status: number; bodyBase64: string; contentType: string } | { networkError: "local_delivery_failed" };

export async function completeRunnerDelivery(pool: Pool, token: string, id: string, leaseToken: string, result: RunnerResult) {
	if (!runnerCompletion.safeParse({ leaseToken, result }).success) throw new AppError("invalid_input", 400, "Check the delivery result");

	return transaction(pool, async (db) => {
		const destinationId = await authenticate(db, token);
		const row = (
			await db.query(
				`SELECT q.*,q.result=$3::jsonb AS same_result,q.expires_at>clock_timestamp() AND x.lease_expiry>clock_timestamp() AND x.state='running' AND x.dispatch_generation=a.generation AS live
 FROM payloadbay.runner_delivery q JOIN payloadbay.delivery_attempt a ON a.id=q.id JOIN payloadbay.execution x ON x.id=a.execution_id
 WHERE q.id=$1 AND q.destination_id=$2 FOR UPDATE OF q`,
				[id, destinationId, JSON.stringify(result)],
			)
		).rows[0];
		if (!row || !row.live || !row.payload || row.lease_digest !== digest(leaseToken)) throw new AppError("stale_delivery", 409, "Delivery lease is no longer active");
		if (row.result) {
			if (!row.same_result) throw new AppError("delivery_result_changed", 409, "Delivery result was already reported");
		} else await db.query("UPDATE payloadbay.runner_delivery SET result=$2 WHERE id=$1", [id, JSON.stringify(result)]);

		return { recorded: true };
	});
}

export async function sendThroughRunner(
	pool: Pool,
	authority: Authority,
	input: {
		attemptId: string;
		destinationId: string;
		operationId: string;
		method: string;
		headers: Record<string, string>;
		body: Buffer;
	},
	options: { encryptionKey?: string; timeoutMs?: number; signal?: AbortSignal },
) {
	if (!options.encryptionKey) throw new AppError("runner_unavailable", 503, "Runner transport is unavailable");
	if (Object.entries(input.headers).reduce((size, [name, value]) => size + Buffer.byteLength(name) + Buffer.byteLength(value), 0) > 16384) throw new AppError("headers_too_large", 413, "Runner request headers exceed 16 KiB");
	const payload = encryptPrivate(
		{
			method: input.method,
			headers: input.headers,
			bodyBase64: input.body.toString("base64"),
			idempotencyKey: digest(authority.executionId + ":" + input.operationId),
		},
		options.encryptionKey,
	);
	const timeout = Math.min(options.timeoutMs ?? 10000, 30000);
	await transaction(pool, async (db) => {
		await assertAuthority(db, authority, true);
		await db.query("INSERT INTO payloadbay.runner_delivery(id,destination_id,payload,expires_at) VALUES($1,$2,$3,clock_timestamp()+$4*interval '1 millisecond')", [input.attemptId, input.destinationId, payload, timeout]);
	});
	const deadline = performance.now() + timeout;
	try {
		while (performance.now() < deadline && !options.signal?.aborted) {
			const row = (await pool.query("SELECT result FROM payloadbay.runner_delivery WHERE id=$1", [input.attemptId])).rows[0];
			if (row?.result) return row.result as RunnerResult;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		throw new AppError("runner_timeout", 503, "Runner did not report delivery before the deadline");
	} finally {
		await pool.query("UPDATE payloadbay.runner_delivery SET payload=NULL,result=NULL,expires_at=clock_timestamp() WHERE id=$1", [input.attemptId]);
	}
}
