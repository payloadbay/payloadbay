import { authFixture, identity, fixtureConfig, setupSecret } from "../helpers/auth-fixtures.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";

test("U40 concurrent setup creates exactly one owner", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "owner-a");
		await identity(f.db, "owner-b");
		const results = await Promise.allSettled(["owner-a", "owner-b"].map((userId) => bootstrapOwner(f.pool, { userId, providedSecret: setupSecret, expectedSecret: setupSecret })));
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.grant_record WHERE role_preset='owner'")).rows[0].count, 1);
	});
});

test("U41 invalid setup secret cannot create owner", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "owner-a");
		await assert.rejects(bootstrapOwner(f.pool, { userId: "owner-a", providedSecret: "wrong-secret", expectedSecret: setupSecret }), { code: "invalid_setup_secret", status: 403 });
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.grant_record")).rows[0].count, 0);
	});
});

test("U42 unverified email cannot become instance owner", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "owner-unverified", false);
		await assert.rejects(bootstrapOwner(f.pool, { userId: "owner-unverified", providedSecret: setupSecret, expectedSecret: setupSecret }), { code: "email_verification_required", status: 403 });
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.grant_record")).rows[0].count, 0);
	});
});

test("U213 auth migration supports provisioning and durable rate policy", async () => {
	await authFixture(async (f) => {
		assert.ok((await f.db.query("SELECT to_regclass('payloadbay.auth_request_window') AS table_name")).rows[0].table_name);
		assert.ok((await f.db.query("SELECT to_regclass('auth.\"rateLimit\"') AS table_name")).rows[0].table_name);
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='auth' AND table_name='user' AND column_name='role'")).rows[0].count, 1);
	});
});

import { requestLoginCode } from "../../packages/domain/src/auth.ts";

test("U43 code request responses do not disclose membership", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const auth = { api: { sendVerificationOTP: async () => ({ success: true }) } };
		const known = await requestLoginCode(f.pool, auth, "operator@example.test");
		const unknown = await requestLoginCode(f.pool, auth, "unknown@example.test");
		assert.deepEqual(known, { success: true });
		assert.deepEqual(unknown, known);
	});
});

test("U214 active admitted account requests Better Auth code", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const requests: unknown[] = [];
		await requestLoginCode(
			f.pool,
			{
				api: {
					sendVerificationOTP: async (input) => {
						requests.push(input);

						return { success: true };
					},
				},
			},
			"OPERATOR@example.test",
		);
		assert.deepEqual(requests, [{ body: { email: "operator@example.test", type: "sign-in" } }]);
	});
});

test("U215 per email request quota is durable", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		let sends = 0;
		const auth = {
			api: {
				sendVerificationOTP: async () => {
					sends++;

					return { success: true };
				},
			},
		};
		await requestLoginCode(f.pool, auth, "operator@example.test", 1);
		await requestLoginCode(f.pool, auth, "operator@example.test", 1);
		assert.equal(sends, 1);
		assert.equal((await f.db.query("SELECT count FROM payloadbay.auth_request_window")).rows[0].count, 2);
	});
});

import { encryptPrivate, decryptPrivate } from "../../packages/domain/src/private-crypto.ts";

test("U216 durable mail payload is encrypted and authenticated", () => {
	const key = "fixture-encryption-key-32-characters";
	const message = { email: "operator@example.test", otp: "123456" };
	const stored = encryptPrivate(message, key);
	assert.equal(stored.includes(Buffer.from(message.otp)), false);
	assert.deepEqual(decryptPrivate(stored, key), message);
	const tampered = Buffer.from(stored);
	tampered[tampered.length - 1] ^= 1;
	assert.throws(() => decryptPrivate(tampered, key));
});

import { queueMail } from "../../packages/domain/src/mail-queue.ts";

