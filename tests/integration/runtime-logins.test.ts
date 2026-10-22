import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { authFixture } from "../helpers/auth-fixtures.ts";
import { provisionRuntimeLogins } from "../../packages/domain/src/runtime-logins.ts";

const passwords = { app: "fixture-app-password-with-'quote-32-characters", worker: "fixture-worker-password-distinct-32-characters" };

test("RI04 runtime database logins inherit only their own application role", async () => {
	await authFixture(async (fixture) => {
		await provisionRuntimeLogins(fixture.databaseUrl, passwords);

		const connect = async (name: string, password: string) => {
			const url = new URL(fixture.databaseUrl);
			url.username = name;
			url.password = "";
			const previous = process.env.PGPASSWORD;
			process.env.PGPASSWORD = password;
			const client = new Client({ connectionString: url.toString() });
			if (previous === undefined) delete process.env.PGPASSWORD;
			else process.env.PGPASSWORD = previous;
			await client.connect();

			return client;
		};

		const app = await connect("payloadbay_web", passwords.app);
		const worker = await connect("payloadbay_jobs", passwords.worker);
		try {
			await app.query('SELECT id FROM auth."user" LIMIT 0');
			await app.query("SELECT id FROM payloadbay.event LIMIT 0");
			await worker.query("SELECT id FROM graphile_worker._private_jobs LIMIT 0");
			await worker.query('SELECT id FROM auth."user" LIMIT 0');
			for (const client of [app, worker]) {
				await assert.rejects(client.query("CREATE TABLE payloadbay.forbidden_runtime_ddl(id integer)"), { code: "42501" });
				await assert.rejects(client.query("SELECT * FROM payloadbay.schema_migration"), { code: "42501" });
				await assert.rejects(client.query("CREATE ROLE forbidden_runtime_admin SUPERUSER"), { code: "42501" });
			}

			await assert.rejects(app.query("SELECT * FROM graphile_worker._private_jobs"), { code: "42501" });
			await assert.rejects(worker.query('SELECT * FROM auth."session"'), { code: "42501" });
			await provisionRuntimeLogins(fixture.databaseUrl, passwords);
			assert.equal((await app.query("SELECT current_user AS name")).rows[0].name, "payloadbay_web");
			const { runOnce } = await import("../../apps/worker/node_modules/graphile-worker/dist/index.js");
			const workerUrl = new URL(fixture.databaseUrl);
			workerUrl.username = "payloadbay_jobs";
			workerUrl.password = passwords.worker;
			const { database } = await import("../../packages/domain/src/db.ts");
			const pool = database(workerUrl.toString());
			try {
				await fixture.db.query("SELECT graphile_worker.add_job('runtime_permission_probe','{}'::json)");
				let processed = 0;
				await runOnce({
					pgPool: pool,
					noHandleSignals: true,
					concurrency: 1,
					taskList: {
						runtime_permission_probe: async () => {
							processed++;
						},
					},
				});
				assert.equal(processed, 1, "The restricted login must run the real queue consumer without DDL rights");
			} finally {
				await pool.end();
			}
		} finally {
			await app.end();
			await worker.end();
		}
	});
});

test("RI05 provisioning rejects weak/shared credentials and existing administrator roles atomically", async () => {
	await authFixture(async (fixture) => {
		await assert.rejects(provisionRuntimeLogins(fixture.databaseUrl, { app: "short", worker: passwords.worker }), { code: "runtime_credentials_invalid" });
		await assert.rejects(provisionRuntimeLogins(fixture.databaseUrl, { app: passwords.app, worker: passwords.app }), { code: "runtime_credentials_invalid" });
		await provisionRuntimeLogins(fixture.databaseUrl, passwords);
		await fixture.db.query("ALTER ROLE payloadbay_jobs CREATEDB");
		try {
			await assert.rejects(provisionRuntimeLogins(fixture.databaseUrl, { ...passwords, app: passwords.app + "-rotated" }), { code: "runtime_role_unsafe" });
			const url = new URL(fixture.databaseUrl);
			url.username = "payloadbay_web";
			url.password = passwords.app;
			const unchanged = new Client({ connectionString: url.toString() });
			await unchanged.connect();
			await unchanged.end();
		} finally {
			await fixture.db.query("ALTER ROLE payloadbay_jobs NOCREATEDB");
		}

		await fixture.db.query("GRANT payloadbay_worker TO payloadbay_web");
		try {
			await assert.rejects(provisionRuntimeLogins(fixture.databaseUrl, passwords), { code: "runtime_role_unsafe" });
		} finally {
			await fixture.db.query("REVOKE payloadbay_worker FROM payloadbay_web");
		}
	});
});
