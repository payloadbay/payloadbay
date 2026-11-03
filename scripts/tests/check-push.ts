import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const runId = randomUUID();
for (const args of [
	["run", "test", "--collect-coverage"],
	["run", "test:coverage:merge", `test-results/${runId}`],
]) {
	const result = spawnSync("bun", args, { stdio: "inherit", env: { ...process.env, PAB_TEST_RUN_ID: runId } });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
