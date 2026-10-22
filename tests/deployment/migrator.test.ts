import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "pg";
import { withFixtures } from "../../scripts/tests/fixtures.ts";

const image = "payloadbay-test/migrator:" + randomUUID().slice(0, 8);
const restricted = ["--rm", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:size=16777216"];

test("RI01 packaged migrator refuses absent release SQL and applies explicit historical fixtures without host tooling", async () => {
	execFileSync("docker", ["build", "-f", "deploy/Dockerfile.migrator", "-t", image, "."], { stdio: ["ignore", "pipe", "pipe"] });
	try {
		const missing = spawnSync("docker", ["run", ...restricted, "--env", "MIGRATION_DATABASE_URL=postgres://unused.invalid/unused", image], { encoding: "utf8" });
		assert.equal(missing.status, 1);
		assert.match(missing.stderr, /Payload Bay migration failed/);
		assert.doesNotMatch(missing.stderr, /ERR_MODULE_NOT_FOUND|unused.invalid/);
		await withFixtures(async (fixture) => {
			const migrate = () => spawnSync("docker", ["run", ...restricted, "--network", fixture.network, "--env", "MIGRATION_DATABASE_URL=" + fixture.containerDatabaseUrl, "--env", "PAYLOADBAY_APP_DATABASE_PASSWORD=fixture-image-app-password-32-characters", "--env", "PAYLOADBAY_WORKER_DATABASE_PASSWORD=fixture-image-worker-password-32-characters", "--mount", `type=bind,src=${resolve("tests/fixtures/schema-history")},dst=/fixtures,readonly`, image, "--directory", "/fixtures"], { encoding: "utf8" });

			const first = migrate();
			assert.equal(first.status, 0, first.stderr);
			assert.match(first.stdout, /Payload Bay migrations complete/);
			const db = new Client({ connectionString: fixture.databaseUrl });
			await db.connect();
			try {
				assert.ok((await db.query("SELECT to_regclass('payloadbay.event') AS name")).rows[0].name);
				assert.ok((await db.query("SELECT to_regclass('auth.user') AS name")).rows[0].name);
				assert.ok((await db.query("SELECT to_regnamespace('graphile_worker') AS name")).rows[0].name);
				const roles = (await db.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname IN ('payloadbay_web','payloadbay_jobs') ORDER BY rolname")).rows;
				assert.deepEqual(roles, [
					{
						rolname: "payloadbay_jobs",
						rolsuper: false,
						rolcreatedb: false,
						rolcreaterole: false,
					},
					{
						rolname: "payloadbay_web",
						rolsuper: false,
						rolcreatedb: false,
						rolcreaterole: false,
					},
				]);
				const before = (await db.query("SELECT name,digest FROM payloadbay.schema_migration ORDER BY name")).rows;
				assert.ok(before.length);
				const second = migrate();
				assert.equal(second.status, 0, second.stderr);
				assert.deepEqual((await db.query("SELECT name,digest FROM payloadbay.schema_migration ORDER BY name")).rows, before);
			} finally {
				await db.end();
			}
		});
	} finally {
		execFileSync("docker", ["image", "rm", image], { stdio: ["ignore", "pipe", "pipe"] });
	}
});

test("RI02 PostgreSQL archive restores binary events, pinned code, encrypted secrets and pending jobs", async () => {
	const { prepareDevelopmentDatabase } = await import("../../packages/domain/src/development.ts");
	const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
	const { encryptPrivate, decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	await withFixtures(async (fixture) => {
		await prepareDevelopmentDatabase(fixture.databaseUrl);
		const db = new Client({ connectionString: fixture.databaseUrl });
		await db.connect();
		const restoredName = "restore_" + randomUUID().replaceAll("-", "");
		let restored: Client | undefined;
		try {
			const scope = await seedScope(db);
			const event = await seedEvent(db, scope);
			const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
			const key = "fixture-restore-encryption-key-32-characters";
			const encrypted = encryptPrivate({ value: "synthetic-restored-secret" }, key);
			const secret = (await db.query("INSERT INTO payloadbay.secret_version(scope_type,scope_id,name,version,encrypted_value,key_id) VALUES('project',$1,'restore-test',1,$2,'v1') RETURNING id", [scope.project, encrypted])).rows[0].id;
			await db.query("SELECT payloadbay.enqueue('process_event',$1::json,now(),'restore-pending',0::smallint)", [JSON.stringify({ executionId: execution })]);
			const clientImage = "postgres:17-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";

			const pg = (database: string) => ["run", ...restricted, "--network", fixture.network, "--env", "PGHOST=postgres", "--env", "PGUSER=fixture", "--env", "PGPASSWORD=fixture-only", "--env", "PGDATABASE=" + database, clientImage];

			const archive = execFileSync("docker", [...pg(new URL(fixture.containerDatabaseUrl).pathname.slice(1)), "pg_dump", "--format=custom"], { stdio: ["ignore", "pipe", "pipe"] });
			assert.equal(archive.subarray(0, 5).toString(), "PGDMP");
			await db.query(`CREATE DATABASE "${restoredName}"`);
			execFileSync("docker", ["run", "--interactive", ...pg(restoredName).slice(1), "pg_restore", "--dbname", restoredName, "--exit-on-error", "--single-transaction"], { input: archive, stdio: ["pipe", "pipe", "pipe"] });
			const restoredUrl = new URL(fixture.databaseUrl);
			restoredUrl.pathname = "/" + restoredName;
			restored = new Client({ connectionString: restoredUrl.toString() });
			await restored.connect();
			assert.deepEqual((await restored.query("SELECT original_body FROM payloadbay.event WHERE id=$1", [event])).rows[0].original_body, Buffer.from([0, 255, 42]));
			const pinned = (await restored.query("SELECT publication_id,state FROM payloadbay.execution WHERE id=$1", [execution])).rows[0];
			assert.deepEqual(pinned, { publication_id: scope.publication, state: "queued" });
			assert.equal((await restored.query("SELECT count(*)::int AS n FROM graphile_worker._private_jobs WHERE key='restore-pending'")).rows[0].n, 1);
			const ciphertext = (await restored.query("SELECT encrypted_value FROM payloadbay.secret_version WHERE id=$1", [secret])).rows[0].encrypted_value;
			assert.deepEqual(decryptPrivate(ciphertext, key), { value: "synthetic-restored-secret" });
			assert.throws(() => decryptPrivate(ciphertext, "different-fixture-encryption-key"));
			await assert.rejects(restored.query("UPDATE payloadbay.stage_revision SET body='changed' WHERE id=(SELECT processing_revision_id FROM payloadbay.publication WHERE id=$1)", [scope.publication]));
			assert.equal((await restored.query("SELECT pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE oid='payloadbay.prune_expired_events(timestamptz,integer)'::regprocedure")).rows[0].owner, "payloadbay_retention");
			assert.equal((await restored.query("SELECT has_function_privilege('public','payloadbay.prune_expired_events(timestamptz,integer)','EXECUTE') AS allowed")).rows[0].allowed, false);
		} finally {
			await restored?.end();
			await db.query(`DROP DATABASE IF EXISTS "${restoredName}" WITH (FORCE)`);
			await db.end();
		}
	});
});

test("RI03 fresh PostgreSQL cluster restores original roles before owned database objects", async () => {
	const { prepareDevelopmentDatabase } = await import("../../packages/domain/src/development.ts");
	const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
	await withFixtures(async (fixture) => {
		await prepareDevelopmentDatabase(fixture.databaseUrl);
		const db = new Client({ connectionString: fixture.databaseUrl });
		await db.connect();
		const target = "pab-restore-" + randomUUID().slice(0, 8);
		let started = false;
		try {
			const scope = await seedScope(db);
			const event = await seedEvent(db, scope);
			const clientImage = "postgres:17-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
			const source = ["run", ...restricted, "--network", fixture.network, "--env", "PGHOST=postgres", "--env", "PGUSER=fixture", "--env", "PGPASSWORD=fixture-only", "--env", "PGDATABASE=" + new URL(fixture.containerDatabaseUrl).pathname.slice(1), clientImage];
			const roles = execFileSync("docker", [...source, "pg_dumpall", "--globals-only", "--no-role-passwords", "--no-tablespaces"], { stdio: ["ignore", "pipe", "pipe"] });
			const archive = execFileSync("docker", [...source, "pg_dump", "--format=custom"], { stdio: ["ignore", "pipe", "pipe"] });
			execFileSync("docker", ["run", "--detach", "--rm", "--name", target, "--env", "POSTGRES_USER=fixture", "--env", "POSTGRES_PASSWORD=fixture-restore-only", "--env", "POSTGRES_DB=restore_target", "--tmpfs", "/var/lib/postgresql/data", clientImage], { stdio: ["ignore", "pipe", "pipe"] });
			started = true;
			const command = ["exec", "--env", "PGPASSWORD=fixture-restore-only", target, "psql", "--host=127.0.0.1", "--username=fixture", "--dbname=restore_target", "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"];
			let ready = false;
			for (let attempt = 0; attempt < 100; attempt++) {
				if (spawnSync("docker", [...command, "--command=SELECT 1"], { stdio: "ignore" }).status === 0) {
					ready = true;
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			assert.equal(ready, true, "A new cluster must finish initialization");
			// Preserve the original bootstrap role identity. PostgreSQL documents its
			// duplicate CREATE ROLE as the one expected globals-restore error.
			const restoreRoles = spawnSync("docker", ["exec", "--interactive", "--env", "PGPASSWORD=fixture-restore-only", target, ...command.slice(4).filter((value) => value !== "--set=ON_ERROR_STOP=1")], { input: roles, encoding: "utf8" });
			assert.equal(restoreRoles.status, 0);
			assert.deepEqual(restoreRoles.stderr.trim().split("\n").filter(Boolean), ['ERROR:  role "fixture" already exists']);
			execFileSync("docker", ["exec", "--interactive", "--env", "PGPASSWORD=fixture-restore-only", target, "pg_restore", "--host=127.0.0.1", "--username=fixture", "--dbname=restore_target", "--exit-on-error", "--single-transaction"], { input: archive, stdio: ["pipe", "pipe", "pipe"] });

			const query = (sql: string) => execFileSync("docker", [...command, "--command", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

			assert.equal(query(`SELECT encode(original_body,'hex') FROM payloadbay.event WHERE id='${event}'`), "00ff2a");
			assert.equal(query("SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='payloadbay.prune_expired_events(timestamptz,integer)'::regprocedure"), "payloadbay_retention");
			assert.equal(query("SELECT has_function_privilege('public','payloadbay.prune_expired_events(timestamptz,integer)','EXECUTE')"), "f");
			assert.equal(query("SELECT rolcanlogin FROM pg_roles WHERE rolname='payloadbay_retention'"), "f");
		} finally {
			if (started) execFileSync("docker", ["rm", "--force", target], { stdio: ["ignore", "pipe", "pipe"] });
			await db.end();
		}
	});
});

test("RI06 operator Compose uses prebuilt images and separates migration, app and worker credentials", async () => {
	const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const folder = await mkdtemp(join(tmpdir(), "pab-compose-"));
	const empty = join(folder, "empty.env");
	await writeFile(empty, "");
	try {
		const env = {
			...process.env,
			PUBLIC_URL: "https://payloadbay.example.test",
			PAYLOADBAY_EXECUTOR_RUNTIME: "runc",
			POSTGRES_PASSWORD: "fixture-admin-database-password-32-characters",
			PAYLOADBAY_APP_DATABASE_PASSWORD: "fixture-app-database-password-32-characters",
			PAYLOADBAY_WORKER_DATABASE_PASSWORD: "fixture-worker-database-password-32-characters",
			BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
			PAYLOADBAY_ENCRYPTION_KEY: "fixture-encryption-key-32-characters",
			PAYLOADBAY_BOOTSTRAP_SECRET: "fixture-bootstrap-key-32-characters",
			PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
			PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
			SMTP_HOST: "smtp.example.test",
			SMTP_FROM: "fixture@example.test",
			...Object.fromEntries(["APP", "WORKER", "EXECUTOR", "MIGRATOR"].map((name) => ["PAYLOADBAY_" + name + "_IMAGE", "ghcr.io/payloadbay/" + name.toLowerCase() + "@sha256:" + "0".repeat(64)])),
		};
		const config = JSON.parse(execFileSync("docker", ["compose", "--env-file", empty, "-f", "deploy/compose.yml", "config", "--format=json"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
		assert.deepEqual(Object.keys(config.services).sort(), ["app", "executor", "migrator", "postgres", "worker"]);
		for (const service of Object.values(config.services) as Record<string, any>[]) assert.equal(service.build, undefined);
		assert.equal(config.services.app.environment.PGPASSWORD, env.PAYLOADBAY_APP_DATABASE_PASSWORD);
		assert.equal(config.services.worker.environment.PGPASSWORD, env.PAYLOADBAY_WORKER_DATABASE_PASSWORD);
		assert.equal(config.services.migrator.environment.PGPASSWORD, env.POSTGRES_PASSWORD);
		assert.equal(config.services.app.environment.MIGRATION_DATABASE_URL, undefined);
		assert.equal(config.services.worker.environment.MIGRATION_DATABASE_URL, undefined);
		assert.equal(config.services.executor.environment.DATABASE_URL, undefined);
		assert.equal(config.services.executor.environment.PGPASSWORD, undefined);
		assert.equal(config.services.executor.environment.BETTER_AUTH_SECRET, undefined);
		assert.equal(config.services.executor.runtime, "runc");
		assert.equal(config.services.worker.depends_on.migrator.condition, "service_completed_successfully");
		assert.equal(config.services.app.depends_on.migrator.condition, "service_completed_successfully");
		assert.equal(config.services.app.depends_on.worker.condition, "service_healthy");
		assert.ok(config.services.worker.healthcheck);
		assert.match(config.services.postgres.healthcheck.test.join(" "), /-h 127\.0\.0\.1/);
		assert.equal(config.services.postgres.volumes[0].type, "volume");
		for (const name of ["app", "worker", "executor", "migrator"]) {
			assert.equal(config.services[name].read_only, true);
			assert.deepEqual(config.services[name].cap_drop, ["ALL"]);
			assert.equal(config.services[name].volumes, undefined);
		}
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
});
