import { readdirSync } from "node:fs";

const expectedMigrationCount = readdirSync(new URL("../fixtures/schema-history/", import.meta.url)).filter((name) => name.endsWith(".sql")).length;
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { withFixtures } from "../../scripts/tests/fixtures.ts";
import { migrate as migrateRelease } from "../../packages/domain/src/migrate.ts";

const migrate = (url: string, options: { through?: string } = {}) => migrateRelease(url, { ...options, directory: new URL("../fixtures/schema-history/", import.meta.url) });

test("U6 empty installation creates complete domain schema", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			const rows = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='payloadbay'")).rows.map((r) => r.table_name);
			for (const name of ["installation", "admission", "workspace", "project", "grant_record", "api_token", "secret_version", "endpoint", "draft", "stage_revision", "shared_module_revision", "middleware_binding", "publication", "destination", "event", "receipt", "execution", "dispatch", "managed_operation", "delivery_attempt", "platform_job", "audit", "change_record", "notification_rule", "notification_incident", "notification_recipient_state", "notification_dispatch"])
				assert.ok(rows.includes(name), name);
		} finally {
			await db.end();
		}
	});
});

import { database, transaction } from "../../packages/domain/src/db.ts";
import { seedScope, seedLegacyScope, seedEvent } from "../helpers/domain-fixtures.ts";

test("U7 acceptance rollback leaves no event or dispatch", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			const scope = await seedLegacyScope(db);
			await assert.rejects(
				transaction(pool, async (c) => {
					const event = await seedEvent(c, scope);
					const execution = (await c.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
					await c.query("INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,job_key,claim_deadline_at) VALUES($1,$2,1,'fixture-job',now()+interval '30 seconds')", [execution, scope.endpoint]);
					throw Error("fixture persistence failure");
				}),
				/fixture persistence failure/,
			);
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 0);
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.dispatch")).rows[0].count, 0);
		} finally {
			db.release();
			await pool.end();
		}
	});
});

test("U8 concurrent migrations serialize under migration lock", async () => {
	await withFixtures(async (f) => {
		const blocker = new Client({ connectionString: f.databaseUrl });
		await blocker.connect();
		let migration: Promise<void> | undefined;
		try {
			await blocker.query("SELECT pg_advisory_lock(hashtext('payloadbay:migrations:v1'))");
			migration = migrate(f.databaseUrl);
			let waiting = false;
			for (let i = 0; i < 100; i++) {
				const locks = await blocker.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND NOT granted");
				if (locks.rows[0].count > 0) {
					waiting = true;
					break;
				}

				await new Promise((r) => setTimeout(r, 10));
			}

			assert.equal(waiting, true, "second migration must wait for advisory lock");
			await blocker.query("SELECT pg_advisory_unlock(hashtext('payloadbay:migrations:v1'))");
			await migration;
			await Promise.all([migrate(f.databaseUrl), migrate(f.databaseUrl)]);
			assert.equal((await blocker.query("SELECT count(*)::int AS count FROM payloadbay.schema_migration")).rows[0].count, expectedMigrationCount);
		} finally {
			await blocker.query("SELECT pg_advisory_unlock_all()");
			await migration;
			await blocker.end();
		}
	});
});

test("U9 forward migration preserves existing records", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			const scope = await seedLegacyScope(db);
			const event = await seedEvent(db, scope);
			await migrate(f.databaseUrl);
			assert.deepEqual(
				(await db.query("SELECT original_body FROM payloadbay.event WHERE id=$1", [event])).rows.map((r) => r.original_body),
				[Buffer.from([0, 255, 42])],
			);
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.schema_migration")).rows[0].count, expectedMigrationCount);
		} finally {
			await db.end();
		}
	});
});

test("U10 wrong-scope dispatch is rejected", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			const scope = await seedLegacyScope(db);
			const event = await seedEvent(db, scope);
			const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
			const other = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Other','other',gen_random_uuid()::text) RETURNING id", [scope.project])).rows[0].id;
			await assert.rejects(db.query("INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,job_key,claim_deadline_at) VALUES($1,$2,1,'wrong-scope',now())", [execution, other]), { code: "23503" });
		} finally {
			await db.end();
		}
	});
});

test("U184 migration coordinates auth and queue schemas", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			assert.ok((await db.query("SELECT to_regclass('auth.user') AS table_name")).rows[0].table_name);
			assert.ok((await db.query("SELECT to_regclass('graphile_worker.jobs') AS table_name")).rows[0].table_name);
		} finally {
			await db.end();
		}
	});
});

