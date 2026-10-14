import { executorFixture } from "../../tests/helpers/executor-fixture.ts";
import { fixtureEnvironment } from "../../tests/helpers/fixture-environment.ts";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { withFixtures, stopFixtures } from "./fixtures.ts";
import { ensureNextBuild } from "./next-build.ts";
import { database } from "../../packages/domain/src/db.ts";
import { prepareDevelopmentDatabase as migrate } from "../../packages/domain/src/development.ts";
import { readServerConfig } from "../../packages/domain/src/config.ts";
import { run } from "../../apps/worker/node_modules/graphile-worker/dist/index.js";
import { mailTask } from "../../apps/worker/src/tasks/mail.ts";

let status = 1;
try {
	ensureNextBuild();
	await withFixtures(async (fixture) => {
		await migrate(fixture.databaseUrl);
		const pool = database(fixture.databaseUrl);
		const executor = await executorFixture();
		const env = fixtureEnvironment(fixture, "http://127.0.0.1:" + process.env.PAB_TEST_PORT);
		env.EXECUTOR_URL = executor.url;
		const worker = await run({
			pgPool: pool,
			noHandleSignals: true,
			pollInterval: 100,
			concurrency: 1,
			taskList: { platform_job: mailTask(pool, readServerConfig(env)) },
		});
		try {
			const child = spawn("bun", ["x", "--no-install", "playwright", "test", "--config=tests/config/playwright.config.ts", ...process.argv.slice(2)], { env, stdio: "inherit" });
			const [code] = await once(child, "exit");
			status = Number(code ?? 1);
		} finally {
			await worker.stop();
			await pool.end();
			await executor.stop();
		}
	});
} finally {
	await stopFixtures();
}

process.exitCode = status;
