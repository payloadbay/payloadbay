import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { componentIds, componentName } from "./catalog-items.ts";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const findings = [];
for (const width of [390, 1024]) {
	const page = await browser.newPage({ viewport: { width, height: 900 } });
	let current = "";
	page.on("pageerror", (error) =>
		findings.push({
			width,
			component: current,
			kind: "runtime",
			message: error.message,
		}),
	);
	page.on("console", (message) => {
		if (message.type() === "warn" && /aria-label|accessible name/i.test(message.text()))
			findings.push({
				width,
				component: current,
				kind: "accessibility",
				message: message.text(),
			});
	});
	for (const id of componentIds) {
		for (const side of ["catalog", "catalog-pro"]) {
			current = `${side}/${id}`;
			try {
				await page.goto(`http://localhost:4173/${side}.html?component=${id}`);
				await expect(page.getByRole("heading", { name: componentName(id), exact: true })).toBeVisible({ timeout: 3000 });
				await page.waitForTimeout(120);
				expect(await page.locator("body").evaluate((element) => element.scrollWidth <= innerWidth + 1)).toBe(true);
				expect(await page.getByText("Unknown component.", { exact: true }).count()).toBe(0);
				await page.screenshot({ path: `/tmp/pab-${side}-${id}-${width}.png`, fullPage: true });
			} catch (error) {
				findings.push({
					width,
					component: current,
					kind: "render",
					message: error.message,
				});
			}
		}

		console.log(width, id);
	}

	await page.close();
}

await writeFile("/tmp/pab-catalog-report.json", JSON.stringify(findings, null, 2));
await browser.close();
expect(findings, "See /tmp/pab-catalog-report.json").toEqual([]);
console.log(`PASS ${componentIds.length} components, both comparison columns, desktop and mobile.`);
