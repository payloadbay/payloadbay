import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const runId = randomUUID();
const environment: Record<string, string | undefined> = { ...process.env, PAB_TEST_RUN_ID: runId };
for (const name of execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).trim().split("\n")) delete environment[name];
for (const args of [
	["run", "test", "--collect-coverage"],
	["run", "test:coverage:merge", `test-results/${runId}`],
]) {
	const result = spawnSync("bun", args, { stdio: "inherit", env: environment });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