test("U185 real forward upgrade preserves retained event bytes", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl, { through: "0001_foundation.sql" });
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			const scope = await seedLegacyScope(db);
			const event = await seedEvent(db, scope);
			await migrate(f.databaseUrl);
			assert.ok((await db.query("SELECT to_regclass('payloadbay.notification_subscription') AS table_name")).rows[0].table_name, "new migration must be applied");
			assert.deepEqual((await db.query("SELECT original_body FROM payloadbay.event WHERE id=$1", [event])).rows[0].original_body, Buffer.from([0, 255, 42]));
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.schema_migration")).rows[0].count, expectedMigrationCount);
		} finally {
			await db.end();
		}
	});
});

test("U186 app role enqueues atomically without private queue reads", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			await db.query("SET ROLE payloadbay_app");
			await assert.rejects(db.query("SELECT * FROM graphile_worker.jobs"), { code: "42501" });
			await db.query("BEGIN");
			const job = await db.query("SELECT payloadbay.enqueue('process_event','{}'::json,now(),'fixture-atomic',0::smallint) AS id");
			assert.match(String(job.rows[0].id), /^\d+$/);
			await db.query("ROLLBACK");
			await db.query("RESET ROLE");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count, 0);
		} finally {
			await db.query("ROLLBACK");
			await db.end();
		}
	});
});

import { typedDatabase } from "../../packages/domain/src/db.ts";

test("U190 Drizzle reads retained bytes through typed mappings", async () => {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			const scope = await seedLegacyScope(db);
			await seedEvent(db, scope);
			const storage = typedDatabase(pool);
			const schema = await import("../../packages/domain/src/schema.ts");
			const rows = await storage.select({ body: schema.event.originalBody }).from(schema.event);
			assert.deepEqual(
				rows.map((row: { body: Buffer }) => row.body),
				[Buffer.from([0, 255, 42])],
			);
		} finally {
			db.release();
			await pool.end();
		}
	});
});

import { execFileSync } from "node:child_process";

test("U191 Node migration entrypoint applies committed history fixture", async () => {
	await withFixtures(async (f) => {
		const output = execFileSync("node", ["--import", "tsx", "scripts/migrate.ts", "--directory", "tests/fixtures/schema-history"], { encoding: "utf8", env: { ...process.env, MIGRATION_DATABASE_URL: f.databaseUrl } });
		assert.match(output, /Payload Bay migrations complete/);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			assert.ok((await db.query("SELECT to_regclass('payloadbay.execution') AS table_name")).rows[0].table_name, "migration entrypoint must create storage");
		} finally {
			await db.end();
		}
	});
});

test("U192 fixture infrastructure reuse preserves database isolation", async () => {
	let previous: URL | undefined;
	await withFixtures(async (f) => {
		previous = new URL(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			await db.query("CREATE TABLE private_fixture_marker(id integer)");
			await db.query("INSERT INTO private_fixture_marker VALUES(1)");
		} finally {
			await db.end();
		}
	});
	await withFixtures(async (f) => {
		const current = new URL(f.databaseUrl);
		assert.equal(current.port, previous!.port, "fixture infrastructure should be reused");
		assert.notEqual(current.pathname, previous!.pathname);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			assert.equal((await db.query("SELECT to_regclass('private_fixture_marker') AS marker")).rows[0].marker, null);
		} finally {
			await db.end();
		}
	});
});

test("U193 reused HTTP fixtures expose no earlier receipts", async () => {
	await withFixtures(async (f) => {
		assert.equal((await fetch(f.httpUrl + "/delivery", { method: "POST", body: "private-fixture" })).status, 200);
	});
	await withFixtures(async (f) => {
		assert.deepEqual(await (await fetch(f.httpUrl + "/receipts")).json(), []);
	});
});

