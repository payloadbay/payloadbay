import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type Workflow = { jobs: Record<string, { needs?: string | string[]; environment?: string; steps?: { run?: string; uses?: string }[] }> };

const workflow: Workflow = JSON.parse(execFileSync("bun", ["-e", 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(".github/workflows/alpha-ci.yml").text())))'], { encoding: "utf8" }));
const policy = workflow.jobs.policy.steps?.find((step) => step.run)?.run;
assert.ok(policy);

interface PolicyOptions {
	external: boolean;
	response?: string;
	status?: number;
	ref?: string;
}

async function evaluatePolicy(options: PolicyOptions) {
	const directory = await mkdtemp(join(tmpdir(), "payloadbay-ci-policy-"));
	try {
		const output = join(directory, "outputs");
		const called = join(directory, "called");
		await writeFile(join(directory, "gh"), '#!/bin/sh\nprintf called > "$POLICY_CALLED"\nprintf "%s\\n" "$POLICY_RESPONSE"\nexit "$POLICY_STATUS"\n', { mode: 0o700 });
		// Match GitHub's implicit Linux shell. No real token or network is used.
		const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-c", policy!], {
			encoding: "utf8",
			timeout: 3000,
			env: {
				PATH: directory + ":" + process.env.PATH,
				REPOSITORY: "payloadbay/payloadbay",
				TEST_REF: options.ref ?? "a".repeat(40),
				EXTERNAL_REQUEST: String(options.external),
				GITHUB_OUTPUT: output,
				POLICY_CALLED: called,
				POLICY_RESPONSE: options.response ?? "true",
				POLICY_STATUS: String(options.status ?? 0),
			},
		});
		assert.equal(result.error, undefined);

		return {
			status: result.status,
			output: await readFile(output, "utf8").catch(() => ""),
			called: await access(called).then(
				() => true,
				() => false,
			),
		};
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("CI01 external builds deny missing reviewer protection", async () => {
	const result = await evaluatePolicy({ external: true, response: "false" });
	assert.equal(result.status, 1);
	assert.equal(result.output, "");
});

test("CI02 external protection lookup failures cannot authorize code even with partial true output", async () => {
	const result = await evaluatePolicy({ external: true, response: "true", status: 1 });
	assert.equal(result.status, 1);
	assert.equal(result.output, "");
});

test("CI03 protected external builds select native review and pin the exact source", async () => {
	const result = await evaluatePolicy({ external: true });
	assert.equal(result.status, 0);
	assert.equal(result.output, "environment=alpha-ci-external\nref=" + "a".repeat(40) + "\n");
});

test("CI04 maintainer builds pin source without an external protection lookup", async () => {
	const result = await evaluatePolicy({ external: false, status: 1 });
	assert.equal(result.status, 0);
	assert.equal(result.called, false);
	assert.equal(result.output, "environment=alpha-ci\nref=" + "a".repeat(40) + "\n");
});

test("CI05 invalid mutable source references fail before any authorization lookup", async () => {
	const result = await evaluatePolicy({ external: true, ref: "refs/pull/13/head" });
	assert.equal(result.status, 1);
	assert.equal(result.called, false);
	assert.equal(result.output, "");
});

test("CI06 checkout and licensed steps depend on completed native authorization", () => {
	assert.deepEqual(workflow.jobs.checks.needs, ["policy", "authorize"]);
	assert.equal(workflow.jobs.authorize.needs, "policy");
	assert.equal(workflow.jobs.authorize.environment, "${{ needs.policy.outputs.environment }}");
	for (const job of [workflow.jobs.policy, workflow.jobs.authorize])
		assert.equal(
			job.steps?.some((step) => step.uses?.startsWith("actions/checkout@")),
			false,
		);
});
