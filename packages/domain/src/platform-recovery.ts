import type { Pool } from "pg";
import { transaction } from "./db.ts";

export async function recoverPlatformJobs(pool: Pool) {
	return transaction(pool, async (client) => {
		const candidates = await client.query(`SELECT * FROM payloadbay.platform_job WHERE state IN ('queued','running') AND ((expiry IS NOT NULL AND expiry<=clock_timestamp()) OR(state='running' AND lease_expiry<=clock_timestamp()) OR(state='queued' AND claim_deadline_at<=clock_timestamp())) ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 100`);
		const recovered: string[] = [];
		for (const job of candidates.rows) {
			if (job.expiry && job.expiry.getTime() <= (await client.query("SELECT clock_timestamp() AS now")).rows[0].now.getTime()) {
				await client.query("UPDATE payloadbay.platform_job SET state='expired',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [job.id]);
				await client.query("UPDATE payloadbay.notification_dispatch SET state='skipped' WHERE platform_job_id=$1 AND state='queued'", [job.id]);
				continue;
			}

			if (job.attempt_number >= job.max_attempts) {
				await client.query("UPDATE payloadbay.platform_job SET state='failed',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [job.id]);
				await client.query("UPDATE payloadbay.notification_dispatch SET state='failed' WHERE platform_job_id=$1 AND state='queued'", [job.id]);
				continue;
			}

			const fresh = (await client.query("UPDATE payloadbay.platform_job SET generation=generation+1,state='queued',lease_owner=NULL,lease_expiry=NULL,due_at=clock_timestamp(),claim_deadline_at=clock_timestamp()+interval '30 seconds' WHERE id=$1 AND generation=$2 RETURNING *", [job.id, job.generation])).rows[0];
			if (!fresh) continue;
			await client.query("SELECT payloadbay.enqueue('platform_job',$1::json,$2,$3,$4::smallint)", [JSON.stringify({ jobId: fresh.id, generation: fresh.generation }), fresh.due_at, `platform:${fresh.id}:${fresh.generation}`, job.kind === "otp_mail" || job.kind === "invitation_mail" ? 10 : 30]);
			recovered.push(fresh.id);
		}

		return recovered;
	});
}
