import { executorFixture } from "./executor-fixture.ts";
import { fixtureEnvironment } from "./fixture-environment.ts";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { authFixture } from "./auth-fixtures.ts";
import { ensureNextBuild } from "../../scripts/tests/next-build.ts";
import { provisionRuntimeLogins } from "../../packages/domain/src/runtime-logins.ts";
import { database } from "../../packages/domain/src/db.ts";

export async function nextFixture(
	run: (f: Parameters<Parameters<typeof authFixture>[0]>[0] & { url: string; executorUrl: string }) => Promise<void>,
	options: {
		preview?: boolean;
		loginHint?: string;
		runtimePasswords?: { app: string; worker: string };
	} = {},
) {
	await authFixture(async (f) => {
		ensureNextBuild();
		const listener = createServer();
		listener.listen(0, "127.0.0.1");
		await once(listener, "listening");
		const port = (listener.address() as { port: number }).port;
		await new Promise<void>((r) => listener.close(() => r()));
		const url = "http://127.0.0.1:" + port;
		const appUrl = new URL(f.databaseUrl);
		let workerPool: ReturnType<typeof database> | undefined;
		if (options.runtimePasswords) {
			await provisionRuntimeLogins(f.databaseUrl, options.runtimePasswords);
			appUrl.username = "payloadbay_web";
			appUrl.password = "";
			const workerUrl = new URL(f.databaseUrl);
			workerUrl.username = "payloadbay_jobs";
			workerUrl.password = options.runtimePasswords.worker;
			workerPool = database(workerUrl.toString());
		}

		const executor = await executorFixture();
		const child = spawn("node", ["apps/web/.next/standalone/apps/web/server.js"], {
			env: {
				...fixtureEnvironment(f, url),
				DATABASE_URL: appUrl.toString(),
				PGPASSWORD: options.runtimePasswords?.app,
				IS_PREVIEW: options.preview ? "true" : "false",
				PAYLOADBAY_LOGIN_HINT: options.loginHint ?? "",
				PORT: String(port),
				HOSTNAME: "127.0.0.1",
				EXECUTOR_URL: executor.url,
			},
			stdio: ["ignore", "pipe", "pipe"],
		});
		child.stdout?.resume();
		child.stderr?.resume();
		try {
			let ready = false;
			for (let i = 0; i < 200; i++) {
				try {
					await fetch(url + "/api/auth/get-session");
					ready = true;
					break;
				} catch {
					await new Promise((r) => setTimeout(r, 50));
				}
			}

			if (!ready) throw Error("Next fixture did not start");
			await run({
				...f,
				pool: workerPool ?? f.pool,
				url,
				executorUrl: executor.url,
			});
		} finally {
			if (child.exitCode === null) {
				const exited = once(child, "exit");
				child.kill("SIGTERM");
				await exited;
			}

			await workerPool?.end();
			await executor.stop();
		}
	});
}
