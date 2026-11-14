import test from "node:test";
import assert from "node:assert/strict";
import { authFixture, identity, fixtureConfig, setupSecret } from "../helpers/auth-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";
import { createAuth } from "../../packages/domain/src/auth-runtime.ts";
import { protectStoredOAuthTokens } from "../../packages/domain/src/oauth-security.ts";
import { symmetricDecrypt } from "../../packages/domain/node_modules/better-auth/dist/crypto/index.mjs";
import { saveInstallationConfiguration } from "../../packages/domain/src/installation-configuration.ts";
import { requestLoginCode, pruneOTPRequestState, LoginCodeRateLimitError } from "../../packages/domain/src/auth.ts";
import { decryptPrivate } from "../../packages/domain/src/private-crypto.ts";

test("OAuth identity settings stay pinned through removal and re-addition while secret rotation remains available", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		const setup = await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = fixtureConfig(f);
		const client = {
			clientId: "synthetic-client",
			clientSecret: "synthetic-secret",
			domain: "synthetic.auth.eu-west-1.amazoncognito.com",
			region: "eu-west-1",
			userPoolId: "eu-west-1_Synthetic",
		};

		const save = (version: number, oauth: unknown) => saveInstallationConfiguration(f.pool, { userId: "operator" }, setup.installationId, config, { version, settings: { oauth } });

		await save(0, { cognito: client });
		await save(1, { cognito: { ...client, clientSecret: "rotated-synthetic-secret" } });
		await assert.rejects(save(2, { cognito: { ...client, userPoolId: "eu-west-1_Other" } }), { code: "oauth_identity_pinned" });
		await assert.rejects(save(2, { cognito: { ...client, clientId: "other-client" } }), { code: "oauth_identity_pinned" });
		await save(2, {});
		await assert.rejects(save(3, { cognito: { ...client, domain: "other.auth.eu-west-1.amazoncognito.com" } }), { code: "oauth_identity_pinned" });
		await save(3, { cognito: client });
	});
});

test("OAuth storage upgrades plaintext tokens without double encryption and revokes undecipherable legacy token material", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await f.db.query('INSERT INTO auth.account(id,"userId","providerId","accountId","accessToken","refreshToken","idToken","createdAt","updatedAt") VALUES(\'synthetic-account\',\'operator\',\'google\',\'external-subject\',\'synthetic-access\',\'synthetic-refresh\',\'unneeded-id-token\',clock_timestamp(),clock_timestamp())');
		const key = fixtureConfig(f).authSecret;
		await protectStoredOAuthTokens(f.pool, key);

		const read = async () => (await f.db.query('SELECT "accessToken","refreshToken","idToken" FROM auth.account')).rows[0];

		const stored = await read();
		assert.notEqual(stored.accessToken, "synthetic-access");
		assert.equal(await symmetricDecrypt({ key, data: stored.accessToken }), "synthetic-access");
		assert.equal(await symmetricDecrypt({ key, data: stored.refreshToken }), "synthetic-refresh");
		assert.equal(stored.idToken, null);
		await protectStoredOAuthTokens(f.pool, key);
		assert.deepEqual(await read(), stored);
		await f.db.query("UPDATE auth.account SET \"accessToken\"='$ba$invalid-envelope'");
		await protectStoredOAuthTokens(f.pool, key);
		assert.equal((await read()).accessToken, null);
	});
});

