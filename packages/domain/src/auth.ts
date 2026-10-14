import { createHash } from "node:crypto";
import type { Pool } from "pg";

export async function requestLoginCode(pool: Pool, auth: { api: { sendVerificationOTP(input: { body: { email: string; type: "sign-in" } }): Promise<unknown> } }, email: string, limit = 5): Promise<{ success: boolean }> {
	const normalized = email.trim().toLowerCase();
	if (!(await consumeOTPQuota(pool, normalized, limit))) return { success: true };
	const admitted = await pool.query('SELECT u.id FROM auth."user" u JOIN payloadbay.admission a ON a.user_id=u.id WHERE lower(u.email)=$1 AND a.active', [normalized]);
	if (admitted.rowCount)
		try {
			await auth.api.sendVerificationOTP({ body: { email: normalized, type: "sign-in" } });
		} catch {
			console.error("Sign-in mail scheduling failed");
		}

	return { success: true };
}

export async function consumeOTPQuota(pool: Pool, normalized: string, limit: number) {
	const key = createHash("sha256").update(normalized).digest("hex");
	const quota = (
		await pool.query(
			`INSERT INTO payloadbay.auth_request_window(key,window_started_at,count) VALUES($1,clock_timestamp(),1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN payloadbay.auth_request_window.window_started_at<=clock_timestamp()-interval '5 minutes' THEN 1 ELSE payloadbay.auth_request_window.count+1 END,window_started_at=CASE WHEN payloadbay.auth_request_window.window_started_at<=clock_timestamp()-interval '5 minutes' THEN clock_timestamp() ELSE payloadbay.auth_request_window.window_started_at END RETURNING count`,
			[key],
		)
	).rows[0].count;

	return quota <= limit;
}
