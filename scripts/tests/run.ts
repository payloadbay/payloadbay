import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { inventory, registry } from "./inventory.ts";
import { selectAffected, assertNonemptyRun, checkCoverage } from "./policy.ts";

const args = process.argv.slice(2);
const mode = args.shift() ?? "suite";
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
} else if (mode !== "suite" && mode !== "coverage" && !["unit", "node", "executor", "browser", "deployment"].includes(mode)) throw Error("Unknown test mode");
if (["unit", "node", "executor", "browser", "deployment"].includes(mode)) files = all.filter((f) => registry.owners[f] === mode);
if (!files.length) throw Error("Empty test selection");
const grep = mode === "file" && args[0] === "--name" ? args[1] : undefined;
if (mode === "file" && args.length && (!grep || args.length !== 2)) throw Error("Expected --name followed by test name");
const runId = process.env.PAB_TEST_RUN_ID ?? randomUUID();
const reports = `test-results/${runId}`;
const lanes = ["unit", "node", "executor", "browser", "deployment"];
let passed = 0;
for (const lane of lanes) {
	const selected = files.filter((f) => registry.owners[f] === lane);
	if (!selected.length) continue;
	if (mode === "coverage" && lane !== "unit") continue;
	const env: NodeJS.ProcessEnv & { PAB_TEST_ARTIFACT_DIR: string } = {
		...process.env,
		TZ: "UTC",
		TSX_TSCONFIG_PATH: "tests/config/tsconfig.json",
		PAB_TEST_ARTIFACT_DIR: `${reports}/${lane}`,
	};
	mkdirSync(env.PAB_TEST_ARTIFACT_DIR, { recursive: true });
	if (lane === "browser") {
		const listener = createServer();
		await new Promise<void>((r) => listener.listen(0, "127.0.0.1", r));
		env.PAB_TEST_PORT = String((listener.address() as { port: number }).port);
		await new Promise<void>((r) => listener.close(() => r()));
	}

	let command = "bun";
	let options: string[] = [];
	if (lane === "unit") options = ["test", ...selected, ...(grep ? ["--test-name-pattern", grep] : []), ...(mode === "coverage" ? ["--coverage", "--coverage-reporter=text", "--coverage-reporter=lcov"] : [])];
	else if (lane === "browser") {
		command = "node";
		options = ["--import", "tsx", "scripts/tests/browser.ts", ...selected, ...(grep ? ["--grep", grep] : [])];
	} else {
		command = "node";
		options = ["--import", "tsx", "--test", "--test-concurrency=2", ...(grep ? ["--test-name-pattern", grep] : []), ...selected];
	}

	const result = spawnSync(command, options, { encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 });
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
if (mode === "coverage") console.log("Coverage gate:", checkCoverage(readFileSync("coverage/unit/lcov.info", "utf8"), registry.coverageSources, 0.8));
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
