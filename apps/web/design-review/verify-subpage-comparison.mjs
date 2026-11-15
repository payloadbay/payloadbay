import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.REVIEW_URL ?? "http://localhost:4173";
const output = "/tmp/payloadbay-subpages";
await mkdir(output, { recursive: true });
const errors = [];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	for (const width of [390, 1100]) {
		for (const example of ["security", "account", "protection"]) {
			for (const version of ["current", "proposed"]) {
				const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
				page.on("pageerror", (error) => errors.push(error.message));
				await page.goto(`${base}/page-layouts.html?subpage=1&example=${example}&version=${version}`);
				await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
				await expect(page.locator(".sc-subpage > header h1")).toBeVisible();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
				await expect(page.locator('[data-slot="app-section-header"]')).toHaveCount(version === "current" ? 0 : example === "security" ? 1 : example === "account" ? 2 : 3);
				expect(await page.locator(".pb-layout-header").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("dotted");
				if (version === "proposed") {
					const headers = page.locator('[data-slot="app-section-header"]');
					for (const header of await headers.all()) {
						await expect(header.locator('[data-slot="app-section-icon"] > svg')).toHaveCount(1);
						await expect(header.locator("h2")).toHaveCount(1);
						expect((await header.locator('[data-slot="app-section-description"]').innerText()).trim().length).toBeGreaterThan(0);
						await expect(header.locator('[data-slot="app-section-icon"] > svg')).toHaveCSS("width", "20px");
						const aligned = await header.evaluate((element) => Math.abs(element.querySelector("h2").getBoundingClientRect().x - element.querySelector('[data-slot="app-section-description"]').getBoundingClientRect().x) < 1);
						expect(aligned).toBe(true);
						const geometry = await header.evaluate((element) => {
							const icon = element.querySelector('[data-slot="app-section-icon"]').getBoundingClientRect();
							const title = element.querySelector("h2").getBoundingClientRect();

							return { height: element.getBoundingClientRect().height, sameRow: Math.abs(icon.y - title.y) < 2, iconBeforeTitle: icon.right < title.x };
						});
						expect(geometry.height).toBeLessThan(210);
						expect(geometry.sameRow).toBe(true);
						expect(geometry.iconBeforeTitle).toBe(true);
					}
				}

				await page.screenshot({ path: `${output}/${example}-${version}-${width}.png`, fullPage: true });
				await page.close();
			}
		}
	}

	const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, reducedMotion: "reduce" });
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`${base}/page-layouts.html`);
	await expect(page.getByRole("heading", { name: "Subpage consistency / current and proposed" })).toBeVisible();
	await expect(page.locator("iframe")).toHaveCount(2);
	await expect(page.frameLocator('iframe[title="current subpage"]').getByRole("heading", { level: 1 })).toHaveText("Account settings");
	await expect(page.frameLocator('iframe[title="proposed subpage"]').locator('[data-slot="app-section-header"]')).toHaveCount(2);
	await page.getByRole("button", { name: /Actual subpage/ }).click();
	await page.getByRole("option", { name: "Account / Settings", exact: true }).click();
	await expect(page.frameLocator('iframe[title="proposed subpage"]').getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
	await expect(page.frameLocator('iframe[title="current subpage"]').getByRole("heading", { name: "Profile", exact: true })).toHaveCount(0);
	await page.getByText("Show layout boundaries", { exact: true }).click();
	await expect(page.frameLocator('iframe[title="proposed subpage"]').locator(".sc-example")).not.toHaveAttribute("data-marks", "true");
	await page.getByText("Show layout boundaries", { exact: true }).click();
	await expect(page.frameLocator('iframe[title="proposed subpage"]').locator(".sc-example")).toHaveAttribute("data-marks", "true");
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${output}/comparison.png`, fullPage: true });
	expect(errors).toEqual([]);
	console.log("Passed: current/proposed Security, Account and Protection at 390/1100px; shared-shell boundaries, common section headers, overflow, comparison selection and annotation toggle. Screenshots:", output);
} finally {
	await browser.close();
}
