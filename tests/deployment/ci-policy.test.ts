import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type Workflow = { jobs: Record<string, { needs?: string | string[]; environment?: string | { name: string; deployment: boolean }; steps?: { run?: string; uses?: string }[] }> };

const workflow: Workflow = JSON.parse(execFileSync("bun", ["-e", 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(".github/workflows/ci.yml").text())))'], { encoding: "utf8" }));
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
	assert.equal(result.output, "environment=ci-external-review\nref=" + "a".repeat(40) + "\n");
});

test("CI04 maintainer builds pin source without an external protection lookup", async () => {
	const result = await evaluatePolicy({ external: false, status: 1 });
	assert.equal(result.status, 0);
	assert.equal(result.called, false);
	assert.equal(result.output, "environment=none\nref=" + "a".repeat(40) + "\n");
});

test("CI05 invalid mutable source references fail before any authorization lookup", async () => {
	const result = await evaluatePolicy({ external: true, ref: "refs/pull/13/head" });
	assert.equal(result.status, 1);
	assert.equal(result.called, false);
	assert.equal(result.output, "");
});

test("CI06 checkout and build steps depend on completed native authorization", () => {
	assert.deepEqual(workflow.jobs.checks.needs, ["policy", "authorize"]);
	assert.deepEqual(workflow.jobs.authorize.needs, ["policy", "review"]);
	assert.equal(workflow.jobs.review.needs, "policy");
	assert.deepEqual(workflow.jobs.review.environment, { name: "ci-external-review", deployment: false });
	assert.equal(workflow.jobs.authorize.environment, undefined);
	for (const job of [workflow.jobs.policy, workflow.jobs.review, workflow.jobs.authorize])
		assert.equal(
			job.steps?.some((step) => step.uses?.startsWith("actions/checkout@")),
			false,
		);
});

test("CI07 final validation cannot pass without the mandatory merged coverage owner", () => {
	assert.deepEqual(workflow.jobs.coverage.needs, ["policy", "authorize", "checks"]);
	assert.deepEqual(workflow.jobs.result.needs, ["policy", "authorize", "checks", "coverage"]);
	const gate = workflow.jobs.result.steps?.find((step) => step.run)?.run;
	assert.ok(gate);
	for (const state of ["success", "failure", "skipped", "cancelled", ""]) {
		const result: import("node:child_process").SpawnSyncReturns<string> = spawnSync("bash", ["--noprofile", "--norc", "-e", "-c", gate], {
			encoding: "utf8",
			timeout: 3000,
			env: {
				PATH: process.env.PATH,
				CHECK_RESULT: "success",
				POLICY_RESULT: "success",
				AUTHORIZATION_RESULT: "success",
				COVERAGE_RESULT: state,
			},
		});
		assert.equal(result.error, undefined);
		assert.equal(result.status, state === "success" ? 0 : 1);
	}
});

test("CI08 skipped or failed external approval cannot authorize source checks", () => {
	const gate = workflow.jobs.authorize.steps?.find((step) => step.run)?.run;
	assert.ok(gate);
	for (const environment of ["none", "ci-external-review", "unexpected", ""]) {
		for (const state of ["success", "failure", "skipped", "cancelled", ""]) {
			const result: import("node:child_process").SpawnSyncReturns<string> = spawnSync("bash", ["--noprofile", "--norc", "-e", "-c", gate], {
				encoding: "utf8",
				timeout: 3000,
				env: {
					PATH: process.env.PATH,
					REVIEW_ENVIRONMENT: environment,
					REVIEW_RESULT: state,
					TEST_REF: "a".repeat(40),
					GITHUB_STEP_SUMMARY: "/dev/null",
				},
			});
			assert.equal(result.error, undefined);
			assert.equal(result.status, (environment === "none" && state === "skipped") || (environment === "ci-external-review" && state === "success") ? 0 : 1);
		}
	}
});

test("CI09 source builds use public dependencies without a UI installer credential", async () => {
	const paths = [".github/workflows/ci.yml", ".github/workflows/release-candidate.yml", "deploy/Dockerfile.app", "deploy/compose.preview.yml"];
	for (const path of paths) assert.doesNotMatch(await readFile(path, "utf8"), /HEROUI_AUTH_TOKEN|heroui_auth_token|bun x heroui-pro/);
	const web = JSON.parse(await readFile("apps/web/package.json", "utf8"));
	assert.equal(web.dependencies["@heroui-pro/react"], undefined);
});
