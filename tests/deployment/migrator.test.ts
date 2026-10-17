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
			const migrate = () => spawnSync("docker", ["run", ...restricted, "--network", fixture.network, "--env", "MIGRATION_DATABASE_URL=" + fixture.containerDatabaseUrl, "--mount", `type=bind,src=${resolve("tests/fixtures/schema-history")},dst=/fixtures,readonly`, image, "--directory", "/fixtures"], { encoding: "utf8" });
			const first = migrate();
			assert.equal(first.status, 0, first.stderr);
			assert.match(first.stdout, /Payload Bay migrations complete/);
			const db = new Client({ connectionString: fixture.databaseUrl });
			await db.connect();
			try {
				assert.ok((await db.query("SELECT to_regclass('payloadbay.event') AS name")).rows[0].name);
				assert.ok((await db.query("SELECT to_regclass('auth.user') AS name")).rows[0].name);
				assert.ok((await db.query("SELECT to_regnamespace('graphile_worker') AS name")).rows[0].name);
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
