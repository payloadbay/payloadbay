import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
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
	try {
		const result = spawnSync("node", [resolve("node_modules/c8/bin/c8.js"), `--reports-dir=${directory}`, `--temp-directory=${raw}`, "--reporter=lcovonly", "--exclude-after-remap", ...options.include.map((pattern) => `--include=${pattern}`), "node", ...args], { encoding: "utf8", env: options.env, maxBuffer: 16 * 1024 * 1024 });
		if (result.error) throw result.error;
		if (result.status === 0 && !readFileSync(report, "utf8").includes("SF:")) throw Error("Node coverage contains no source records");

		return result;
	} finally {
		// Raw V8 artifacts can embed dependency sources. Upload only filtered LCOV.
		rmSync(raw, { recursive: true, force: true });
	}
}
