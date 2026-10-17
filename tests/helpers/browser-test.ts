import { test as base } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { convertBrowserCoverage } from "../../scripts/tests/coverage.ts";

export { expect } from "@playwright/test";

export const test = base.extend({
	page: async ({ page, browserName }, use, info) => {
		if (process.env.PAB_TEST_SOURCE_COVERAGE !== "true") return await use(page);
		if (browserName !== "chromium") throw Error("Browser source coverage requires Chromium");
		await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
		try {
			await use(page);
		} finally {
			if (!page.isClosed()) {
				const report = await convertBrowserCoverage(await page.coverage.stopJSCoverage());
				if (Object.keys(report).length) {
					const directory = resolve(process.env.PAB_TEST_ARTIFACT_DIR ?? "test-results/browser", "coverage/browser");
					await mkdir(directory, { recursive: true });
					const name = createHash("sha256").update(info.testId).digest("hex") + "-" + info.retry + ".json";
					await writeFile(resolve(directory, name), JSON.stringify(report));
				}
			}
		}
	},
});