test("U217 OTP mail creates encrypted recoverable dispatch", async () => {
	await authFixture(async (f) => {
		const key = "fixture-encryption-key-32-characters";
		const id = await queueMail(
			f.pool,
			"fixture-otp-job",
			{
				email: "operator@example.test",
				otp: "123456",
				identifier: "sign-in-otp-operator@example.test",
				verificationHash: "fixture-hash",
				expiresAt: new Date(Date.now() + 300000).toISOString(),
			},
			key,
		);
		const job = (await f.db.query("SELECT * FROM payloadbay.platform_job WHERE id=$1", [id])).rows[0];
		assert.equal(job.state, "queued");
		assert.equal(job.encrypted_payload.includes(Buffer.from("123456")), false);
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs WHERE task_identifier='platform_job'")).rows[0].count, 1);
	});
});

import { createAuth } from "../../packages/domain/src/auth-runtime.ts";

test("U218 private provisioning creates non admitted identity", async () => {
	await authFixture(async (f) => {
		const service = createAuth(f.pool, fixtureConfig(f));
		try {
			const result = await service.api.createUser({ body: { email: "invited@example.test", name: "Invited" } });
			assert.equal(result.user.email, "invited@example.test");
			assert.equal(result.user.emailVerified, false);
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.admission")).rows[0].count, 0);
		} finally {
			await service.close();
		}
	});
});

import { platformJobTask } from "../../apps/worker/src/tasks/platform-job.ts";

test("U48 expired queued OTP mail is not sent", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const jobId = await queueMail(
			f.pool,
			"fixture-expired-otp",
			{
				email: "operator@example.test",
				otp: "123456",
				identifier: "sign-in-otp-operator@example.test",
				verificationHash: "fixture-hash",
				expiresAt: new Date(Date.now() - 1000).toISOString(),
			},
			config.encryptionKey,
		);
		await platformJobTask(f.pool, config)({ jobId, generation: 1 });
		assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [jobId])).rows[0].state, "expired");
		assert.equal((await (await fetch(f.mailUrl + "/api/v1/messages")).json()).total, 0);
	});
});

test("U219 stored OTP verifier is keyed outside database", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const payload = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload;
			const mail = decryptPrivate<{ otp: string }>(payload, config.encryptionKey);
			const verification = (await f.db.query("SELECT value FROM auth.verification")).rows[0].value;
			assert.equal(verification.split(":")[0], createHmac("sha256", config.authSecret).update(mail.otp).digest("base64url"));
		} finally {
			await service.close();
		}
	});
});

import { createHmac } from "node:crypto";

test("U44 OTP one millisecond before expiry may verify", async (t) => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const verification = (await f.db.query('SELECT "expiresAt" FROM auth.verification')).rows[0];
			const job = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0];
			const payload = decryptPrivate<{ otp: string }>(job.encrypted_payload, config.encryptionKey);
			t.mock.timers.enable({ apis: ["Date"], now: verification.expiresAt.getTime() - 1 });
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: payload.otp }) }));
			assert.equal(response.status, 200);
		} finally {
			t.mock.timers.reset();
			await service.close();
		}
	});
});

test("U45 OTP at five minute expiry is rejected", async (t) => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const verification = (await f.db.query('SELECT "expiresAt" FROM auth.verification')).rows[0];
			const payload = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			t.mock.timers.enable({ apis: ["Date"], now: verification.expiresAt.getTime() });
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: payload.otp }) }));
			assert.equal(response.status, 400);
		} finally {
			t.mock.timers.reset();
			await service.close();
		}
	});
});

test("U220 scheduling failure preserves generic code response", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const response = await requestLoginCode(
			f.pool,
			{
				api: {
					sendVerificationOTP: async () => {
						throw Error("fixture scheduling failure");
					},
				},
			},
			"operator@example.test",
		);
		assert.deepEqual(response, { success: true });
	});
});

test("U46 fifth verification attempt remains within limit", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const payload = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			await f.db.query("UPDATE auth.verification SET value=split_part(value,':',1)||':4'");
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: payload.otp }) }));
			assert.equal(response.status, 200);
		} finally {
			await service.close();
		}
	});
});

test("U47 sixth verification attempt is rejected", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const payload = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			await f.db.query("UPDATE auth.verification SET value=split_part(value,':',1)||':5'");
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: payload.otp }) }));
			assert.equal(response.status, 403);
		} finally {
			await service.close();
		}
	});
});

