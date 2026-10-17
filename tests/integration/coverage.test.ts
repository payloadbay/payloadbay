import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { transform } from "esbuild";
import { evaluateCoverage, validateCoverageProvenance, runtimeCoverageSources, coveredRevision } from "../../scripts/tests/merge-coverage.ts";
import { runNodeCoverage, mergeNodeCoverage, browserSourcePath, convertBrowserCoverage } from "../../scripts/tests/coverage.ts";

async function coverageFixture(
	exit: number,
	run: (report: string, status: number | null, directory: string) => Promise<void>,
	options: {
		keepNames?: boolean;
		body?: string;
		minify?: boolean;
		fileName?: string;
	} = {},
) {
	const directory = await mkdtemp(resolve("test-results/coverage-map-"));
	try {
		const source = resolve(directory, options.fileName ?? "source.ts");
		const rawPath = resolve(directory, "raw-path.txt");
		const input = options.body
			? options.body + `\nimport { writeFileSync } from "node:fs";writeFileSync(${JSON.stringify(rawPath)}, process.env.NODE_V8_COVERAGE);`
			: [
					"// Source-map position canary: generated JS has a different layout.",
					"",
					"export function called(value: number) {",
					"\treturn value + 1;",
					"}",
					"",
					"export function neverCalled(value: number) {",
					"\treturn value - 1;",
					"}",
					"",
					`if (process.argv.at(-1) === "right") { if (neverCalled(1) !== 0) throw Error("wrong result"); } else if (called(1) !== 2) throw Error("wrong result");`,
					`process.exitCode = ${exit};`,
					`import { writeFileSync } from "node:fs";`,
					`writeFileSync(${JSON.stringify(rawPath)}, process.env.NODE_V8_COVERAGE);`,
				].join("\n");
		await writeFile(source, input);
		const compiled = await transform(input, {
			loader: "ts",
			sourcefile: source,
			sourcemap: "inline",
			format: "esm",
			minify: options.minify ?? true,
			keepNames: options.keepNames,
		});
		const entry = resolve(directory, "compiled.mjs");
		await writeFile(entry, compiled.code);
		const output = resolve(directory, "coverage");
		const result = runNodeCoverage([entry], { directory: output, env: process.env, include: [relative(process.cwd(), source)] });
		const raw = await readFile(rawPath, "utf8");
		assert.equal(raw.startsWith(resolve("test-results")), false);
		await assert.rejects(access(raw), { code: "ENOENT" });
		const json = JSON.parse(await readFile(resolve(output, "coverage-final.json"), "utf8"));
		const mapped = json[source];
		assert.ok(mapped, "Mergeable coverage must refer to the original TypeScript source");
		if (!options.keepNames && !options.body) {
			assert.equal(Object.keys(mapped.fnMap).length, 2);
			const identities = Object.entries(mapped.fnMap) as [string, { decl: { start: { line: number } } }][];
			const called = identities.find(([, value]) => value.decl.start.line === 3)?.[0];
			const uncalled = identities.find(([, value]) => value.decl.start.line === 7)?.[0];
			assert.ok(called);
			assert.ok(uncalled);
			assert.equal(mapped.f[called], 1);
			assert.equal(mapped.f[uncalled], 0);
		}

		await run(await readFile(resolve(output, "lcov.info"), "utf8"), result.status, output);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("CV01 source-mapped coverage keeps called and uncalled TypeScript functions distinct", async () => {
	await coverageFixture(0, async (report, status) => {
		assert.equal(status, 0);
		assert.match(report, /SF:.*source\.ts/);
		const called = report.match(/FN:3,([^\n]+)/)?.[1];
		const neverCalled = report.match(/FN:7,([^\n]+)/)?.[1];
		assert.ok(called);
		assert.ok(neverCalled);
		assert.notEqual(called, neverCalled);
		assert.ok(report.includes(`FNDA:1,${called}\n`));
		assert.ok(report.includes(`FNDA:0,${neverCalled}\n`));
		assert.match(report, /FNF:2\nFNH:1/);
		assert.match(report, /DA:8,0/);
		assert.doesNotMatch(report, /SF:.*compiled\.mjs/);
	});
});

test("CV02 the reporter preserves a failing owner's exit status", async () => {
	await coverageFixture(7, async (_report, status) => {
		assert.equal(status, 7);
	});
});

test("CV03 complementary real source-map reports merge function identities without double counting", async () => {
	await coverageFixture(0, async (_report, status, directory) => {
		assert.equal(status, 0);
		const first = JSON.parse(await readFile(resolve(directory, "coverage-final.json"), "utf8"));
		const source = Object.keys(first)[0];
		const secondDirectory = resolve(directory, "second");
		const result = runNodeCoverage([resolve(directory, "..", "compiled.mjs"), "right"], { directory: secondDirectory, env: process.env, include: [relative(process.cwd(), source)] });
		assert.equal(result.status, 0);
		const second = JSON.parse(await readFile(resolve(secondDirectory, "coverage-final.json"), "utf8"));
		assert.equal(mergeNodeCoverage([first]).fileCoverageFor(source).toSummary().functions.covered, 1);
		const { default: istanbul } = await import("istanbul-lib-coverage");
		const live = istanbul.createCoverageMap(first).toJSON();
		assert.equal(mergeNodeCoverage([live]).fileCoverageFor(source).toSummary().functions.covered, 1, "Live browser snapshots must preserve FileCoverage serialization");
		assert.equal(mergeNodeCoverage([second]).fileCoverageFor(source).toSummary().functions.covered, 1);
		const merged = mergeNodeCoverage([first, second]).fileCoverageFor(source).toSummary();
		assert.equal(merged.functions.total, 2);
		assert.equal(merged.functions.covered, 2);
		assert.equal(evaluateCoverage([first, second], "", [source], 0.8).passed, true);
		const inflatedUnit = `SF:${source}\nLF:1\nLH:1\nFNF:2\nFNH:2\nend_of_record\n`;
		assert.equal(evaluateCoverage([first], inflatedUnit, [source], 0.8).passed, false, "A unit summary cannot override mapped missing functions");
		const owner = { [relative(process.cwd(), source)]: "unit" as const };
		assert.equal(evaluateCoverage([first], inflatedUnit, [source], 0.8, process.cwd(), owner).passed, true);
		assert.equal(evaluateCoverage([first, second], "", [source], 0.8, process.cwd(), owner).passed, false, "An absent authoritative owner cannot fall back to a different runtime");
		const belowThresholdUnit = inflatedUnit.replace("FNH:2", "FNH:1");
		assert.equal(evaluateCoverage([first, second], belowThresholdUnit, [source], 0.8, process.cwd(), owner).passed, false, "Declared ownership must not choose whichever runtime has the higher score");
		const other = resolve(directory, "unit-only.ts");
		const disjointUnit = inflatedUnit.replace(source, other);
		assert.equal(evaluateCoverage([first, second], disjointUnit, [source, other], 0.8).passed, true);
		assert.equal(evaluateCoverage([first, second], "", [source, other], 0.8).passed, false, "Unloaded runtime source must fail");
		assert.throws(() => evaluateCoverage([first], inflatedUnit + inflatedUnit, [source], 0.8), /Duplicate unit/);
		const repeated = mergeNodeCoverage([first, first]).fileCoverageFor(source).toSummary();
		assert.equal(repeated.functions.total, 2);
		assert.equal(repeated.functions.covered, 1);
		assert.throws(() => mergeNodeCoverage([]), /No source-mapped/);
		assert.throws(() => mergeNodeCoverage([{}]), /Empty source-mapped/);
	});
});

test("CV04 browser source maps require explicit test-build opt-in", async () => {
	const { spawnSync } = await import("node:child_process");
	const script = 'import config from "./apps/web/next.config.ts";console.log(JSON.stringify({browser:Boolean(config.productionBrowserSourceMaps),server:Boolean(config.experimental?.serverSourceMaps)}));';
	for (const enabled of [false, true]) {
		const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { env: { ...process.env, PAB_TEST_SOURCE_COVERAGE: String(enabled), NODE_V8_COVERAGE: "" }, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(JSON.parse(result.stdout), { browser: enabled, server: enabled });
	}
});

test("CV05 browser source names normalize to owned files and encoded asset traversal is denied", async () => {
	const { nextBuildFingerprint } = await import("../../scripts/tests/next-build.ts");
	assert.notEqual(nextBuildFingerprint(false), nextBuildFingerprint(true), "Coverage and ordinary builds must never share a cache identity");
	assert.equal(browserSourcePath("webpack://_N_E/./src/app/page.tsx"), resolve("apps/web/src/app/page.tsx"));
	assert.equal(browserSourcePath("webpack://@payloadbay/web/./src/app/api/v1/me/route.ts"), resolve("apps/web/src/app/api/v1/me/route.ts"));
	assert.equal(browserSourcePath("webpack://_N_E/(app-pages-browser)/./src/app/page.tsx"), resolve("apps/web/src/app/page.tsx"));
	assert.equal(browserSourcePath("webpack://_N_E/../../packages/contracts/src/api.ts"), resolve("packages/contracts/src/api.ts"));
	await assert.rejects(
		convertBrowserCoverage([
			{
				url: "http://localhost/_next/static/%2e%2e%2f%2e%2e%2fsecret.js",
				scriptId: "traversal-canary",
				source: "",
				functions: [],
			},
		]),
		/escapes the build directory/,
	);
});

test("CV06 private Next maps keep original content while canonicalizing both server trees", async () => {
	const { mkdir } = await import("node:fs/promises");
	const { normalizeNextSourceMaps } = await import("../../scripts/tests/coverage.ts");
	const root = await mkdtemp(resolve("test-results/next-map-"));
	try {
		const paths = ["apps/web/.next/server", "apps/web/.next/standalone/apps/web/.next/server"];
		const original = {
			version: 3,
			sources: ["webpack://@payloadbay/web/./src/app/api/v1/me/route.ts"],
			sourcesContent: ["synthetic original source"],
			names: [],
			mappings: "",
		};
		for (const folder of paths) {
			await mkdir(resolve(root, folder), { recursive: true });
			await writeFile(resolve(root, folder, "route.js.map"), JSON.stringify(original));
		}

		normalizeNextSourceMaps(root);
		for (const folder of paths) {
			const actual = JSON.parse(await readFile(resolve(root, folder, "route.js.map"), "utf8"));
			assert.deepEqual(actual.sources, [resolve(root, "apps/web/src/app/api/v1/me/route.ts")]);
			assert.deepEqual(actual.sourcesContent, original.sourcesContent);
			assert.equal(actual.sourceRoot, "");
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("CV07 coverage provenance rejects partial, dirty or cross-revision owners", () => {
	const sha = "a".repeat(40);
	const files = ["tests/example.test.ts"];
	const metadata = {
		owner: "node",
		sourceSha: sha,
		sourceRoot: process.cwd(),
		dirty: false,
		complete: true,
		testCount: 1,
		testFiles: files,
	};
	assert.doesNotThrow(() => validateCoverageProvenance(metadata, sha, "node", files));
	for (const patch of [{ dirty: true }, { complete: false }, { testCount: 0 }, { sourceSha: "b".repeat(40) }, { owner: "unit" }, { testFiles: [] }, { sourceRoot: "relative" }]) {
		assert.throws(() => validateCoverageProvenance({ ...metadata, ...patch }, sha, "node", files));
	}
});

test("CV08 runtime inventory includes unloaded executable modules and skips pure declarations", async () => {
	const { mkdir } = await import("node:fs/promises");
	const root = await mkdtemp(resolve("test-results/runtime-inventory-"));
	try {
		for (const directory of ["apps/web/src", "packages/contracts/src", "scripts"]) await mkdir(resolve(root, directory), { recursive: true });
		await writeFile(resolve(root, "apps/web/src/unloaded.ts"), "export const value = 1;");
		await writeFile(resolve(root, "packages/contracts/src/types.ts"), "export interface OnlyType { value: string }");
		await writeFile(resolve(root, "packages/contracts/src/global.d.ts"), "declare const value: string;");
		await writeFile(resolve(root, "scripts/migrate.ts"), "console.log('synthetic migrator');");
		assert.deepEqual(runtimeCoverageSources(root), [resolve(root, "apps/web/src/unloaded.ts"), resolve(root, "scripts/migrate.ts")]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("CV09 real name-preserving compiler helpers do not become authored function coverage", async () => {
	await coverageFixture(
		0,
		async (_lcov, status, directory) => {
			assert.equal(status, 0);
			const report = JSON.parse(await readFile(resolve(directory, "coverage-final.json"), "utf8"));
			const source = Object.keys(report)[0];
			const summary = mergeNodeCoverage([report]).fileCoverageFor(source).toSummary();
			assert.equal(summary.functions.total, 2, "Only the two authored functions belong in the denominator: " + JSON.stringify(report[source].fnMap));
			assert.equal(summary.functions.covered, 1, "The uncalled function must remain uncovered");
		},
		{ keepNames: true, minify: false },
	);
});

test("CV10 same-named functions in different scopes retain distinct source identities", async () => {
	const body = ["export function left() {", "  return function work() {", '    return "left";', "  };", "}", "export function right() {", "  return function work() {", '    return "right";', "  };", "}", 'if (left()() !== "left") throw Error("wrong result");', "right();"].join("\n");
	await coverageFixture(
		0,
		async (_lcov, status, directory) => {
			assert.equal(status, 0);
			const report = JSON.parse(await readFile(resolve(directory, "coverage-final.json"), "utf8"));
			const source = Object.keys(report)[0];
			const summary = mergeNodeCoverage([report]).fileCoverageFor(source).toSummary();
			assert.equal(summary.functions.total, 4);
			assert.equal(summary.functions.covered, 3);
			assert.equal(evaluateCoverage([report], "", [source], 0.8).passed, false, "Generated helpers must not lift 3/4 authored functions to 80%");
		},
		{ keepNames: true, body, minify: false },
	);
});

test("CV11 different real compiler layouts merge preserved function identities and retain uncovered functions", async () => {
	await coverageFixture(
		0,
		async (_lcov, status, directory) => {
			assert.equal(status, 0);
			const first = JSON.parse(await readFile(resolve(directory, "coverage-final.json"), "utf8"));
			const source = Object.keys(first)[0];
			const compiled = await transform(await readFile(source, "utf8"), {
				loader: "ts",
				sourcefile: source,
				sourcemap: "inline",
				format: "esm",
				minify: false,
				keepNames: false,
			});
			const entry = resolve(directory, "..", "other-layout.mjs");
			await writeFile(entry, compiled.code);
			const output = resolve(directory, "other");
			const result = runNodeCoverage([entry, "right"], { directory: output, env: process.env, include: [relative(process.cwd(), source)] });
			assert.equal(result.status, 0);
			const second = JSON.parse(await readFile(resolve(output, "coverage-final.json"), "utf8"));
			const merged = mergeNodeCoverage([first, second]).fileCoverageFor(source).toSummary();
			assert.equal(merged.functions.total, 2);
			assert.equal(merged.functions.covered, 2);
			const repeated = mergeNodeCoverage([first, first]).fileCoverageFor(source).toSummary();
			assert.equal(repeated.functions.total, 2);
			assert.equal(repeated.functions.covered, 1);
		},
		{ keepNames: true, minify: false },
	);
});

test("CV12 a dirty merge checkout cannot certify clean historical owner reports", async () => {
	const { execFileSync } = await import("node:child_process");
	const root = await mkdtemp(resolve("test-results/covered-revision-"));

	const git = (args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	try {
		git(["init"]);
		git(["config", "user.name", "Coverage Fixture"]);
		git(["config", "user.email", "fixture@example.test"]);
		await writeFile(resolve(root, "source.ts"), "export const value = 1;");
		git(["add", "."]);
		git(["commit", "-m", "test coverage source"]);
		assert.equal(coveredRevision(root), git(["rev-parse", "HEAD"]));
		await writeFile(resolve(root, "source.ts"), "export const value = 2;");
		assert.throws(() => coveredRevision(root), /requires a clean checkout/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("CV13 a production source ending in -test.ts is not silently excluded", async () => {
	await coverageFixture(
		0,
		async (lcov, status) => {
			assert.equal(status, 0);
			assert.match(lcov, /SF:.*script-test\.ts/);
		},
		{ fileName: "script-test.ts" },
	);
});

test("CV14 inferred callback names at distinct locations must not be coalesced", async () => {
	const directory = await mkdtemp(resolve("test-results/callback-identities-"));
	const source = resolve(directory, "callbacks.ts");
	try {
		await writeFile(source, 'let close = () => "initial";\nclose = () => "replacement";\nclose();\n');
		const first = { start: { line: 1, column: 12 }, end: { line: 1, column: 27 } };
		const second = { start: { line: 2, column: 8 }, end: { line: 2, column: 27 } };
		// Browser/native reports can preserve inferred names that an esbuild
		// wrapper makes anonymous. This tests mapping identity, not execution.
		const report = {
			[source]: {
				path: source,
				statementMap: { "0": first },
				s: { "0": 1 },
				branchMap: {},
				b: {},
				fnMap: {
					"0": {
						name: "close",
						decl: first,
						loc: first,
						line: 1,
					},
					"1": {
						name: "close",
						decl: second,
						loc: second,
						line: 2,
					},
				},
				f: { "0": 0, "1": 1 },
			},
		};
		const summary = mergeNodeCoverage([report]).fileCoverageFor(source).toSummary();
		assert.equal(summary.functions.total, 2);
		assert.equal(summary.functions.covered, 1);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
