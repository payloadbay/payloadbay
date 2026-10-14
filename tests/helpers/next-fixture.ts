import { executorFixture } from "./executor-fixture.ts";
import { fixtureEnvironment } from "./fixture-environment.ts";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { authFixture } from "./auth-fixtures.ts";
import { ensureNextBuild } from "../../scripts/tests/next-build.ts";

export async function nextFixture(run: (f: Parameters<Parameters<typeof authFixture>[0]>[0] & { url: string; executorUrl: string }) => Promise<void>, options: { preview?: boolean } = {}) {
	await authFixture(async (f) => {
		ensureNextBuild();
		const listener = createServer();
		listener.listen(0, "127.0.0.1");
		await once(listener, "listening");
		const port = (listener.address() as { port: number }).port;
		await new Promise<void>((r) => listener.close(() => r()));
		const url = "http://127.0.0.1:" + port;
		const executor = await executorFixture();
		const child = spawn("node", ["apps/web/.next/standalone/apps/web/server.js"], {
			env: {
				...fixtureEnvironment(f, url),
				IS_PREVIEW: options.preview ? "true" : "false",
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
			await run({ ...f, url, executorUrl: executor.url });
		} finally {
			if (child.exitCode === null) {
				const exited = once(child, "exit");
				child.kill("SIGTERM");
				await exited;
			}

			await executor.stop();
		}
	});
}
