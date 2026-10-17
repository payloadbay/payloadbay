import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { encryptPrivate } from "./private-crypto.ts";
import { platformJobPriority } from "./platform-jobs.ts";
import type { ServerConfig } from "./config.ts";
import { transaction } from "./db.ts";

const batchSize = 100;

/** Peers share a database-clock hourly key; disabled installations enqueue nothing. */
export async function queueEventRetention(pool: Pool, config: ServerConfig) {
	if (config.eventRetentionDays === 0) return;

	return transaction(pool, async (db) => {
		const installation = (await db.query("SELECT id, floor(extract(epoch FROM statement_timestamp())/3600)::bigint::text AS hour FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
		if (!installation) return;

		return enqueueRetentionJob(db, `event-retention:${installation.id}:${config.eventRetentionDays}:${installation.hour}`, config.encryptionKey);
	});
}

async function enqueueRetentionJob(db: PoolClient, key: string, encryptionKey: string) {
	const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('event_retention',$1,$2) ON CONFLICT(job_key) DO NOTHING RETURNING id,generation,due_at", [encryptPrivate({}, encryptionKey), key])).rows[0];
	if (job) await db.query("SELECT payloadbay.enqueue('platform_job',$1::json,$2,$3,$4::smallint)", [JSON.stringify({ jobId: job.id, generation: job.generation }), job.due_at, `platform:${job.id}:${job.generation}`, platformJobPriority("event_retention")]);

	return job ?? null;
}

/** Database-only maintenance commits deletion, audit and job completion together. */
export async function runEventRetention(pool: Pool, config: ServerConfig, reference: { id: string; generation: number }) {
	return transaction(pool, async (db) => {
		await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
		const job = (await db.query("SELECT * FROM payloadbay.platform_job WHERE id=$1 AND generation=$2 AND kind='event_retention' AND state='running' AND lease_expiry>clock_timestamp() FOR UPDATE", [reference.id, reference.generation])).rows[0];
		if (!job) return;
		const installation = (await db.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
		let removed = 0;
		const expired = Boolean(job.expiry && job.expiry.getTime() <= Date.now()) || !installation;
		if (!expired && config.eventRetentionDays > 0) {
			removed = z
				.number()
				.int()
				.min(0)
				.max(batchSize)
				.parse((await db.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-$1::int*interval '24 hours',$2::int) AS removed", [config.eventRetentionDays, batchSize])).rows[0].removed);
			if (removed === batchSize) await enqueueRetentionJob(db, `event-retention-next:${job.id}`, config.encryptionKey);
			if (removed > 0) await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES('system:retention','instance',$1,'events.retained-history.pruned',$2,$3)", [installation.id, job.id, JSON.stringify({ removed, eventRetentionDays: config.eventRetentionDays })]);
		}

		const finished = await db.query("UPDATE payloadbay.platform_job SET state=$3,last_error=NULL,lease_owner=NULL,lease_expiry=NULL WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp()", [job.id, job.generation, expired ? "expired" : "succeeded"]);
		if (finished.rowCount !== 1) throw Error("Maintenance lease expired");

		return { removed };
	});
}
