import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const workflow = JSON.parse(execFileSync("bun", ["-e", 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(".github/workflows/release-candidate.yml").text())))'], { encoding: "utf8" }));
const policy = workflow.jobs.policy.steps.find((step: { run?: string }) => step.run).run as string;

async function candidatePolicy(
	options: {
		missing?: "sql" | "journal";
		stale?: boolean;
		unmerged?: boolean;
		ref?: string;
		sha?: string;
		api?: string;
		apiStatus?: number;
	} = {},
) {
	const directory = await mkdtemp(join(tmpdir(), "pab-candidate-policy-"));

	const git = (args: string[]) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	try {
		git(["init"]);
		git(["config", "user.name", "Policy Fixture"]);
		git(["config", "user.email", "fixture@example.test"]);
		await mkdir(join(directory, "packages/domain/src"), { recursive: true });
		await mkdir(join(directory, "packages/domain/drizzle/meta"), { recursive: true });
		await writeFile(join(directory, "packages/domain/src/schema.ts"), "export const fixture = 1;");
		if (options.missing !== "sql") await writeFile(join(directory, "packages/domain/drizzle/0000_test_fixture.sql"), "-- synthetic policy fixture, not release SQL");
		if (options.missing !== "journal") await writeFile(join(directory, "packages/domain/drizzle/meta/_journal.json"), "{}");
		git(["add", "."]);
		git(["commit", "-m", "test fixture migration"]);
		git(["update-ref", "refs/remotes/origin/master", "HEAD"]);
		if (options.stale || options.unmerged) {
			await writeFile(join(directory, "packages/domain/src/schema.ts"), "export const fixture = 2;");
			git(["add", "."]);
			git(["commit", "-m", "test fixture schema change"]);
			if (!options.unmerged) git(["update-ref", "refs/remotes/origin/master", "HEAD"]);
		}

		const sha = git(["rev-parse", "HEAD"]);
		const bin = join(directory, "bin");
		await mkdir(bin);
		await writeFile(join(bin, "gh"), '#!/bin/sh\nprintf called > "$POLICY_CALLED"\nprintf "%s\\n" "$POLICY_API"\nexit "$POLICY_API_STATUS"\n', { mode: 0o700 });
		const output = join(directory, "outputs");
		const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-c", policy], {
			cwd: directory,
			encoding: "utf8",
			timeout: 5000,
			env: {
				PATH: bin + ":" + process.env.PATH,
				SOURCE_SHA: options.sha ?? sha,
				WORKFLOW_REF: options.ref ?? "refs/heads/master",
				REPOSITORY: "payloadbay/payloadbay",
				GITHUB_OUTPUT: output,
				POLICY_API: options.api ?? "true",
				POLICY_API_STATUS: String(options.apiStatus ?? 0),
				POLICY_CALLED: join(directory, "called"),
			},
		});
		assert.equal(result.error, undefined);
		const { readFile, access } = await import("node:fs/promises");

		return {
			status: result.status,
			stderr: result.stderr,
			sha,
			output: await readFile(output, "utf8").catch(() => ""),
			called: await access(join(directory, "called")).then(
				() => true,
				() => false,
			),
		};
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("RC01 candidate eligibility accepts only an immutable master commit with current SQL and passing CI", async () => {
	const result = await candidatePolicy();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.output, "ref=" + result.sha + "\n");
	assert.equal(result.called, true);
});

test("RC02 branch workflows, mutable source names and unmerged commits cannot authorize candidate builds", async () => {
	for (const options of [{ ref: "refs/heads/feature" }, { sha: "master" }, { unmerged: true }]) {
		const result = await candidatePolicy(options);
		assert.notEqual(result.status, 0);
		assert.equal(result.output, "");
		assert.equal(result.called, false);
	}
});

test("RC03 absent release SQL or journal cannot be replaced by development schema push", async () => {
	for (const missing of ["sql", "journal"] as const) {
		const result = await candidatePolicy({ missing });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /CI-generated release SQL and journal are required/);
		assert.equal(result.called, false);
	}
});

test("RC04 schema changes after the last migration block candidate images before credentials are used", async () => {
	const result = await candidatePolicy({ stale: true });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Database source changed/);
	assert.equal(result.called, false);
});

test("RC05 failed or unavailable alpha CI cannot authorize publication, including partial true responses", async () => {
	for (const options of [{ api: "false" }, { api: "true", apiStatus: 1 }, { api: "" }]) {
		const result = await candidatePolicy(options);
		assert.equal(result.status, 1);
		assert.equal(result.output, "");
		assert.equal(result.called, true);
	}
});
