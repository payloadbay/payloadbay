import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { transform } from "esbuild";
import { runNodeCoverage, mergeNodeCoverage } from "../../scripts/tests/coverage.ts";

async function coverageFixture(exit: number, run: (report: string, status: number | null, directory: string) => Promise<void>) {
	const directory = await mkdtemp(resolve("test-results/coverage-map-"));
	try {
		const source = resolve(directory, "source.ts");
		const rawPath = resolve(directory, "raw-path.txt");
		const input = [
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
			minify: true,
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
		assert.equal(Object.keys(mapped.fnMap).length, 2);
		const identities = Object.entries(mapped.fnMap) as [string, { decl: { start: { line: number } } }][];
		const called = identities.find(([, value]) => value.decl.start.line === 3)?.[0];
		const uncalled = identities.find(([, value]) => value.decl.start.line === 7)?.[0];
		assert.ok(called);
		assert.ok(uncalled);
		assert.equal(mapped.f[called], 1);
		assert.equal(mapped.f[uncalled], 0);
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
		assert.equal(mergeNodeCoverage([second]).fileCoverageFor(source).toSummary().functions.covered, 1);
		const merged = mergeNodeCoverage([first, second]).fileCoverageFor(source).toSummary();
		assert.equal(merged.functions.total, 2);
		assert.equal(merged.functions.covered, 2);
		const repeated = mergeNodeCoverage([first, first]).fileCoverageFor(source).toSummary();
		assert.equal(repeated.functions.total, 2);
		assert.equal(repeated.functions.covered, 1);
		assert.throws(() => mergeNodeCoverage([]), /No source-mapped/);
		assert.throws(() => mergeNodeCoverage([{}]), /Empty source-mapped/);
	});
});
