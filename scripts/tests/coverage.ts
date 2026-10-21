import { createFunctionNormalizer } from "./function-coverage.ts";
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
		const result = spawnSync("node", [resolve("node_modules/c8/bin/c8.js"), `--reports-dir=${directory}`, `--temp-directory=${raw}`, "--reporter=lcovonly", "--reporter=json", "--exclude-after-remap", "--merge-async", "--exclude=**/node_modules/**", "--exclude=**/*.d.ts", "--exclude=**/*.d.mts", "--exclude=**/*.d.cts", ...options.include.map((pattern) => `--include=${pattern}`), "node", ...args], { encoding: "utf8", env: options.env, maxBuffer: 16 * 1024 * 1024 });
		if (result.error) throw result.error;
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

/** Export only first-party counters/locations, never source-map contents. */
export async function convertBrowserCoverage(entries: JSCoverageEntry[], root = process.cwd(), assets?: { directory: string; prefix: string }): Promise<CoverageMapData> {
	const staticRoot = assets ? resolve(assets.directory) : resolve(root, "apps/web/.next/static");
	const prefix = assets?.prefix ?? "/_next/static/";
	const ownedRoots = ["apps/web/src", "packages/contracts/src", "packages/domain/src", "packages/script-sdk/src"].map((directory) => resolve(root, directory) + sep);

	const owned = (source: string) => ownedRoots.some((directory) => source.startsWith(directory)) && /\.[cm]?[jt]sx?$/.test(source);

	const collected = coverage.createCoverageMap({});
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
		const converter = v8ToIstanbul(filename, 0, { source: entry.source ?? (await readFile(filename, "utf8")), originalSource: "", sourceMap: { sourcemap: map } }, (source) => !owned(source));
		try {
			await converter.load();
			converter.applyCoverage(entry.functions);
			collected.merge(converter.toIstanbul());
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