import { runOnce } from "../../apps/worker/node_modules/graphile-worker/dist/index.js";

test("U221 trusted OTP job sends current code through SMTP", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			await runOnce({
				pgPool: f.pool,
				noHandleSignals: true,
				concurrency: 1,
				taskList: { platform_job: platformJobTask(f.pool, config) },
			});
			let messages: any;
			for (let i = 0; i < 50; i++) {
				messages = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
				if (messages.total) break;
				await new Promise((r) => setTimeout(r, 20));
			}

			assert.equal(messages.total, 1);
			assert.equal(messages.messages[0].Subject, "Your Payload Bay sign-in code");
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job")).rows[0].state, "succeeded");
		} finally {
			await service.close();
		}
	});
});

test("A3 admitted operator signs in through SMTP code", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const request = await service.handler(new Request(config.publicUrl + "/api/auth/email-otp/send-verification-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", type: "sign-in" }) }));
			assert.equal(request.status, 200);
			await runOnce({
				pgPool: f.pool,
				noHandleSignals: true,
				concurrency: 1,
				taskList: { platform_job: platformJobTask(f.pool, config) },
			});
			const messages = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
			assert.equal(messages.total, 1);
			const message = await (await fetch(f.mailUrl + "/api/v1/message/" + messages.messages[0].ID)).json();
			assert.match(message.HTML, /email-card/, "Login mail uses the shared branded HTML wrapper");
			const otp = message.Text.match(/\b\d{6}\b/)?.[0];
			assert.ok(otp, "SMTP message must contain a login code");
			const signed = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp }) }));
			assert.equal(signed.status, 200);
			const cookies = signed.headers.getSetCookie();
			assert.ok(cookies.some((cookie) => cookie.includes("HttpOnly")));
			const session = await service.api.getSession({ headers: new Headers({ cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") }) });
			assert.equal(session?.user.id, "operator");
			const registration = await service.handler(new Request(config.publicUrl + "/api/auth/sign-up/email", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "uninvited@example.test", name: "Uninvited", password: "fixture-not-enabled" }) }));
			assert.equal(registration.status, 404);
		} finally {
			await service.close();
		}
	});
});

test("U222 malformed mail reference fails before SQL", async () => {
	await authFixture(async (f) => {
		await assert.rejects(platformJobTask(f.pool, fixtureConfig(f))({ jobId: "operator@example.test", generation: 1 }), /Invalid mail job reference/);
		assert.equal((await (await fetch(f.mailUrl + "/api/v1/messages")).json()).total, 0);
	});
});

test("U224 superseded queued OTP code is not sent", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const job = (await f.db.query("SELECT id,generation FROM payloadbay.platform_job")).rows[0];
			await f.db.query("UPDATE auth.verification SET value='superseded-verifier:0'");
			await platformJobTask(f.pool, config)({ jobId: job.id, generation: job.generation });
			assert.equal((await (await fetch(f.mailUrl + "/api/v1/messages")).json()).total, 0);
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job")).rows[0].state, "expired");
		} finally {
			await service.close();
		}
	});
});

test("U49 unverified matching email never links OAuth implicitly", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator", false);
		const config = fixtureConfig(f);
		config.oauth = {
			google: {
				clientId: "fixture-client",
				clientSecret: "fixture-secret",
				getUserInfo: async () => ({
					user: {
						id: "fixture-google-user",
						name: "Operator",
						email: "operator@example.test",
						emailVerified: true,
					},
					data: { sub: "fixture-google-user", email: "operator@example.test", email_verified: true },
				}),
			},
		} as typeof config.oauth;
		const service = createAuth(f.pool, config);
		const previous = globalThis.fetch;
		try {
			const authorization = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/social", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ provider: "google", callbackURL: config.publicUrl + "/dashboard" }) }));
			assert.equal(authorization.status, 200);
			const details = await authorization.json();
			const state = new URL(details.url).searchParams.get("state");
			assert.ok(state);
			const cookie = authorization.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			globalThis.fetch = (async (input) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "fixture-access-token", token_type: "Bearer", expires_in: 3600 });
				throw Error("Unexpected OAuth network request");
			}) as typeof fetch;
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/callback/google?code=fixture-code&state=" + encodeURIComponent(state), { headers: { cookie } }));
			assert.equal(response.status, 302);
			assert.equal(new URL(response.headers.get("location")!).searchParams.get("error"), "account_not_linked");
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM auth.account")).rows[0].count, 0);
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM auth.session")).rows[0].count, 0);
		} finally {
			globalThis.fetch = previous;
			await service.close();
		}
	});
});

