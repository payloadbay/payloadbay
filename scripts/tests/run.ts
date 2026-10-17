import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { build } from "esbuild";
import { runNodeCoverage } from "./coverage.ts";
import { ensureNextBuild } from "./next-build.ts";
import { inventory, registry } from "./inventory.ts";
import { selectAffected, assertNonemptyRun, checkCoverage, testLanes } from "./policy.ts";

const args = process.argv.slice(2);
const mode = args.shift() ?? "suite";
const coverageAt = args.indexOf("--collect-coverage");
const collectCoverage = coverageAt >= 0;
if (collectCoverage) args.splice(coverageAt, 1);
const all = inventory();
let files = all;
if (mode === "file") {
	const file = args.shift();
	if (!file || !all.includes(file)) throw Error("Unknown registered test file");
	files = [file];
} else if (mode === "affected") {
	const dependencies: Record<string, string[]> = {};
	try {
		for (const file of all) {
			const r = await build({
				entryPoints: [file],
				bundle: true,
				format: "esm",
				platform: "node",
				packages: "external",
				external: ["bun:test"],
				write: false,
				metafile: true,
				tsconfig: "tests/config/tsconfig.json",
			});
			dependencies[file] = Object.keys(r.metafile!.inputs);
		}
	} catch {
		console.error("Dependency analysis incomplete; selecting full inventory");
	}

	files = selectAffected(args, all, dependencies);
} else if (mode !== "suite" && mode !== "coverage" && !testLanes.some((lane) => lane === mode)) throw Error("Unknown test mode");
if (testLanes.some((lane) => lane === mode)) files = all.filter((f) => registry.owners[f] === mode);
if (!files.length) throw Error("Empty test selection");
if (collectCoverage && files.some((file) => !["node", "executor", "deployment"].includes(registry.owners[file]))) throw Error("Source-mapped collection currently supports Node, executor and deployment owners only");
const grep = mode === "file" && args[0] === "--name" ? args[1] : undefined;
if (mode === "file" && args.length && (!grep || args.length !== 2)) throw Error("Expected --name followed by test name");
const runId = process.env.PAB_TEST_RUN_ID ?? randomUUID();
const reports = `test-results/${runId}`;
const coverageFile = resolve(`${reports}/unit/coverage/lcov.info`);
const lanes = testLanes;
let passed = 0;
for (const lane of lanes) {
	const selected = files.filter((f) => registry.owners[f] === lane);
	if (!selected.length) continue;
	if (mode === "coverage" && lane !== "unit") continue;
	const env: NodeJS.ProcessEnv & { PAB_TEST_ARTIFACT_DIR: string } = {
		...process.env,
		TZ: "UTC",
		TSX_TSCONFIG_PATH: resolve("tests/config/tsconfig.json"),
		PAB_TEST_ARTIFACT_DIR: `${reports}/${lane}`,
	};
	mkdirSync(env.PAB_TEST_ARTIFACT_DIR, { recursive: true });
	if (lane === "browser") {
		const listener = createServer();
		await new Promise<void>((r) => listener.listen(0, "127.0.0.1", r));
		env.PAB_TEST_PORT = String((listener.address() as { port: number }).port);
		await new Promise<void>((r) => listener.close(() => r()));
	}

	// Prepare shared app artifacts before launching owning test processes.
	if (selected.some((file) => registry.nextBuildConsumers.includes(file))) ensureNextBuild();

	let command = "bun";
	let options: string[] = [];
	if (lane === "unit") {
		options = ["test", ...selected, ...(grep ? ["--test-name-pattern", grep] : [])];
		if (mode === "coverage") {
			// Pinned Bun favors bunfig reporting settings over CLI overrides. Collect
			// fresh LCOV alone, then enforce our existing explicit line/function gate.
			let configuration = readFileSync("bunfig.toml", "utf8");
			for (const [key, value] of [
				["root", JSON.stringify(resolve("tests/unit"))],
				["coverageReporter", '["lcov"]'],
				["coverageDir", JSON.stringify(resolve(`${reports}/unit/coverage`))],
			]) {
				const field = new RegExp(`^${key}\\s*=.*$`, "m");
				if (!field.test(configuration)) throw Error(`Missing coverage configuration: ${key}`);
				configuration = configuration.replace(field, `${key} = ${value}`);
			}

			const configurationFile = resolve(`${reports}/unit/bunfig.coverage.toml`);
			writeFileSync(configurationFile, configuration);
			rmSync(coverageFile, { force: true });
			options.push(`--config=${configurationFile}`, "--coverage");
		}
	} else if (lane === "browser") {
		command = "node";
		options = ["--import", "tsx", "scripts/tests/browser.ts", ...selected, ...(grep ? ["--grep", grep] : [])];
	} else {
		command = "node";
		options = ["--import", "tsx", "--test", lane === "performance" ? "--test-concurrency=1" : "--test-concurrency=2", ...(grep ? ["--test-name-pattern", grep] : []), ...selected];
	}

	const result = collectCoverage ? runNodeCoverage(options, { directory: `${env.PAB_TEST_ARTIFACT_DIR}/coverage`, env, include: ["apps/**/src/**/*.ts", "packages/**/src/**/*.ts", "packages/**/src/**/*.tsx", "scripts/**/*.ts"] }) : spawnSync(command, options, { encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 });
	writeFileSync(`${env.PAB_TEST_ARTIFACT_DIR}/console.txt`, (result.stdout ?? "") + (result.stderr ?? ""));
	process.stdout.write(result.stdout ?? "");
	process.stderr.write(result.stderr ?? "");
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
	const report = (result.stdout ?? "") + (result.stderr ?? "");
	if (lane === "browser") {
		const match = report.match(/(\d+) passed/);
		if (!match || Number(match[1]) === 0) throw Error("No passing browser tests");
		passed += Number(match[1]);
	} else passed += assertNonemptyRun(lane === "unit" ? "bun" : "node", report);
}

if (!passed) throw Error("No passing tests");
if (mode === "coverage") {
	const configuration = Bun.TOML.parse(readFileSync("bunfig.toml", "utf8")) as { test: { coverageThreshold: number | { lines: number; functions: number } } };
	console.log("Unit-loaded coverage gate:", checkCoverage(readFileSync(coverageFile, "utf8"), registry.coverageSources, configuration.test.coverageThreshold));
}

writeFileSync(
	`${reports}/summary.json`,
	JSON.stringify(
		{
			runId,
			mode,
			files,
			passed,
			scope: "selected tests; release completion tracked in SpecKit acceptance gates",
		},
		null,
		2,
	),
);
console.log(`Verified test selection: ${passed} passed. Release completion is tracked in the acceptance gates.`);
