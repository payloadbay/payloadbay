import { passkeyPolicyRequired } from "./organization-security.ts";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError, getSessionFromCtx } from "better-auth/api";
import { Pool } from "pg";
import { createHmac, randomUUID } from "node:crypto";
import { authSchemaOptions } from "./auth-schema.ts";
import { queueMail } from "./mail-queue.ts";
import { requestLoginCode, LoginCodeRateLimitError } from "./auth.ts";
import type { ServerConfig } from "./config.ts";

export function createAuth(pool: Pool, config: ServerConfig, sharedIdentityPool?: Pool) {
	const identityPool =
		sharedIdentityPool ??
		new Pool({
			connectionString: config.databaseUrl,
			options: "-c search_path=auth",
			connectionTimeoutMillis: 5000,
			statement_timeout: 10000,
			idle_in_transaction_session_timeout: 10000,
		});
	if (!sharedIdentityPool) identityPool.on("error", () => console.error("Authentication database connection unavailable"));
	const auth = betterAuth({
		...authSchemaOptions(identityPool),
		secret: config.authSecret,
		baseURL: config.publicUrl,
		basePath: "/api/auth",
		trustedOrigins: [new URL(config.publicUrl).origin],
		session: { expiresIn: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60, cookieCache: { enabled: false } },
		socialProviders: Object.fromEntries(Object.entries(config.oauth).map(([name, client]) => [name, name === "tiktok" ? { ...client, clientId: undefined, clientKey: client.clientId } : client])),
		account: { accountLinking: { enabled: true, requireLocalEmailVerified: true, allowDifferentEmails: false } },
		databaseHooks: {
			session: {
				create: {
					before: async (session) => {
						const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
						if (installation) {
							const admission = (await pool.query("SELECT active FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2", [installation.id, session.userId])).rows[0];
							if (!admission?.active) {
								const user = (await pool.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1', [session.userId])).rows[0];
								if (admission || config.registrationPolicy !== "organization" || !user?.emailVerified) throw new APIError("FORBIDDEN", { message: "Your instance access is not active" });
							}
						}

						return { data: session };
					},
				},
			},
			user: {
				create: {
					before: async (user, ctx) => {
						if (ctx?.path !== "/admin/create-user" || ctx.request || ctx.headers) throw new APIError("FORBIDDEN", { message: "Registration is disabled" });

						return { data: user };
					},
				},
			},
		},
		plugins: [
			admin(),
			passkey({ rpID: new URL(config.publicUrl).hostname, rpName: "Payload Bay", origin: new URL(config.publicUrl).origin }),
			emailOTP({
				disableSignUp: true,
				expiresIn: 300,
				allowedAttempts: 5,
				storeOTP: { hash: async (otp) => createHmac("sha256", config.authSecret).update(otp).digest("base64url") },
				resendStrategy: "rotate",
				sendVerificationOTP: async ({ email, otp, type }) => {
					if (type !== "sign-in") throw Error("Only sign-in codes are supported");
					const identifier = "sign-in-otp-" + email;
					const verificationHash = createHmac("sha256", config.authSecret).update(otp).digest("base64url");
					const record = (await pool.query('SELECT "expiresAt" FROM auth.verification WHERE identifier=$1 ORDER BY "createdAt" DESC LIMIT 1', [identifier])).rows[0];
					if (!record) throw Error("Verification state is unavailable");
					await queueMail(
						pool,
						"otp:" + randomUUID(),
						{
							email,
							otp,
							identifier,
							verificationHash,
							expiresAt: record.expiresAt.toISOString(),
						},
						config.encryptionKey,
						config.publicUrl,
					);
				},
			}),
		],
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path.startsWith("/admin/") && (ctx.request || ctx.headers)) throw new APIError("NOT_FOUND", { message: "Resource unavailable" });
				if (ctx.path.includes("forget-password") || ctx.path.includes("reset-password") || ctx.path.includes("sign-up")) throw new APIError("NOT_FOUND", { message: "This authentication method is unavailable" });

				if (ctx.path === "/passkey/delete-passkey") {
					const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
					if (session && (await passkeyPolicyRequired(pool, session.user.id))) {
						const count = Number((await pool.query('SELECT count(*) FROM auth.passkey WHERE "userId"=$1', [session.user.id])).rows[0].count);
						if (count <= 1) throw new APIError("BAD_REQUEST", { message: "Your organization requires at least one registered passkey" });
					}
				}

				if (ctx.path === "/sign-in/email-otp") {
					const email = String(ctx.body?.email ?? "")
						.trim()
						.toLowerCase();
					const record = (await pool.query('SELECT "expiresAt","expiresAt">clock_timestamp() AS live FROM auth.verification WHERE identifier=$1 ORDER BY "createdAt" DESC LIMIT 1', ["sign-in-otp-" + email])).rows[0];
					if (!record?.live || new Date(record.expiresAt).getTime() <= Date.now()) throw new APIError("BAD_REQUEST", { message: "Code is invalid or expired" });
				}
			}),
		},
		advanced: { useSecureCookies: new URL(config.publicUrl).protocol === "https:", ipAddress: { ipAddressHeaders: [] } },
		logger: { disabled: true },
	});

	return {
		databasePool: identityPool,
		auth,
		api: auth.api,
		async handler(request: Request) {
			const pathname = new URL(request.url).pathname;
			if (pathname.startsWith("/api/auth/admin/")) return Response.json({ error: { code: "not_found", message: "Resource unavailable" } }, { status: 404 });
			if (pathname === "/api/auth/email-otp/send-verification-otp" && request.method === "POST") {
				if (request.headers.get("origin") && request.headers.get("origin") !== new URL(config.publicUrl).origin) return Response.json({ error: { code: "invalid_origin", message: "Request origin is not allowed" } }, { status: 403 });
				const body = await request.json().catch(() => null);
				if (!body || typeof body.email !== "string" || body.email.length > 254 || body.type !== "sign-in") return Response.json({ error: { code: "invalid_input", message: "Check the submitted values" } }, { status: 400 });

				try {
					return Response.json(
						await requestLoginCode(
							pool,
							auth,
							body.email,
							config.otpRequestLimit,
							config.registrationPolicy === "organization"
								? async (email) => {
										let user = (await pool.query('SELECT id FROM auth."user" WHERE lower(email)=$1', [email])).rows[0];
										if (!user) {
											try {
												user = (await auth.api.createUser({ body: { email, name: email.split("@")[0] } })).user;
											} catch (error) {
												user = (await pool.query('SELECT id FROM auth."user" WHERE lower(email)=$1', [email])).rows[0];
												if (!user) throw error;
											}
										}

										return !(await pool.query("SELECT 1 FROM payloadbay.admission WHERE user_id=$1", [user.id])).rowCount;
									}
								: undefined,
						),
					);
				} catch (error) {
					if (error instanceof LoginCodeRateLimitError) return Response.json({ error: { code: error.code, message: error.publicMessage } }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
					throw error;
				}
			}

			return auth.handler(request);
		},
		async close() {
			await identityPool.end();
		},
	};
}
