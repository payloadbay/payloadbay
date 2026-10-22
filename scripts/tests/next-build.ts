import { normalizeNextSourceMaps } from "./coverage.ts";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

let failedBuild: { hash: string; error: Error } | undefined;

export function nextBuildFingerprint(sourceCoverage = false) {
	const files = execFileSync("rg", ["--files", "apps/web/src", "packages/domain/src", "packages/contracts/src", "packages/script-sdk/src", "apps/executor/src"], { encoding: "utf8" }).trim().split("\n").sort();
	files.push("bun.lock", "apps/web/package.json", "apps/web/next.config.ts", "apps/web/tsconfig.json", "apps/web/scripts/prepare-standalone.mjs", "scripts/tests/coverage.ts", "scripts/tests/function-coverage.ts", "scripts/tests/next-build.ts");
	const digest = createHash("sha256");
	for (const file of files) {
		digest.update(file);
		digest.update(readFileSync(file));
	}

	digest.update(`sourceCoverage=${sourceCoverage}`);

	return digest.digest("hex");
}

export function ensureNextBuild(sourceCoverage = process.env.PAB_TEST_SOURCE_COVERAGE === "true") {
	const hash = nextBuildFingerprint(sourceCoverage);
	const marker = "apps/web/.next/payloadbay-test-build";
	if (failedBuild?.hash === hash) throw failedBuild.error;
	if (existsSync(marker) && readFileSync(marker, "utf8") === hash && existsSync("apps/web/.next/standalone/apps/web/server.js")) return;
	try {
		execFileSync("bun", ["run", "web:build"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PAB_TEST_SOURCE_COVERAGE: String(sourceCoverage) } });
	} catch (error) {
		const failed = error as { stdout?: Buffer; stderr?: Buffer };
		const output = Buffer.concat([failed.stdout ?? Buffer.alloc(0), failed.stderr ?? Buffer.alloc(0)]);
		mkdirSync("test-results", { recursive: true });
		writeFileSync("test-results/next-build-failure.txt", output);
		console.error(output.toString());
		const failure = Error("Next fixture build failed; see test-results/next-build-failure.txt");
		failedBuild = { hash, error: failure };
		throw failure;
	}

	if (sourceCoverage) normalizeNextSourceMaps();
	writeFileSync(marker, hash);
}
