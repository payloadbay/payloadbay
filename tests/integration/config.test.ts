import test from "node:test";
import assert from "node:assert/strict";
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
