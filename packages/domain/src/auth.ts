import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { AppError } from "../../contracts/src/errors.ts";
import { LOGIN_CODE_COOLDOWN_SECONDS } from "../../contracts/src/auth.ts";

export class LoginCodeRateLimitError extends AppError {
	constructor(public readonly retryAfterSeconds: number) {
		super("rate_limited", 429, "Wait before requesting another sign-in code");
	}
}

export async function requestLoginCode(pool: Pool, auth: { api: { sendVerificationOTP(input: { body: { email: string; type: "sign-in" } }): Promise<unknown> } }, email: string, limit = 5, prepareIdentity?: (email: string) => Promise<boolean>): Promise<{ success: boolean }> {
	const normalized = email.trim().toLowerCase();
	const quota = await reserveOTPRequest(pool, normalized, limit);
	if (!quota.allowed) throw new LoginCodeRateLimitError(quota.retry_after);
	const admitted = await pool.query('SELECT u.id FROM auth."user" u JOIN payloadbay.admission a ON a.user_id=u.id WHERE lower(u.email)=$1 AND a.active', [normalized]);
	try {
		if (admitted.rowCount || (await prepareIdentity?.(normalized))) await auth.api.sendVerificationOTP({ body: { email: normalized, type: "sign-in" } });
	} catch {
		console.error("Sign-in mail scheduling failed");
	}

	return { success: true };
}

async function reserveOTPRequest(pool: Pool, normalized: string, limit: number) {
	const key = createHash("sha256").update(normalized).digest("hex");
	const result = await pool.query<{ allowed: boolean; retry_after: number }>(
		`WITH quota AS (
			INSERT INTO payloadbay.auth_request_window(key,window_started_at,count) VALUES($1,clock_timestamp(),1)
			ON CONFLICT(key) DO UPDATE SET
				count=CASE WHEN payloadbay.auth_request_window.window_started_at<=clock_timestamp()-interval '5 minutes' THEN 1 ELSE payloadbay.auth_request_window.count+1 END,
				window_started_at=CASE WHEN payloadbay.auth_request_window.window_started_at<=clock_timestamp()-interval '5 minutes' THEN clock_timestamp() ELSE payloadbay.auth_request_window.window_started_at END
			RETURNING count,window_started_at
		), cooldown AS (
			INSERT INTO payloadbay.auth_request_window(key,window_started_at,count)
			SELECT $3,clock_timestamp(),1 FROM quota WHERE count<=$2
			ON CONFLICT(key) DO UPDATE SET window_started_at=EXCLUDED.window_started_at
			WHERE payloadbay.auth_request_window.window_started_at<=clock_timestamp()-make_interval(secs=>$4::int)
			RETURNING key
		)
		SELECT count<=$2 AND EXISTS(SELECT 1 FROM cooldown) AS allowed,
			CASE WHEN count>$2 THEN greatest(1,ceil(extract(epoch FROM(window_started_at+interval '5 minutes'-clock_timestamp()))))::int ELSE $4::int END AS retry_after
		FROM quota`,
		[key, limit, "otp-cooldown:" + key, LOGIN_CODE_COOLDOWN_SECONDS],
	);

	return result.rows[0];
}

export async function consumeOTPQuota(pool: Pool, normalized: string, limit: number) {
	return (await reserveOTPRequest(pool, normalized, limit)).allowed;
}
