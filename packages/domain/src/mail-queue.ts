import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { snapshotNotificationChannel } from "./email-settings.ts";
import { encryptPrivate } from "./private-crypto.ts";

export async function queueMail(
	pool: Pool,
	key: string,
	payload: {
		email: string;
		otp: string;
		identifier: string;
		verificationHash: string;
		expiresAt: string;
	},
	encryptionKey: string,
	publicUrl?: string,
) {
	return transaction(pool, async (client) => {
		const row = (await client.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,expiry,claim_deadline_at) VALUES('otp_mail',$1,$2,$3,clock_timestamp()+interval '30 seconds') RETURNING *", [encryptPrivate({ ...payload, channelSnapshot: await snapshotNotificationChannel(client, "smtp", publicUrl) }, encryptionKey), key, payload.expiresAt])).rows[0];
		await client.query("SELECT payloadbay.enqueue('platform_job',$1::json,clock_timestamp(),$2,10::smallint)", [JSON.stringify({ jobId: row.id, generation: row.generation }), `platform:${row.id}:${row.generation}`]);

		return row.id as string;
	});
}
