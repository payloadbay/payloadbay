import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";

for (const failure of ["test", "test:coverage:merge", "none"]) {
	test("push validation propagates " + failure + " and only merges passing test evidence", () => {
		const directory = mkdtempSync(join(tmpdir(), "payloadbay-push-check-"));
		const commands = join(directory, "commands.jsonl");
		try {
			const executable = join(directory, "bun");
			writeFileSync(executable, `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nconst args = process.argv.slice(2);\nappendFileSync(process.env.PAB_PUSH_COMMANDS, JSON.stringify({ args, runId: process.env.PAB_TEST_RUN_ID, gitDir: process.env.GIT_DIR ?? null, gitIndex: process.env.GIT_INDEX_FILE ?? null, workflowRef: process.env.GITHUB_REF }) + "\\n");\nprocess.exit(args[1] === process.env.PAB_PUSH_FAILURE ? 23 : 0);\n`);
			chmodSync(executable, 0o755);
			const result = spawnSync(process.execPath, [resolve("scripts/tests/check-push.ts")], {
				cwd: directory,
				env: {
					...process.env,
					PATH: directory + delimiter + process.env.PATH,
					PAB_PUSH_COMMANDS: commands,
					PAB_PUSH_FAILURE: failure,
					GIT_DIR: join(directory, "inherited-worktree-metadata"),
					GIT_INDEX_FILE: join(directory, "inherited-index"),
					GITHUB_REF: "refs/heads/fixture",
				},
				encoding: "utf8",
			});
			expect(result.status).toBe(failure === "none" ? 0 : 23);
			const calls = readFileSync(commands, "utf8")
				.trim()
				.split("\n")
				.map(
					(line) =>
						JSON.parse(line) as {
							args: string[];
							runId: string;
							gitDir: string | null;
							gitIndex: string | null;
							workflowRef: string;
						},
				);
			expect(calls[0].gitDir).toBeNull();
			expect(calls[0].gitIndex).toBeNull();
			expect(calls[0].workflowRef).toBe("refs/heads/fixture");
			expect(calls[0].args).toEqual(["run", "test", "--collect-coverage"]);
			expect(calls).toHaveLength(failure === "test" ? 1 : 2);
			if (failure !== "test") {
				expect(calls[1].runId).toBe(calls[0].runId);
				expect(calls[1].args).toEqual(["run", "test:coverage:merge", `test-results/${calls[0].runId}`]);
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
