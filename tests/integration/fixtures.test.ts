import test from "node:test";
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import nodemailer from "nodemailer";
import { createRequire } from "node:module";

const workerRequire = createRequire(new URL("../../apps/worker/package.json", import.meta.url));
const webRequire = createRequire(new URL("../../apps/web/package.json", import.meta.url));
import { withFixtures } from "../../scripts/tests/fixtures.ts";

test("disposable PostgreSQL rollback SMTP delivery and byte-exact HTTP fixtures work", async () => {
	await withFixtures(async (f) => {
		const db = new Client({ connectionString: f.databaseUrl });
		await db.connect();
		try {
			const graphile = await import(workerRequire.resolve("graphile-worker"));
			const queuePool = new Pool({ connectionString: f.databaseUrl });
			queuePool.on("error", () => console.error("Fixture queue database unavailable"));
			queuePool.on("connect", (client) => client.on("error", () => console.error("Fixture queue client unavailable")));
			await graphile.runMigrations({ pgPool: queuePool });
			const utils = await graphile.makeWorkerUtils({ pgPool: queuePool });
			try {
				await utils.addJob("bootstrap_fixture", { marker: "actual-job" });
				let marker = "";
				await graphile.runOnce({
					pgPool: queuePool,
					taskList: {
						bootstrap_fixture: async (payload: any) => {
							marker = payload.marker;
						},
					},
					concurrency: 1,
					noHandleSignals: true,
				});
				assert.equal(marker, "actual-job");
			} finally {
				await utils.release();
				await queuePool.end();
			}

			const zod = await import(webRequire.resolve("zod"));
			assert.equal(zod.z.string().parse("fixture"), "fixture");
			const drizzle = await import(webRequire.resolve("drizzle-orm/node-postgres"));
			assert.equal((await drizzle.drizzle(db).execute(drizzle.sql ?? (await import(webRequire.resolve("drizzle-orm"))).sql`select 1 as ready`)).rows[0].ready, 1);
			const auth = await import(webRequire.resolve("better-auth"));
			assert.equal(typeof auth.betterAuth, "function");
			const version = await db.query("SHOW server_version");
			assert.match(version.rows[0].server_version, /^17\./);
			await db.query("CREATE TABLE bootstrap_probe (body bytea NOT NULL)");
			await db.query("BEGIN");
			await db.query("INSERT INTO bootstrap_probe VALUES ($1)", [Buffer.from([0, 255, 42])]);
			await db.query("ROLLBACK");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM bootstrap_probe")).rows[0].count, 0);
			const transport = nodemailer.createTransport({ host: "127.0.0.1", port: f.smtpPort, secure: false });
			await transport.sendMail({
				from: "fixture@example.test",
				to: "operator@example.test",
				subject: "Bootstrap fixture",
				text: "Synthetic test message",
			});
			let mail: any;
			for (let i = 0; i < 50; i++) {
				mail = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
				if (mail.total > 0) break;
				await new Promise((r) => setTimeout(r, 100));
			}

			assert.equal(mail.total, 1);
			const bytes = Buffer.from([0, 255, 42]);
			const response = await fetch(f.httpUrl + "/delivery", { method: "POST", body: bytes });
			const actual = await response.json();
			assert.equal(actual.body, bytes.toString("base64"));
		} finally {
			await db.end();
		}
	});
});

test("late-imported fixture cleanup removes the last stack when the test process exits", async () => {
	const { execFileSync } = await import("node:child_process");
	const moduleUrl = new URL("../../scripts/tests/fixtures.ts", import.meta.url).href;
	const source = `
		import test from 'node:test';
		test('first late import', async () => {
			const { withFixtures } = await import(${JSON.stringify(moduleUrl)});
			await withFixtures(async fixture => console.log('fixture-network:' + fixture.network));
		});
		test('later fixture use', async () => {
			const { withFixtures } = await import(${JSON.stringify(moduleUrl)});
			await withFixtures(async fixture => console.log('fixture-network:' + fixture.network));
		});
	`;
	const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", source], { encoding: "utf8", timeout: 120000 });
	const network = [...output.matchAll(/fixture-network:(pab-test-[a-f0-9]+_default)/g)].at(-1)?.[1];
	assert.ok(network, "The subprocess must actually create disposable infrastructure");
	try {
		const remaining = execFileSync("docker", ["network", "ls", "--format", "{{.Name}}"], { encoding: "utf8" }).trim().split("\n");
		assert.equal(remaining.includes(network), false, "The later test's stack must not leak after normal process exit");
	} finally {
		execFileSync("docker", ["compose", "-f", "deploy/compose.dev.yml", "-p", network.replace(/_default$/, ""), "down", "--volumes", "--remove-orphans", "--timeout", "5"], { stdio: "ignore" });
	}
});