test("OAuth explicit linking needs recent customer authentication and stores refreshable encrypted credentials", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = fixtureConfig(f);
		config.oauth = {
			google: {
				clientId: "synthetic-client",
				clientSecret: "synthetic-secret",
				getUserInfo: async () => ({
					user: {
						id: "synthetic-google-id",
						name: "Operator",
						email: "operator@example.test",
						emailVerified: true,
					},
					data: { sub: "synthetic-google-id", email: "operator@example.test", email_verified: true },
				}),
			},
		} as typeof config.oauth;
		const service = createAuth(f.pool, config);
		const previous = globalThis.fetch;
		const context = await service.auth.$context;
		const provider = context.socialProviders.find((value) => value.id === "google")!;
		assert.ok((await provider.getUserInfo({ accessToken: "synthetic" }))?.user, "synthetic provider profile override must be active");
		try {
			const post = (path: string, body: unknown, cookie = "") => service.handler(new Request(config.publicUrl + "/api/auth/" + path, { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json", cookie }, body: JSON.stringify(body) }));

			assert.equal((await post("link-social", { provider: "google", callbackURL: config.publicUrl })).status, 401);
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const job = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE kind='otp_mail'")).rows[0];
			const mail = decryptPrivate<{ otp: string }>(job.encrypted_payload, config.encryptionKey);
			const signed = await post("sign-in/email-otp", { email: "operator@example.test", otp: mail.otp });
			assert.equal(signed.status, 200);
			const sessionCookie = signed.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const linked = await post("link-social", { provider: "google", callbackURL: config.publicUrl }, sessionCookie);
			assert.equal(linked.status, 200);
			const state = new URL((await linked.json()).url).searchParams.get("state");
			assert.ok(state);
			const cookie =
				sessionCookie +
				"; " +
				linked.headers
					.getSetCookie()
					.map((value) => value.split(";")[0])
					.join("; ");
			let tokenCalls = 0;
			globalThis.fetch = (async (input) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
				assert.equal(url.startsWith("https://oauth2.googleapis.com/token"), true);
				tokenCalls++;

				return Response.json({
					access_token: "synthetic-access-" + tokenCalls,
					refresh_token: "synthetic-refresh-" + tokenCalls,
					token_type: "Bearer",
					expires_in: 3600,
				});
			}) as typeof fetch;
			const callback = await service.handler(new Request(config.publicUrl + "/api/auth/callback/google?code=synthetic&state=" + encodeURIComponent(state), { headers: { cookie } }));
			assert.equal(callback.status, 302);
			assert.equal(new URL(callback.headers.get("location")!).searchParams.get("error"), null);
			const record = (await f.db.query('SELECT id,"userId","accessToken","refreshToken" FROM auth.account WHERE "providerId"=\'google\'')).rows[0];
			assert.equal(record.userId, "operator");
			assert.notEqual(record.accessToken, "synthetic-access-1");
			assert.equal(await symmetricDecrypt({ key: config.authSecret, data: record.refreshToken }), "synthetic-refresh-1");
			await f.db.query("UPDATE auth.account SET \"accessTokenExpiresAt\"=clock_timestamp()-interval '1 second' WHERE \"providerId\"='google'");
			const refreshed = await service.api.getAccessToken({ body: { accountId: record.id }, headers: new Headers({ cookie: sessionCookie }) });
			assert.equal(refreshed.accessToken, "synthetic-access-2");
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM auth.account WHERE \"userId\"='operator'")).rows[0].n, 1);
			assert.equal((await post("unlink-account", { accountId: record.id }, sessionCookie)).status, 200);
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM auth.account WHERE \"userId\"='operator'")).rows[0].n, 0);
			await service.api.sendVerificationOTP({ body: { email: "operator@example.test", type: "sign-in" } });
			const recoveryJob = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE kind='otp_mail' ORDER BY created_at DESC,id DESC LIMIT 1")).rows[0];
			const recoveryMail = decryptPrivate<{ otp: string }>(recoveryJob.encrypted_payload, config.encryptionKey);
			assert.equal((await post("sign-in/email-otp", { email: "operator@example.test", otp: recoveryMail.otp })).status, 200);
			await f.db.query("UPDATE auth.session SET \"createdAt\"=clock_timestamp()-interval '11 minutes'");
			assert.equal((await post("link-social", { provider: "google", callbackURL: config.publicUrl }, sessionCookie)).status, 401);
		} finally {
			globalThis.fetch = previous;
			await service.close();
		}
	});
});

test("anonymous OTP allocation has global and cardinality bounds and expired state is reclaimed", async () => {
	await authFixture(async (f) => {
		const auth = {
			api: {
				sendVerificationOTP: async () => {
					throw Error("unknown identities must not receive mail");
				},
			},
		};
		await requestLoginCode(f.pool, auth, "unknown@example.test");
		await f.db.query("UPDATE payloadbay.auth_request_window SET count=1000 WHERE key='otp-global'");
		const before = (await f.db.query("SELECT count(*)::int AS n FROM payloadbay.auth_request_window")).rows[0].n;
		for (let i = 0; i < 30; i++) await assert.rejects(requestLoginCode(f.pool, auth, `rotated-${i}@example.test`), LoginCodeRateLimitError);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.auth_request_window")).rows[0].n, before);
		await f.db.query("UPDATE payloadbay.auth_request_window SET window_started_at=clock_timestamp()-interval '11 minutes'");
		await pruneOTPRequestState(f.pool);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.auth_request_window")).rows[0].n, 1);
		await requestLoginCode(f.pool, auth, "new-unknown@example.test");
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.auth_request_window")).rows[0].n, 3);
		await f.db.query("INSERT INTO payloadbay.auth_request_window(key,window_started_at,count) SELECT 'synthetic-'||n,clock_timestamp(),1 FROM generate_series(1,9997) n");
		await assert.rejects(requestLoginCode(f.pool, auth, "other-unknown@example.test"), LoginCodeRateLimitError);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.auth_request_window")).rows[0].n, 10000);
	});
});

test("repeated denied requests do not consume new-address capacity or block existing customers", async () => {
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		let sent = 0;
		const auth = {
			api: {
				sendVerificationOTP: async () => {
					sent++;
				},
			},
		};
		await requestLoginCode(f.pool, auth, "operator@example.test");
		await requestLoginCode(f.pool, auth, "unknown@example.test");
		for (let i = 0; i < 30; i++) await assert.rejects(requestLoginCode(f.pool, auth, "unknown@example.test"), LoginCodeRateLimitError);
		assert.equal((await f.db.query("SELECT count FROM payloadbay.auth_request_window WHERE key='otp-global'")).rows[0].count, 2);
		await f.db.query("UPDATE payloadbay.auth_request_window SET count=1000 WHERE key='otp-global'");
		await f.db.query("UPDATE payloadbay.auth_request_window SET window_started_at=clock_timestamp()-interval '31 seconds' WHERE key LIKE 'otp-cooldown:%'");
		await requestLoginCode(f.pool, auth, "operator@example.test");
		assert.equal(sent, 2);
		assert.equal((await f.db.query("SELECT count FROM payloadbay.auth_request_window WHERE key='otp-global'")).rows[0].count, 1000);
	});
});