test("U50 public registration stays disabled", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-up/email", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "uninvited@example.test", name: "Uninvited", password: "fixture-password-strong" }) }));
			assert.equal(response.status, 404);
			assert.equal((await f.db.query('SELECT count(*)::int AS count FROM auth."user"')).rows[0].count, 0);
		} finally {
			await service.close();
		}
	});
});

test("U225 mail worker reads OTP state without session access", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const service = createAuth(f.pool, fixtureConfig(f));
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			await f.db.query("SET ROLE payloadbay_worker");
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM auth.verification")).rows[0].count, 1);
			await assert.rejects(f.db.query("SELECT * FROM auth.session"), { code: "42501" });
			await f.db.query("RESET ROLE");
			const job = (await f.db.query("SELECT attempt_number,max_attempts FROM payloadbay.platform_job")).rows[0];
			assert.deepEqual(job, { attempt_number: 0, max_attempts: 5 });
		} finally {
			await f.db.query("RESET ROLE");
			await service.close();
		}
	});
});

import { recoverPlatformJobs } from "../../packages/domain/src/platform-recovery.ts";

test("U226 expired platform ownership gets fresh generation", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const id = await queueMail(
			f.pool,
			"fixture-recover-mail",
			{
				email: "operator@example.test",
				otp: "123456",
				identifier: "fixture",
				verificationHash: "fixture",
				expiresAt: new Date(Date.now() + 300000).toISOString(),
			},
			config.encryptionKey,
		);
		await f.db.query("UPDATE payloadbay.platform_job SET state='running',lease_owner='dead-fixture',lease_expiry=clock_timestamp() WHERE id=$1", [id]);
		assert.deepEqual(await recoverPlatformJobs(f.pool), [id]);
		const job = (await f.db.query("SELECT state,generation,lease_owner FROM payloadbay.platform_job WHERE id=$1", [id])).rows[0];
		assert.deepEqual(job, { state: "queued", generation: 2, lease_owner: null });
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs WHERE key=$1", ["platform:" + id + ":2"])).rows[0].count, 1);
	});
});

test("U227 claimed mail increments bounded attempt count", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const job = (await f.db.query("SELECT id,generation FROM payloadbay.platform_job")).rows[0];
			await platformJobTask(f.pool, config)({ jobId: job.id, generation: job.generation });
			assert.equal((await f.db.query("SELECT attempt_number FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].attempt_number, 1);
		} finally {
			await service.close();
		}
	});
});

test("U228 SMTP failure schedules fresh delayed retry", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const job = (await f.db.query("SELECT id,generation FROM payloadbay.platform_job")).rows[0];
			await platformJobTask(f.pool, { ...config, smtp: { ...config.smtp, user: "fixture-invalid", password: "fixture-invalid" } })({ jobId: job.id, generation: job.generation });
			const retry = (await f.db.query("SELECT state,generation,due_at>clock_timestamp() AS delayed FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0];
			assert.deepEqual(retry, { state: "queued", generation: 2, delayed: true });
		} finally {
			await service.close();
		}
	});
});

test("U229 fifth failed mail attempt is terminal", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const job = (await f.db.query("SELECT id,generation FROM payloadbay.platform_job")).rows[0];
			await f.db.query("UPDATE payloadbay.platform_job SET attempt_number=4 WHERE id=$1", [job.id]);
			await platformJobTask(f.pool, { ...config, smtp: { ...config.smtp, user: "fixture-invalid", password: "fixture-invalid" } })({ jobId: job.id, generation: job.generation });
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].state, "failed");
		} finally {
			await service.close();
		}
	});
});

