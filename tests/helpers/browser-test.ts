import { test as base } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { CoverageMapData } from "istanbul-lib-coverage";
import { convertBrowserCoverage, mergeNodeCoverage } from "../../scripts/tests/coverage.ts";

export { expect } from "@playwright/test";

export const test = base.extend({
	page: async ({ page, browserName }, use, info) => {
		if (process.env.PAB_TEST_SOURCE_COVERAGE !== "true") return await use(page);
		if (browserName !== "chromium") throw Error("Browser source coverage requires Chromium");
		const reports: CoverageMapData[] = [];
		let pending = Promise.resolve();

		const profiler = await page.context().newCDPSession(page);
		await profiler.send("Profiler.enable");
		await profiler.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });

		const capture = () => {
			pending = pending.then(async () => {
				if (page.isClosed()) return;
				const snapshot = await profiler.send("Profiler.takePreciseCoverage");
				const report = await convertBrowserCoverage(snapshot.result);
				if (Object.keys(report).length) reports.push(report);
			});

			return pending;
		};

		// Capture before test-controlled hard navigation, without intercepting network
		// requests or changing browser cache behavior. Keep the profiler continuous.
		const goto = page.goto.bind(page);
		const reload = page.reload.bind(page);
		const back = page.goBack.bind(page);
		const forward = page.goForward.bind(page);
		page.goto = async (...args) => {
			await capture();

			return goto(...args);
		};

		page.reload = async (...args) => {
			await capture();

			return reload(...args);
		};

		page.goBack = async (...args) => {
			await capture();

			return back(...args);
		};

		page.goForward = async (...args) => {
			await capture();

			return forward(...args);
		};

		try {
			await use(page);
		} finally {
			page.goto = goto;
			page.reload = reload;
			page.goBack = back;
			page.goForward = forward;
			await capture();
			if (!page.isClosed()) {
				await profiler.send("Profiler.stopPreciseCoverage");
				await profiler.send("Profiler.disable");
				await profiler.detach();
			}

			if (reports.length) {
				const directory = resolve(process.env.PAB_TEST_ARTIFACT_DIR ?? "test-results/browser", "coverage/browser");
				await mkdir(directory, { recursive: true });
				const name = createHash("sha256").update(info.testId).digest("hex") + "-" + info.retry + ".json";
				await writeFile(resolve(directory, name), JSON.stringify(mergeNodeCoverage(reports).toJSON()));
			}
		}
	},
});
