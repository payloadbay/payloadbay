import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { assertSetupSecret, bootstrapOwner } from "./bootstrap.ts";
import { consumeOTPQuota } from "./auth.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { createAuth } from "./auth-runtime.ts";
import type { ServerConfig } from "./config.ts";

export async function requestOwnerCode(pool: Pool, identity: ReturnType<typeof createAuth>, config: ServerConfig, input: { secret: string; email: string; name: string }) {
	assertSetupSecret(input.secret, config.bootstrapSecret);
	const email = input.email.trim().toLowerCase();
	if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || !input.name.trim() || input.name.length > 100) throw new AppError("invalid_input", 400, "Provide a name and valid email");

	return transaction(pool, async (db) => {
		await db.query("INSERT INTO payloadbay.installation DEFAULT VALUES ON CONFLICT(singleton) DO NOTHING");
		const installation = (await db.query("SELECT bootstrap_state FROM payloadbay.installation WHERE singleton FOR UPDATE")).rows[0];
		if (installation.bootstrap_state !== "pending") throw new AppError("already_configured", 409, "Instance setup is already complete");
		if (!(await consumeOTPQuota(pool, email, config.otpRequestLimit))) throw new AppError("rate_limited", 429, "Wait before requesting another code");
		const user = (await db.query('SELECT id FROM auth."user" WHERE lower(email)=$1', [email])).rows[0];
		if (!user) await identity.api.createUser({ body: { email, name: input.name.trim() } });
		await identity.api.sendVerificationOTP({ body: { email, type: "sign-in" } });

		return { success: true };
	});
}

export async function completeOwnerSetup(pool: Pool, identity: ReturnType<typeof createAuth>, config: ServerConfig, request: Request, secret: string) {
	assertSetupSecret(secret, config.bootstrapSecret);
	const session = await identity.api.getSession({ headers: request.headers });
	if (!session?.user.emailVerified) throw new AppError("email_verification_required", 403, "Verify your email before completing setup");

	return bootstrapOwner(pool, { userId: session.user.id, providedSecret: secret, expectedSecret: config.bootstrapSecret });
}