import { startRecovery } from "../../apps/worker/src/recovery.ts";

test("U230 supervisor automatically recovers mail dispatch", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const id = await queueMail(
			f.pool,
			"fixture-orphaned-mail",
			{
				email: "operator@example.test",
				otp: "123456",
				identifier: "fixture",
				verificationHash: "fixture",
				expiresAt: new Date(Date.now() + 300000).toISOString(),
			},
			config.encryptionKey,
		);
		await f.db.query("UPDATE payloadbay.platform_job SET state='running',lease_owner='dead-worker',lease_expiry=clock_timestamp() WHERE id=$1", [id]);
		const recovery = startRecovery(f.pool);
		const started = performance.now();
		let generation = 1;
		try {
			while (performance.now() - started < 6500) {
				generation = (await f.db.query("SELECT generation FROM payloadbay.platform_job WHERE id=$1", [id])).rows[0].generation;
				if (generation === 2) break;
				await new Promise((r) => setTimeout(r, 50));
			}

			assert.equal(generation, 2, "automatic supervisor must recover mail");
		} finally {
			await recovery.stop();
		}
	});
});

test("U234 owner setup code is secret protected and closes permanently", async () => {
	const setup = await import("../../packages/domain/src/setup.ts");
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const input = { secret: setupSecret, email: "first@example.test", name: "First" };
			await assert.rejects(setup.requestOwnerCode(f.pool, service, config, { ...input, secret: "wrong" }), { code: "invalid_setup_secret" });
			assert.equal((await f.db.query('SELECT count(*)::int AS n FROM auth."user"')).rows[0].n, 0);
			await setup.requestOwnerCode(f.pool, service, config, input);
			const mail = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: input.email, otp: mail.otp }) }));
			assert.equal(response.status, 200);
			const cookies = response.headers
				.getSetCookie()
				.map((cookie) => cookie.split(";")[0])
				.join("; ");
			await setup.completeOwnerSetup(f.pool, service, config, new Request(config.publicUrl + "/api/v1/bootstrap", { headers: { cookie: cookies } }), setupSecret);
			await assert.rejects(setup.requestOwnerCode(f.pool, service, config, input), { code: "already_configured" });
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE role_preset='owner'")).rows[0].n, 1);
		} finally {
			await service.close();
		}
	});
});

test("U235 request authentication denies anonymous and inactive sessions", async () => {
	const { authenticateRequest } = await import("../../packages/domain/src/principal.ts");
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			assert.equal(await authenticateRequest(f.pool, service, new Request(config.publicUrl + "/api/v1/me")), null);
			await identity(f.db, "operator");
			await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const mail = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			const signed = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: mail.otp }) }));
			assert.equal(signed.status, 200);
			const headers = {
				cookie: signed.headers
					.getSetCookie()
					.map((cookie) => cookie.split(";")[0])
					.join("; "),
			};
			const request = new Request(config.publicUrl + "/api/v1/me", { headers });
			assert.equal((await authenticateRequest(f.pool, service, request))?.userId, "operator");
			const lifetime = 30 * 24 * 60 * 60 * 1000;
			const initial = (await f.db.query('SELECT "expiresAt" FROM auth.session WHERE "userId"=$1', ["operator"])).rows[0];
			assert.ok(Math.abs(new Date(initial.expiresAt).getTime() - Date.now() - lifetime) < 60_000);
			await f.db.query(`UPDATE auth.session SET "expiresAt"=now()+interval '28 days', "updatedAt"=now()-interval '2 days' WHERE "userId"=$1`, ["operator"]);
			const renewedHeaders = new Headers();
			assert.equal((await authenticateRequest(f.pool, service, request, renewedHeaders))?.userId, "operator");
			assert.ok(renewedHeaders.getSetCookie().some((cookie) => cookie.includes("session_token=") && cookie.includes("Max-Age=2592000")));
			const renewed = (await f.db.query('SELECT "expiresAt" FROM auth.session WHERE "userId"=$1', ["operator"])).rows[0];
			assert.ok(Math.abs(new Date(renewed.expiresAt).getTime() - Date.now() - lifetime) < 60_000);
			const unchangedHeaders = new Headers();
			await authenticateRequest(f.pool, service, request, unchangedHeaders);
			assert.equal(unchangedHeaders.getSetCookie().length, 0);
			await f.db.query("UPDATE payloadbay.admission SET active=false");
			assert.equal(await authenticateRequest(f.pool, service, request), null);
			assert.equal(await authenticateRequest(f.pool, service, new Request(request, { headers: { ...headers, authorization: "Bearer invalid" } })), null);
		} finally {
			await service.close();
		}
	});
});

