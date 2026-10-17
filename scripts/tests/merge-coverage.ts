import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import type { CoverageMapData } from "istanbul-lib-coverage";
import { mergeNodeCoverage } from "./coverage.ts";
import { checkCoverage } from "./policy.ts";
import { registry } from "./inventory.ts";

type Threshold = number | { lines: number; functions: number };

export interface CoverageProvenance {
	owner: string;
	sourceSha: string;
	sourceRoot: string;
	dirty: boolean;
	complete: boolean;
	testCount: number;
	testFiles: string[];
}

/** Include untested executable source; declaration-only modules have no runtime. */
export function runtimeCoverageSources(root = process.cwd()) {
	const files: string[] = [];
	for (const parent of ["apps", "packages"]) {
		for (const workspace of readdirSync(resolve(root, parent), { withFileTypes: true })) {
			if (!workspace.isDirectory()) continue;
			const source = resolve(root, parent, workspace.name, "src");
			if (!existsSync(source)) continue;
			for (const file of readdirSync(source, { recursive: true }) as string[]) {
				if (!/\.[cm]?[jt]sx?$/.test(file) || /\.d\.[cm]?ts$/.test(file)) continue;
				const path = resolve(source, file);
				const emitted = ts.transpileModule(readFileSync(path, "utf8"), {
					fileName: path,
					compilerOptions: {
						target: ts.ScriptTarget.ES2022,
						module: ts.ModuleKind.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
						removeComments: true,
					},
				}).outputText;
				const parsed = ts.createSourceFile("runtime.js", emitted, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
				const executable = parsed.statements.some((statement) => {
					if (ts.isEmptyStatement(statement)) return false;
					if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) return false;
					if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause) && !statement.exportClause.elements.length) return false;

					return true;
				});

				if (executable) files.push(path);
			}
		}
	}

	const migrator = resolve(root, "scripts/migrate.ts");
	if (!existsSync(migrator)) throw Error("Missing shipped migration entrypoint");
	files.push(migrator);

	return files.sort();
}

export function validateCoverageProvenance(value: CoverageProvenance, sourceSha: string, owner: string, testFiles: string[]) {
	if (value.sourceSha !== sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) throw Error("Coverage source revision differs from the checkout");
	if (value.owner !== owner || !value.complete || value.dirty || !(value.testCount > 0)) throw Error("Coverage requires a clean complete passing owner");
	if (!isAbsolute(value.sourceRoot)) throw Error("Coverage checkout root is unavailable");
	if (JSON.stringify([...value.testFiles].sort()) !== JSON.stringify([...testFiles].sort())) throw Error("Coverage test inventory differs from the checkout");
}

/** Merge runtime locations; explicitly unit-owned test tooling keeps its complete Bun report. */
export function evaluateCoverage(reports: CoverageMapData[], unitLcov: string, required: string[], threshold: Threshold, root = process.cwd(), sourceOwners: Record<string, "unit"> = {}) {
	const mapped = mergeNodeCoverage(reports);
	const units = new Map<string, string>();
	for (const record of unitLcov.split("end_of_record")) {
		const source = record.match(/(?:^|\n)SF:(.+)/)?.[1];
		if (!source) continue;
		const file = source.startsWith("data:") ? source : resolve(root, source);
		if (units.has(file)) throw Error("Duplicate unit source record");
		units.set(file, record + "end_of_record\n");
	}

	const mappedFiles = new Map(mapped.files().map((file) => [resolve(file), file]));
	const sources = [...new Set([...required.map((file) => resolve(root, file)), ...units.keys()])].sort();
	const files = sources.map((file) => {
		const mappedFile = sourceOwners[relative(root, file).replaceAll("\\", "/")] === "unit" ? undefined : mappedFiles.get(file);
		let record = units.get(file) ?? "";
		if (mappedFile) {
			const summary = mapped.fileCoverageFor(mappedFile).toSummary();
			record = ["SF:" + file, "LF:" + summary.lines.total, "LH:" + summary.lines.covered, "FNF:" + summary.functions.total, "FNH:" + summary.functions.covered, "end_of_record", ""].join("\n");
		}

		try {
			const measured = checkCoverage(record, [file], threshold);

			return {
				path: relative(root, file),
				passed: true,
				origin: mappedFile ? "mapped" : "unit",
				...measured,
			};
		} catch (error) {
			return {
				path: relative(root, file),
				passed: false,
				origin: mappedFile ? "mapped" : units.has(file) ? "unit" : "missing",
				error: (error as Error).message,
			};
		}
	});

	return { passed: files.every((file) => file.passed), files };
}

