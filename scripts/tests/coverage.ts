import { createFunctionNormalizer, type FunctionStartCounter } from "./function-coverage.ts";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { createHash } from "node:crypto";
import libReport from "istanbul-lib-report";
import istanbulReports from "istanbul-reports";
import v8ToIstanbul from "v8-to-istanbul";
import type { Page } from "@playwright/test";

type JSCoverageEntry = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>[number];

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import coverage, { type CoverageMapData, type FileCoverageData } from "istanbul-lib-coverage";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join, sep, isAbsolute, dirname } from "node:path";
import { tmpdir } from "node:os";

interface CoverageOptions {
	directory: string;
	env: NodeJS.ProcessEnv;
	include: string[];
}

/** v8-to-istanbul omits unnamed callbacks despite their precise V8 counters. */
function namedCoverageFunctions(functions: JSCoverageEntry["functions"]) {
	return functions.map((entry, index) => (!entry.functionName && !(index === 0 && entry.ranges[0]?.startOffset === 0) ? { ...entry, functionName: "(anonymous)" } : entry));
}

/** Collect the owning Node invocation once, then discard raw source-map caches. */
export function runNodeCoverage(args: string[], options: CoverageOptions) {
	const directory = resolve(options.directory);
	// Keep source-bearing raw caches outside uploaded test artifacts, even on kill.
	const raw = mkdtempSync(join(tmpdir(), "payloadbay-v8-"));
	const report = resolve(directory, "lcov.info");
	mkdirSync(directory, { recursive: true });
	rmSync(report, { force: true });
	rmSync(resolve(directory, "coverage-final.json"), { force: true });
	try {
		const execution = spawnSync("node", args, { encoding: "utf8", env: { ...options.env, NODE_V8_COVERAGE: raw }, maxBuffer: 16 * 1024 * 1024 });
		if (execution.error) throw execution.error;
		const groups: { directory: string; layouts: Map<string, string> }[] = [];
		// c8 filters multi-source ranges before decoding cached file URLs.
		for (const name of readdirSync(raw).filter((name) => name.endsWith(".json"))) {
			const filename = resolve(raw, name);
			const snapshot = JSON.parse(readFileSync(filename, "utf8"));
			for (const script of snapshot.result ?? []) if (Array.isArray(script.functions)) script.functions = namedCoverageFunctions(script.functions);
			for (const cache of Object.values(snapshot["source-map-cache"] ?? {}) as { data?: { sources?: string[] } }[]) {
				if (Array.isArray(cache.data?.sources)) cache.data.sources = cache.data.sources.map((source) => (source.startsWith("file://") ? fileURLToPath(source) : source));
			}

			// ESM and CommonJS loaders can emit different offsets for the same .ts
			// URL. c8 merges offsets before remapping, so only compatible layouts
			// may share a raw batch. Merge their source locations afterward instead.
			const layouts = new Map<string, string>();
			for (const script of snapshot.result ?? []) {
				if (!script.url.startsWith("file://") || script.url.includes("/node_modules/")) continue;
				layouts.set(
					script.url,
					createHash("sha256")
						.update(JSON.stringify(snapshot["source-map-cache"]?.[script.url] ?? null))
						.digest("hex"),
				);
			}

			let group = groups.find((candidate) => [...layouts].every(([url, layout]) => !candidate.layouts.has(url) || candidate.layouts.get(url) === layout));
			if (!group) {
				group = { directory: resolve(raw, "batches", String(groups.length)), layouts: new Map() };
				mkdirSync(group.directory, { recursive: true });
				groups.push(group);
			}

			for (const [url, layout] of layouts) group.layouts.set(url, layout);
			writeFileSync(resolve(group.directory, name), JSON.stringify(snapshot));
			rmSync(filename);
		}

		const reports: CoverageMapData[] = [];
		let reportingStatus = 0;
		let reportingOutput = "";
		let reportingErrors = "";
		for (const [index, group] of groups.entries()) {
			const output = resolve(raw, "mapped", String(index));
			const reporting = spawnSync("node", [resolve("node_modules/c8/bin/c8.js"), "report", `--reports-dir=${output}`, `--temp-directory=${group.directory}`, "--reporter=json", "--exclude-after-remap", "--merge-async", "--exclude=**/node_modules/**", "--exclude=**/*.d.ts", "--exclude=**/*.d.mts", "--exclude=**/*.d.cts", ...options.include.map((pattern) => `--include=${pattern}`)], { encoding: "utf8", env: { ...options.env, NODE_V8_COVERAGE: "" }, maxBuffer: 16 * 1024 * 1024 });
			if (reporting.error) throw reporting.error;
			reportingOutput += reporting.stdout ?? "";
			reportingErrors += reporting.stderr ?? "";
			if (reporting.status !== 0) {
				reportingStatus = reporting.status ?? 1;
				break;
			}

			const mapped = JSON.parse(readFileSync(resolve(output, "coverage-final.json"), "utf8")) as CoverageMapData;
			if (Object.keys(mapped).length) reports.push(mapped);
		}

		if (reportingStatus === 0 && reports.length) {
			const merged = mergeNodeCoverage(reports);
			writeFileSync(resolve(directory, "coverage-final.json"), JSON.stringify(merged.toJSON()));
			istanbulReports.create("lcovonly").execute(libReport.createContext({ dir: directory, coverageMap: merged }));
		} else if (execution.status === 0 && reportingStatus === 0) throw Error("Node coverage contains no source records");

		const result = {
			...execution,
			status: execution.status === 0 ? reportingStatus : execution.status,
			stdout: (execution.stdout ?? "") + reportingOutput,
			stderr: (execution.stderr ?? "") + reportingErrors,
		};
		if (result.status === 0 && !readFileSync(report, "utf8").includes("SF:")) throw Error("Node coverage contains no source records");

		return result;
	} finally {
		// Raw V8 artifacts can embed dependency sources. Upload only filtered LCOV and Istanbul JSON.
		rmSync(raw, { recursive: true, force: true });
	}
}