test("invitations keep project access pending until verified acceptance and support cancellation", async () => {
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	const { createInvitation, acceptInvitation, cancelInvitation, invitationDetails, listInvitations } = await import("../../packages/domain/src/invitations.ts");
	const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	const { actorPermissions } = await import("../../packages/domain/src/membership.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const scope = await seedScope(f.db);
			await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, rolePermissions.owner]);
			const actor = { userId: "fixture-owner" };
			const project = { type: "project" as const, id: scope.project };
			const invite = await createInvitation(f.pool, actor, { scope: project, email: "invited@example.test", grants: [{ scope: project, role: "operator", permissions: rolePermissions.operator }] }, service, config.encryptionKey, config.publicUrl);
			const user = (await f.db.query('SELECT id FROM auth."user" WHERE email=$1', [invite.email])).rows[0];
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE user_id=$1", [user.id])).rows[0].n, 0);
			assert.equal((await listInvitations(f.pool, actor, project)).length, 1);
			const job = (await f.db.query("SELECT * FROM payloadbay.platform_job WHERE kind='invitation_mail'")).rows[0];
			const data = decryptPrivate<{ url: string }>(job.encrypted_payload, config.encryptionKey);
			const token = new URL(data.url).pathname.split("/").at(-1)!;
			assert.equal((await invitationDetails(f.pool, token)).email, invite.email);
			await platformJobTask(f.pool, config)({ jobId: job.id, generation: job.generation });
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].state, "succeeded");
			await assert.rejects(acceptInvitation(f.pool, { userId: user.id }, token), { code: "invitation_identity" });
			await f.db.query('UPDATE auth."user" SET "emailVerified"=true WHERE id=$1', [user.id]);
			await acceptInvitation(f.pool, { userId: user.id }, token);
			assert.equal((await actorPermissions(f.pool, { userId: user.id }, project)).has("events.replay"), true);
			assert.equal((await actorPermissions(f.pool, { userId: user.id }, { type: "instance", id: scope.installation })).size, 0);
			await assert.rejects(acceptInvitation(f.pool, { userId: user.id }, token), { code: "invitation_identity" });
			const cancelled = await createInvitation(f.pool, actor, { scope: project, email: "cancelled@example.test", grants: [{ scope: project, role: "viewer", permissions: rolePermissions.viewer }] }, service, config.encryptionKey, config.publicUrl);
			await cancelInvitation(f.pool, actor, cancelled.id);
			assert.equal((await listInvitations(f.pool, actor, project)).length, 0);
			assert.equal((await f.db.query('SELECT a.active FROM payloadbay.admission a JOIN auth."user" u ON u.id=a.user_id WHERE u.email=$1', [cancelled.email])).rows[0].active, false);
		} finally {
			await service.close();
		}
	});
});