function relocate(file: string, sourceRoot: string, root: string) {
	if (!isAbsolute(file)) return resolve(root, file);
	const path = relative(sourceRoot, file);
	if (path === ".." || path.startsWith(".." + sep) || isAbsolute(path)) throw Error("Coverage source escapes its checkout");

	return resolve(root, path);
}

export function mergeCoverageArtifacts(folder: string, threshold: Threshold, root = process.cwd()) {
	const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
	const names = (readdirSync(folder, { recursive: true }) as string[]).map((file) => file.replaceAll("\\", "/"));
	const reports: CoverageMapData[] = [];
	let unitLcov = "";
	for (const owner of ["unit", "node", "executor", "browser", "deployment"]) {
		const matches = names.filter((name) => ("/" + name).endsWith("/" + owner + "/coverage/provenance.json"));
		if (matches.length !== 1) throw Error("Expected one complete coverage owner: " + owner);
		const metadataPath = resolve(folder, matches[0]);
		const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as CoverageProvenance;
		validateCoverageProvenance(
			metadata,
			sourceSha,
			owner,
			Object.entries(registry.owners)
				.filter(([, lane]) => lane === owner)
				.map(([file]) => file),
		);
		const directory = metadataPath.slice(0, -"provenance.json".length);
		if (owner === "unit") {
			unitLcov = readFileSync(resolve(directory, "lcov.info"), "utf8").replace(/^SF:(.+)$/gm, (_line, file: string) => "SF:" + (file.startsWith("data:") ? file : relocate(file, metadata.sourceRoot, root)));
			continue;
		}

		const paths = [resolve(directory, "coverage-final.json")];
		if (owner === "browser") {
			const browser = resolve(directory, "browser");
			const client = readdirSync(browser).filter((file) => file.endsWith(".json"));
			if (!client.length) throw Error("Browser source coverage is empty");
			paths.push(...client.map((file) => resolve(browser, file)));
		}

		for (const path of paths) {
			const original = JSON.parse(readFileSync(path, "utf8")) as CoverageMapData;
			const moved: CoverageMapData = {};
			for (const entry of Object.values(original)) {
				const filename = relocate(entry.path, metadata.sourceRoot, root);
				moved[filename] = { ...entry, path: filename };
			}

			reports.push(moved);
		}
	}

	const sourceOwners = registry.coverageSourceOwners ?? {};
	for (const [file, owner] of Object.entries(sourceOwners)) if (owner !== "unit" || !file.startsWith("scripts/tests/")) throw Error("Unit coverage source ownership is limited to test tooling");

	return evaluateCoverage(reports, unitLcov, [...runtimeCoverageSources(root), ...registry.coverageSources.map((file: string) => resolve(root, file))], threshold, root, sourceOwners);
}

if (import.meta.main) {
	const folder = process.argv[2];
	if (!folder) throw Error("Provide the complete current-run coverage artifact directory");
	const config = Bun.TOML.parse(readFileSync("bunfig.toml", "utf8")) as { test: { coverageThreshold: Threshold } };
	const result = mergeCoverageArtifacts(resolve(folder), config.test.coverageThreshold);
	writeFileSync(resolve(folder, "coverage-summary.json"), JSON.stringify(result, null, 2));
	for (const file of result.files.filter((file) => !file.passed)) console.error(file.path + ": " + file.error);
	console.log("Coverage: " + result.files.filter((file) => file.passed).length + "/" + result.files.length + " source files meet the configured line/function minima");
	process.exitCode = result.passed ? 0 : 1;
}