/** Merge source-mapped function locations rather than adding summary counts. */
export function mergeNodeCoverage(reports: CoverageMapData[]) {
	if (!reports.length) throw Error("No source-mapped coverage reports");
	const merged = coverage.createCoverageMap({});
	const normalizeFunctions = createFunctionNormalizer();
	for (const report of reports) {
		// CoverageMap.toJSON() may still contain live FileCoverage instances.
		// Their JSON representation owns the counters; structuredClone loses the
		// prototype's toJSON and leaves an invalid {data} wrapper instead.
		const plain = JSON.parse(JSON.stringify(report)) as CoverageMapData;
		for (const file of Object.values(plain)) normalizeFunctions(file as FileCoverageData);
		const current = coverage.createCoverageMap(plain);
		if (!current.files().length) throw Error("Empty source-mapped coverage report");
		merged.merge(current);
	}

	return merged;
}

/** Normalize webpack's virtual names to the same owned files as Node reports. */
export function browserSourcePath(source: string, root = process.cwd()) {
	if (source.startsWith("file://")) return fileURLToPath(source);
	const relative = source
		.replace(/^webpack:\/\/(?:@[^/]+\/)?[^/]*\//, "")
		.replace(/^\([^)]*\)\//, "")
		.split("?")[0];

	return isAbsolute(relative) ? relative : resolve(root, "apps/web", relative);
}

function unmappedBrowserFunctionStarts(entry: JSCoverageEntry, source: string, map: ConstructorParameters<typeof TraceMap>[0], owned: (path: string) => boolean) {
	const trace = new TraceMap(map);
	const lines = [0, ...Array.from(source.matchAll(/\n/g), (match) => match.index! + 1)];
	const counters = new Map<string, FunctionStartCounter[]>();

	const position = (offset: number) => {
		let first = 0;
		let last = lines.length;
		while (first + 1 < last) {
			const middle = Math.floor((first + last) / 2);
			if (lines[middle] <= offset) first = middle;
			else last = middle;
		}

		return { line: first + 1, column: offset - lines[first] };
	};

	for (const fn of namedCoverageFunctions(entry.functions)) {
		if (!fn.functionName || !fn.ranges.length) continue;
		const range = fn.ranges[0];
		const start = originalPositionFor(trace, position(range.startOffset));
		if (!start.source || !owned(start.source) || start.line === null || start.column === null) continue;
		const end = originalPositionFor(trace, position(Math.max(range.startOffset, range.endOffset - 1)));
		if (end.source !== null) continue;
		counters.set(start.source, [...(counters.get(start.source) ?? []), { start: { line: start.line, column: start.column }, count: range.count }]);
	}

	return counters;
}

/** Export only first-party counters/locations, never source-map contents. */
export async function convertBrowserCoverage(entries: JSCoverageEntry[], root = process.cwd(), assets?: { directory: string; prefix: string }): Promise<CoverageMapData> {
	const staticRoot = assets ? resolve(assets.directory) : resolve(root, "apps/web/.next/static");
	const prefix = assets?.prefix ?? "/_next/static/";
	const ownedRoots = ["apps/web/src", "packages/contracts/src", "packages/domain/src", "packages/script-sdk/src"].map((directory) => resolve(root, directory) + sep);

	const owned = (source: string) => ownedRoots.some((directory) => source.startsWith(directory)) && /\.[cm]?[jt]sx?$/.test(source);

	const collected = coverage.createCoverageMap({});
	const normalizeFunctions = createFunctionNormalizer();
	for (const entry of entries) {
		let pathname: string;
		try {
			pathname = new URL(entry.url).pathname;
		} catch {
			continue;
		}

		if (!pathname.startsWith(prefix)) continue;
		const filename = resolve(staticRoot, decodeURIComponent(pathname.slice(prefix.length)));
		if (!filename.startsWith(staticRoot + sep)) throw Error("Browser coverage asset escapes the build directory");
		let map;
		try {
			map = JSON.parse(await readFile(filename + ".map", "utf8"));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			throw error;
		}

		if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) throw Error("Browser source map has no original sources");
		map.sources = map.sources.map((source: string) => (assets ? resolve(dirname(filename), map.sourceRoot ?? "", source) : browserSourcePath(source, root)));
		map.sourceRoot = "";
		if (!map.sources.some(owned)) continue;
		const source = entry.source ?? (await readFile(filename, "utf8"));
		const starts = unmappedBrowserFunctionStarts(entry, source, map, owned);
		const converter = v8ToIstanbul(filename, 0, { source, originalSource: "", sourceMap: { sourcemap: map } }, (source) => !owned(source));
		try {
			await converter.load();
			converter.applyCoverage(namedCoverageFunctions(entry.functions));
			const converted = converter.toIstanbul();
			for (const file of Object.values(converted)) normalizeFunctions(file as FileCoverageData, starts.get(file.path));
			collected.merge(converted);
		} finally {
			converter.destroy();
		}
	}

	return collected.toJSON();
}

/** Canonicalize private test-build maps before Node caches their virtual names. */
export function normalizeNextSourceMaps(root = process.cwd()) {
	for (const directory of ["apps/web/.next/server", "apps/web/.next/standalone/apps/web/.next/server"]) {
		const folder = resolve(root, directory);
		for (const filename of readdirSync(folder, { recursive: true }) as string[]) {
			if (!filename.endsWith(".map")) continue;
			const path = resolve(folder, filename);
			const map = JSON.parse(readFileSync(path, "utf8"));
			if (!Array.isArray(map.sources)) throw Error("Next test map has no original source names");
			map.sources = map.sources.map((source: string) => browserSourcePath(source, root));
			map.sourceRoot = "";
			writeFileSync(path, JSON.stringify(map));
		}
	}
}
