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
			for (behavior of ["redirect", "oversized", "raw-error", "false-attestation"]) {
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
