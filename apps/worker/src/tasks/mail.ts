import type { Pool } from "pg";
import nodemailer from "nodemailer";
import { transaction } from "../../../../packages/domain/src/db.ts";
import { decryptPrivate } from "../../../../packages/domain/src/private-crypto.ts";
import { notificationMailMessage } from "./notification-mail.ts";
import type { ServerConfig } from "../../../../packages/domain/src/config.ts";

export function mailTask(pool: Pool, config: ServerConfig) {
	return async (input: unknown) => {
		const payload = input as { jobId?: unknown; generation?: unknown };
		if (!payload || typeof payload.jobId !== "string" || !/^[-0-9a-f]{36}$/i.test(payload.jobId) || typeof payload.generation !== "number" || !Number.isInteger(payload.generation) || payload.generation < 1) throw Error("Invalid mail job reference");
		const job = await transaction(pool, async (client) => {
			const row = (await client.query("UPDATE payloadbay.platform_job SET state='running',attempt_number=attempt_number+1,lease_owner=$3,lease_expiry=clock_timestamp()+interval '30 seconds' WHERE id=$1 AND generation=$2 AND state='queued' AND attempt_number<max_attempts RETURNING *", [payload.jobId, payload.generation, "mail-worker"])).rows[0];

			return row;
		});
		if (!job) return;
		let message: { email: string; subject: string; text: string } | null;
		if (job.kind === "notification_mail") {
			message = await notificationMailMessage(pool, job.id, config);
		} else if (job.kind === "otp_mail") {
			const data = decryptPrivate<{
				email: string;
				otp: string;
				identifier: string;
				verificationHash: string;
				expiresAt: string;
			}>(job.encrypted_payload, config.encryptionKey);
			const allowed = (await pool.query('SELECT value FROM auth.verification WHERE identifier=$1 AND "expiresAt">clock_timestamp()', [data.identifier])).rows[0];
			message = new Date(data.expiresAt).getTime() > Date.now() && allowed?.value.startsWith(data.verificationHash + ":") ? { email: data.email, subject: "Your Payload Bay sign-in code", text: `Your sign-in code is ${data.otp}. It expires in five minutes. If you did not request it, ignore this email.` } : null;
		} else {
			throw Error("Unsupported mail job kind");
		}

		if (!message) {
			await pool.query("UPDATE payloadbay.platform_job SET state='expired',lease_owner=NULL,lease_expiry=NULL WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp()", [job.id, job.generation]);
			if (job.kind === "notification_mail") await pool.query("UPDATE payloadbay.notification_dispatch SET state='skipped' WHERE platform_job_id=$1", [job.id]);

			return;
		}

		const transport = nodemailer.createTransport({
			host: config.smtp.host,
			port: config.smtp.port,
			secure: config.smtp.secure,
			auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
			requireTLS: Boolean(config.smtp.user) && !config.smtp.secure,
			connectionTimeout: 5000,
			socketTimeout: 10000,
		});
		try {
			await transport.sendMail({
				from: config.smtp.from,
				to: message.email,
				subject: message.subject,
				text: message.text,
			});
			const completed = await pool.query("UPDATE payloadbay.platform_job SET state='succeeded',lease_owner=NULL,lease_expiry=NULL WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp()", [job.id, job.generation]);
			if (completed.rowCount && job.kind === "notification_mail") await pool.query("UPDATE payloadbay.notification_dispatch SET state='sent' WHERE platform_job_id=$1", [job.id]);
		} catch {
			await transaction(pool, async (client) => {
				const current = (await client.query("SELECT * FROM payloadbay.platform_job WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp() FOR UPDATE", [job.id, job.generation])).rows[0];
				if (!current) return;
				if (current.attempt_number >= current.max_attempts) {
					await client.query("UPDATE payloadbay.platform_job SET state='failed',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [job.id]);

					return;
				}

				const delay = Math.min(60000, 1000 * 2 ** Math.max(0, current.attempt_number - 1));
				const fresh = (await client.query("UPDATE payloadbay.platform_job SET state='queued',generation=generation+1,lease_owner=NULL,lease_expiry=NULL,due_at=clock_timestamp()+($2::integer*interval '1 millisecond'),claim_deadline_at=clock_timestamp()+($2::integer*interval '1 millisecond')+interval '30 seconds' WHERE id=$1 RETURNING *", [job.id, delay])).rows[0];
				await client.query("SELECT payloadbay.enqueue('platform_job',$1::json,$2,$3,10::smallint)", [JSON.stringify({ jobId: fresh.id, generation: fresh.generation }), fresh.due_at, `platform:${fresh.id}:${fresh.generation}`]);
			});
		} finally {
			transport.close();
		}
	};
}