test("invitation acceptance rechecks the issuer's authority and cannot cross the chosen scope", async () => {
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	const { createInvitation, acceptInvitation } = await import("../../packages/domain/src/invitations.ts");
	const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const scope = await seedScope(f.db);
			await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, rolePermissions.owner]);
			const project = { type: "project" as const, id: scope.project };
			const actor = { userId: "fixture-owner" };
			await assert.rejects(createInvitation(f.pool, actor, { scope: project, email: "wrong@example.test", grants: [{ scope: { type: "instance", id: scope.installation }, role: "owner", permissions: rolePermissions.owner }] }, service, config.encryptionKey, config.publicUrl), { code: "invalid_scope" });
			await createInvitation(f.pool, actor, { scope: project, email: "later@example.test", grants: [{ scope: project, role: "viewer", permissions: rolePermissions.viewer }] }, service, config.encryptionKey, config.publicUrl);
			const job = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE kind='invitation_mail'")).rows[0];
			const token = new URL(decryptPrivate<{ url: string }>(job.encrypted_payload, config.encryptionKey).url).pathname.split("/").at(-1)!;
			const user = (await f.db.query('UPDATE auth."user" SET "emailVerified"=true WHERE email=$1 RETURNING id', ["later@example.test"])).rows[0];
			await f.db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY['metadata.read'] WHERE user_id='fixture-owner'");
			await assert.rejects(acceptInvitation(f.pool, { userId: user.id }, token), { code: "forbidden" });
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE user_id=$1", [user.id])).rows[0].n, 0);
		} finally {
			await service.close();
		}
	});
});

test("rotated OTP mail uses the newest verification and suppresses the old code", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const first = (await f.db.query("SELECT id,encrypted_payload FROM payloadbay.platform_job ORDER BY created_at DESC LIMIT 1")).rows[0];
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const second = (await f.db.query("SELECT id,encrypted_payload FROM payloadbay.platform_job WHERE id<>$1", [first.id])).rows[0];
			await platformJobTask(f.pool, config)({ jobId: first.id, generation: 1 });
			await platformJobTask(f.pool, config)({ jobId: second.id, generation: 1 });
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [first.id])).rows[0].state, "expired");
			assert.equal((await f.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [second.id])).rows[0].state, "succeeded");
			assert.equal((await (await fetch(f.mailUrl + "/api/v1/messages")).json()).total, 1);
			const payload = decryptPrivate<{ otp: string }>(second.encrypted_payload, config.encryptionKey);
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "operator@example.test", otp: payload.otp }) }));
			assert.equal(response.status, 200);
		} finally {
			await service.close();
		}
	});
});

test("RC10 recovery terminates expired and exhausted mail without reviving their queued references", async () => {
	await authFixture(async (fixture) => {
		const config = fixtureConfig(fixture);
		const mail = {
			email: "terminal-mail@example.test",
			otp: "123456",
			identifier: "synthetic-terminal",
			verificationHash: "synthetic-hash",
			expiresAt: new Date(Date.now() + 300000).toISOString(),
		};
		const expired = await queueMail(fixture.pool, "terminal-expired", { ...mail, expiresAt: new Date(Date.now() - 1000).toISOString() }, config.encryptionKey);
		const exhausted = await queueMail(fixture.pool, "terminal-exhausted", mail, config.encryptionKey);
		await fixture.db.query("UPDATE payloadbay.platform_job SET state='running',lease_owner='dead-fixture',lease_expiry=clock_timestamp()-interval '1 second',attempt_number=max_attempts WHERE id=ANY($1::uuid[])", [[expired, exhausted]]);
		const queuedBefore = (await fixture.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count;
		assert.deepEqual(await recoverPlatformJobs(fixture.pool), []);
		const rows = (await fixture.db.query("SELECT id,state,generation,lease_owner,lease_expiry FROM payloadbay.platform_job WHERE id=ANY($1::uuid[])", [[expired, exhausted]])).rows;
		assert.equal(rows.find((row) => row.id === expired).state, "expired", "Expiration takes precedence even after the retry budget is exhausted");
		assert.equal(rows.find((row) => row.id === exhausted).state, "failed");
		for (const row of rows) {
			assert.equal(row.generation, 1);
			assert.equal(row.lease_owner, null);
			assert.equal(row.lease_expiry, null);
		}

		assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count, queuedBefore);
		assert.deepEqual(await recoverPlatformJobs(fixture.pool), [], "Repeated recovery must not resurrect terminal work");
	});
});
