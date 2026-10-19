import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readServerConfig, publicConfiguration } from "../../packages/domain/src/config.ts";

const env = {
	DATABASE_URL: "postgres://fixture:fixture@localhost/fixture",
	SMTP_HOST: "127.0.0.1",
	SMTP_PORT: "1025",
	SMTP_FROM: "fixture@example.test",
	BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
	PAYLOADBAY_ENCRYPTION_KEY: "fixture-encryption-key-32-characters",
	PAYLOADBAY_BOOTSTRAP_SECRET: "fixture-bootstrap-key-32-characters",
	PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
	PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
};

test("U211 public configuration contains no server credentials", () => {
	const publicValue = publicConfiguration(readServerConfig(env));
	assert.deepEqual(publicValue, {
		smtpConfigured: true,
		oauthProviders: [],
		executorMode: "runc",
		limits: { body: 1048576, headers: 16384 },
	});
	for (const secret of [env.BETTER_AUTH_SECRET, env.PAYLOADBAY_ENCRYPTION_KEY, env.PAYLOADBAY_BOOTSTRAP_SECRET, env.PAYLOADBAY_EXECUTOR_TOKEN, env.PAYLOADBAY_BROKER_SECRET]) assert.equal(JSON.stringify(publicValue).includes(secret), false);
});

import { build } from "esbuild";

test("U212 browser bundle excludes private domain code", async () => {
	const result = await build({
		entryPoints: ["apps/web/src/app/lib/api-client.ts"],
		bundle: true,
		platform: "browser",
		format: "esm",
		write: false,
		metafile: true,
	});
	assert.equal(
		Object.keys(result.metafile!.inputs).some((file) => file.includes("packages/domain/")),
		false,
		"browser code must not bundle private domain modules",
	);
});