test("U278 Drizzle source recreates complete usable domain schema", async () => {
	const { execFileSync } = await import("node:child_process");
	const { createRequire } = await import("node:module");
	const require = createRequire(new URL("../../packages/domain/package.json", import.meta.url));
	const { getTableConfig } = require("drizzle-orm/pg-core");
	const schema = await import("../../packages/domain/src/schema.ts");
	for (const [child, parent, column] of [
		[schema.ingressPolicy, schema.endpoint, "endpoint_id"],
		[schema.ingressRateBucket, schema.endpoint, "endpoint_id"],
		[schema.processingAttempt, schema.execution, "execution_id"],
	] as const) {
		const foreignKeys = getTableConfig(child).foreignKeys;
		assert.equal(foreignKeys.length, 1);
		assert.equal(foreignKeys[0].onDelete, "cascade", "private route state must follow its owner's lifecycle");
		const reference = foreignKeys[0].reference();
		assert.equal(reference.foreignTable, parent);
		assert.deepEqual(
			reference.columns.map((value: { name: string }) => value.name),
			[column],
		);
		assert.deepEqual(
			reference.foreignColumns.map((value: { name: string }) => value.name),
			["id"],
		);
	}

	await withFixtures(async (f) => {
		const sql = execFileSync(process.execPath, ["packages/domain/node_modules/drizzle-kit/bin.cjs", "export", "--dialect", "postgresql", "--schema", "packages/domain/src/schema.ts"], { encoding: "utf8" });
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			await db.query("CREATE SCHEMA payloadbay");
			await db.query(sql);
			let scope: Awaited<ReturnType<typeof seedScope>> | undefined;
			let failure: unknown;
			try {
				scope = await seedScope(db);
			} catch (error) {
				failure = error;
			}

			assert.ok(scope, "Drizzle schema must provide usable defaults and keys: " + String(failure));
			const event = await seedEvent(db, scope);
			const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING *", [event, scope.endpoint, scope.publication])).rows[0];
			assert.equal(execution.state, "queued");
			assert.equal(execution.max_attempts, 5);
			assert.ok(execution.created_at);
			const destination = (await db.query("INSERT INTO payloadbay.destination(project_id,name,http_config) VALUES($1,'Default','{}') RETURNING *", [scope.project])).rows[0];
			assert.equal(destination.concurrency, 4);
			assert.deepEqual(destination.secret_refs, []);
			assert.equal(destination.is_default, false);
			await assert.rejects(db.query("UPDATE payloadbay.execution SET max_attempts=0 WHERE id=$1", [execution.id]), { code: "23514" });
			await assert.rejects(db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'fixture-owner')", [scope.installation]), { code: "23505" });
			await assert.rejects(db.query("INSERT INTO payloadbay.draft(endpoint_id,stage) VALUES($1,'broken')", [scope.endpoint]), { code: "23514" });
			await assert.rejects(db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Duplicate','fixture','fixture-owner')", [scope.workspace]), { code: "23505" });
		} finally {
			await db.end();
		}
	});
});

test("U279 development bootstrap installs current source with no release artifacts", async () => {
	const { prepareDevelopmentDatabase } = await import("../../packages/domain/src/development.ts");
	await withFixtures(async (f) => {
		await prepareDevelopmentDatabase(f.databaseUrl);
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			assert.ok((await db.query("SELECT to_regclass('payloadbay.execution') AS installed")).rows[0].installed, "development source must install current tables");
			const scope = await seedScope(db);
			const event = await seedEvent(db, scope);
			await assert.rejects(db.query("UPDATE payloadbay.event SET original_body=$2 WHERE id=$1", [event, Buffer.from("changed")]), /immutable history/);
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.schema_migration")).rows[0].count, 0);
			await prepareDevelopmentDatabase(f.databaseUrl);
			assert.deepEqual((await db.query("SELECT original_body FROM payloadbay.event WHERE id=$1", [event])).rows[0].original_body, Buffer.from([0, 255, 42]));
			await db.query("SET ROLE payloadbay_app");
			await assert.rejects(db.query("SELECT * FROM graphile_worker.jobs"), { code: "42501" });
			await db.query("RESET ROLE");
		} finally {
			await db.end();
		}
	});
});

test("U281 db push installs developer schema without release generation", async () => {
	await withFixtures(async (f) => {
		execFileSync(process.execPath, ["--import", "tsx", "scripts/database/push.ts"], { env: { ...process.env, NODE_ENV: "development", DATABASE_URL: f.databaseUrl }, stdio: "pipe" });
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			assert.ok((await db.query("SELECT to_regclass('payloadbay.execution') AS installed")).rows[0].installed, "db push must install current schema");
			const scope = await seedScope(db);
			const event = await seedEvent(db, scope);
			await assert.rejects(db.query("UPDATE payloadbay.event SET original_body=$2 WHERE id=$1", [event, Buffer.from("changed")]), /immutable history/);
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.schema_migration")).rows[0].count, 0);
			execFileSync(process.execPath, ["--import", "tsx", "scripts/database/push.ts"], { env: { ...process.env, NODE_ENV: "development", DATABASE_URL: f.databaseUrl }, stdio: "pipe" });
			assert.deepEqual((await db.query("SELECT original_body FROM payloadbay.event WHERE id=$1", [event])).rows[0].original_body, Buffer.from([0, 255, 42]));
		} finally {
			await db.end();
		}
	});
});

test("U282 missing release artifacts fail before any database connection", async () => {
	await assert.rejects(migrateRelease("postgres://unavailable.invalid/never-connect"), { code: "release_migrations_unavailable" });
});
