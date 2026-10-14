import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("U318 PR preview builds branch services and initializes its own database", () => {
	assert.ok(existsSync("deploy/compose.preview.yml"), "PR preview must provide a source-build Compose stack");
	const config = JSON.parse(
		execFileSync("docker", ["compose", "-f", "deploy/compose.preview.yml", "config", "--format", "json"], {
			encoding: "utf8",
			env: {
				...process.env,
				HEROUI_AUTH_TOKEN: "synthetic-build-credential",
				POSTGRES_PASSWORD: "synthetic-preview-password",
				BETTER_AUTH_SECRET: "synthetic-auth-secret-32-characters",
				PAYLOADBAY_ENCRYPTION_KEY: "synthetic-encryption-key-32-characters",
				PAYLOADBAY_BOOTSTRAP_SECRET: "synthetic-bootstrap-key-32-characters",
				PAYLOADBAY_EXECUTOR_TOKEN: "synthetic-executor-key-32-characters",
				PAYLOADBAY_BROKER_SECRET: "synthetic-broker-key-32-characters",
			},
		}),
	);
	for (const name of ["app", "worker", "executor", "schema"]) {
		assert.ok(config.services[name].build, name + " must build from the checked-out PR");
		assert.equal(config.services[name].image, undefined, name + " must not require a published product image");
	}

	assert.equal(config.services.app.depends_on.schema.condition, "service_completed_successfully");
	assert.equal(config.services.worker.depends_on.schema.condition, "service_completed_successfully");
	assert.equal(config.services.schema.environment.NODE_ENV, "development");
	assert.equal(config.services.schema.command.at(-1), "scripts/database/push.ts");
	assert.match(config.services.app.environment.DATABASE_URL, /@postgres:5432\/payloadbay$/);
	assert.equal(config.services.executor.runtime, "runc");
	assert.equal(config.services.executor.read_only, true);
	assert.equal(config.secrets.heroui_auth_token.environment, "HEROUI_AUTH_TOKEN");
	for (const service of Object.values(config.services) as Record<string, unknown>[]) {
		assert.equal(service.container_name, undefined, "Compose projects must isolate PR container names");
		assert.equal(service.ports, undefined, "Coolify routes the app without publishing internal services");
	}

	assert.ok(config.volumes.postgres);
	assert.equal(config.volumes.postgres.external, undefined);
});