test("IH02 installation probes reject redirects oversized bodies and false host attestation without leaking errors", async () => {
	const { authFixture, fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { readInstallationSettings, readInstallationHealth } = await import("../../packages/domain/src/installation.ts");
	const { createServer } = await import("node:http");
	let behavior = "ready";
	let calls = 0;
	const server = createServer((_request, response) => {
		calls++;
		if (behavior === "redirect") response.writeHead(302, { location: "/redirect-target" }).end();
		else if (behavior === "oversized") response.writeHead(200).end("synthetic-private-upstream-detail".repeat(1000));
		else if (behavior === "raw-error") response.writeHead(500).end("synthetic-private-upstream-detail");
		else
			response.writeHead(200, { "content-type": "application/json" }).end(
				JSON.stringify({
					protocolVersion: behavior === "missing-protocol" ? undefined : behavior === "wrong-protocol" ? 2 : 1,
					sdkVersion: behavior === "wrong-sdk" ? "2" : "1",
					compatibilityDate: behavior === "wrong-date" ? "2027-01-01" : "2026-07-01",
					ready: behavior !== "not-ready",
					runtime: "workerd",
					configuredMode: "runsc",
					hostAttestation: behavior === "false-attestation",
				}),
			);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	try {
		await authFixture(async (fixture) => {
			const scope = await seedScope(fixture.db);
			await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			const config = { ...fixtureConfig(fixture), executorUrl: "http://127.0.0.1:" + address.port };
			const actor = { userId: "fixture-owner" };
			await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['settings.manage'])", [scope.project]);
			await assert.rejects(readInstallationHealth(fixture.pool, actor, scope.installation, config), { code: "forbidden" });
			await assert.rejects(readInstallationSettings(fixture.pool, actor, scope.installation, config), { code: "forbidden" });
			assert.equal(calls, 0, "Authorization must precede an outbound health probe");
			await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['settings.manage'])", [scope.installation]);
			const settings = await readInstallationSettings(fixture.pool, actor, scope.installation, config);
			assert.equal(settings.executorMode, "runc");
			assert.equal(settings.eventRetentionDays, 0, "Operators must see that retention defaults disabled");
			assert.equal((await readInstallationSettings(fixture.pool, actor, scope.installation, { ...config, eventRetentionDays: 30 })).eventRetentionDays, 30);
			const health = await readInstallationHealth(fixture.pool, actor, scope.installation, config);
			assert.equal(health.executor.state, "ready");
			assert.equal(health.executor.configuredMode, "runsc", "Report executor configuration separately from web configuration");
			assert.equal(health.executor.hostAttestation, false);
			behavior = "not-ready";
			assert.equal((await readInstallationHealth(fixture.pool, actor, scope.installation, config)).executor.state, "not_ready");
			for (behavior of ["redirect", "oversized", "raw-error", "false-attestation", "wrong-protocol", "wrong-sdk", "wrong-date", "missing-protocol"]) {
				const before: number = calls;
				const result = await readInstallationHealth(fixture.pool, actor, scope.installation, config);
				assert.equal(result.executor.state, "unavailable", behavior);
				assert.equal(calls, before + 1, "Redirects must not be followed");
				assert.equal(JSON.stringify(result).includes("synthetic-private-upstream-detail"), false);
			}
		});
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

test("UX73 installation OAuth secrets are encrypted, redacted, versioned and deny non-administrators", async () => {
	const { authFixture, fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { saveInstallationConfiguration, resolveInstallationConfiguration } = await import("../../packages/domain/src/installation-configuration.ts");
	await authFixture(async (fixture) => {
		const { pool, db } = fixture;
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['settings.manage'])", [scope.installation]);
		const config = fixtureConfig(fixture);
		const actor = { userId: "fixture-owner" };
		const settings = { oauth: { google: { clientId: "synthetic-client", clientSecret: "synthetic-oauth-secret" } } };
		await assert.rejects(saveInstallationConfiguration(pool, { userId: "outsider" }, scope.installation, config, { version: 0, settings }));
		const saved = await saveInstallationConfiguration(pool, actor, scope.installation, config, { version: 0, settings });
		assert.equal(saved.version, 1);
		assert.equal(JSON.stringify(saved).includes("synthetic-oauth-secret"), false);
		const bytes = (await db.query("SELECT encrypted_settings FROM payloadbay.installation_configuration")).rows[0].encrypted_settings;
		assert.equal(bytes.toString().includes("synthetic-oauth-secret"), false);
		assert.equal((await resolveInstallationConfiguration(pool, config)).config.oauth.google?.clientSecret, "synthetic-oauth-secret");
		assert.deepEqual((await resolveInstallationConfiguration(pool, config)).config.smtp, config.smtp);
		await assert.rejects(saveInstallationConfiguration(pool, actor, scope.installation, config, { version: 0, settings }), { code: "version_conflict" });
		await saveInstallationConfiguration(pool, actor, scope.installation, config, { version: 1, settings: { oauth: { google: { clientId: "synthetic-client" } } } });
		assert.equal((await resolveInstallationConfiguration(pool, config)).config.oauth.google?.clientSecret, "synthetic-oauth-secret");
		assert.equal(JSON.stringify((await db.query("SELECT redacted_diff FROM payloadbay.audit WHERE operation='installation.settings_updated'")).rows).includes("synthetic-oauth-secret"), false);
		await saveInstallationConfiguration(pool, actor, scope.installation, config, { version: 2, settings: { oauth: {} } });
		assert.deepEqual((await resolveInstallationConfiguration(pool, config)).config.oauth, {});
	});
});

test("UX83 installation policy has one versioned database source across web and worker readers", async () => {
	const { authFixture, fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { saveInstallationConfiguration, resolveInstallationConfiguration } = await import("../../packages/domain/src/installation-configuration.ts");
	await authFixture(async (fixture) => {
		const scope = await seedScope(fixture.db);
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['settings.manage'])", [scope.installation]);
		const config = fixtureConfig(fixture);
		const actor = { userId: "fixture-owner" };
		const policy = {
			registrationPolicy: "organization",
			eventRetentionDays: 30,
			bodyLimit: 512,
			headerLimit: 1024,
			ingressDeadlineMs: 500,
			processingDeadlineMs: 1500,
			httpTimeoutMs: 1000,
			maxAttempts: 2,
			otpRequestLimit: 3,
		};
		await assert.rejects(saveInstallationConfiguration(fixture.pool, { userId: "outsider" }, scope.installation, config, { version: 0, settings: policy }));
		const saved = await saveInstallationConfiguration(fixture.pool, actor, scope.installation, config, { version: 0, settings: policy });
		assert.equal(saved.settings.bodyLimit, 512);
		const web = await resolveInstallationConfiguration(fixture.pool, config);
		const worker = await resolveInstallationConfiguration(fixture.pool, { ...config, bodyLimit: 999, eventRetentionDays: 0 });
		for (const [key, value] of Object.entries(policy)) {
			assert.equal(web.config[key as keyof typeof web.config], value);
			assert.equal(worker.config[key as keyof typeof worker.config], value);
		}

		assert.deepEqual(worker.config.smtp, config.smtp);
		await assert.rejects(saveInstallationConfiguration(fixture.pool, actor, scope.installation, config, { version: 0, settings: { bodyLimit: 700 } }), { code: "version_conflict" });
		await assert.rejects(saveInstallationConfiguration(fixture.pool, actor, scope.installation, config, { version: 1, settings: { bodyLimit: 1048577 } }), { code: "invalid_input" });
		await saveInstallationConfiguration(fixture.pool, actor, scope.installation, config, { version: 1, settings: { oauth: { google: { clientId: "synthetic", clientSecret: "synthetic-secret" } } } });
		assert.equal((await resolveInstallationConfiguration(fixture.pool, config)).config.eventRetentionDays, 30);
		await saveInstallationConfiguration(fixture.pool, actor, scope.installation, config, { version: 2, settings: { bodyLimit: 256 } });
		assert.equal((await resolveInstallationConfiguration(fixture.pool, config)).config.oauth.google?.clientSecret, "synthetic-secret");
		const audit = (await fixture.db.query("SELECT redacted_diff FROM payloadbay.audit WHERE operation='installation.settings_updated' ORDER BY created_at DESC LIMIT 1")).rows[0].redacted_diff;
		assert.deepEqual(audit.fields, ["bodyLimit"]);
		assert.equal(JSON.stringify(audit).includes("synthetic-secret"), false);
	});
});
