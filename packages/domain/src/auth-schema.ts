import { passkey } from "@better-auth/passkey";
import type { BetterAuthOptions } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import type { Pool } from "pg";

export function authSchemaOptions(pool: Pool): BetterAuthOptions {
	return {
		database: pool,
		emailAndPassword: { enabled: false },
		plugins: [
			admin(),
			passkey(),
			emailOTP({
				disableSignUp: true,
				expiresIn: 300,
				allowedAttempts: 5,
				storeOTP: "hashed",
				sendVerificationOTP: async () => {
					throw Error("SMTP handler is required");
				},
			}),
		],
		rateLimit: { enabled: true, storage: "database" },
		logger: { disabled: true },
	};
}
