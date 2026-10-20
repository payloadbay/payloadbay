import { chromium, expect } from "@playwright/test";
import { catalogVariants, variantLabel } from "./catalog-variants.ts";
import { componentName } from "./catalog-items.ts";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const findings = [];
const contexts = [];

async function choose(page, id, variant) {
	await page.getByRole("button", { name: new RegExp(`${componentName(id)} example`) }).click();
	await page.getByRole("option", { name: variantLabel(variant), exact: true }).click();
}

try {
	for (const width of [390, 1024]) {
		const context = await browser.newContext({ viewport: { width, height: 900 } });
		contexts.push(context);
		const page = await context.newPage();
		let current = "";
		page.on("pageerror", (error) => findings.push({ width, current, error: error.message }));
		for (const side of ["catalog-pro", "catalog"]) {
			for (const [id, variants] of Object.entries(catalogVariants)) {
				await page.goto(`http://localhost:4173/${side}.html?component=${id}`);
				current = `${side}/${id}`;
				for (const variant of variants) {
					try {
						if (variant !== variants[0]) await choose(page, id, variant);
						await page.waitForTimeout(80);
						expect(await page.locator("body").evaluate((node) => node.scrollWidth <= innerWidth + 1)).toBe(true);
						await expect(page.getByRole("heading", { name: componentName(id), exact: true })).toBeVisible();
						if (id === "number-value") {
							const expected = variant === "currency" ? "€12,345.67" : variant === "percent" ? "12.3%" : variant === "compact" ? "12.3K" : "12,345.67";
							await expect(page.getByText(expected, { exact: true })).toBeVisible();
						}

						if (id === "native-select" && variant === "disabled") await expect(page.getByRole("combobox")).toBeDisabled();
						if (id === "number-stepper" && variant === "disabled") await expect(page.getByRole("button", { name: /Increase/ })).toBeDisabled();
						await page.screenshot({ path: `/tmp/pab-matched-${side}-${id}-${variant}-${width}.png`, fullPage: true });
						console.log("PASS", width, side, id, variant);
					} catch (error) {
						findings.push({
							width,
							current,
							variant,
							error: error.message,
						});
						console.log("FAIL", width, current, variant, error.message.slice(0, 150));
					}
				}
			}

			// Event creation is a real controlled fixture in each column.
			await page.goto(`http://localhost:4173/${side}.html?component=agenda`);
			await page.getByRole("button", { name: "Add event", exact: true }).click();
			await page.getByRole("textbox", { name: "Event title" }).fill("Reviewer event");
			await page.getByRole("button", { name: "Save event", exact: true }).click();
			await expect(page.getByText("Reviewer event", { exact: true })).toHaveCount(1);
			console.log("PASS", width, side, "calendar creation");
			// Editor command menu must stay next to its text cursor inside the review card.
			await page.goto(`http://localhost:4173/${side}.html?component=rich-text-editor`);
			await choose(page, "rich-text-editor", "slash-commands");
			const editor = page.locator("[contenteditable=true]").first();
			await editor.fill("/head");
			const option = page.getByText("Heading", { exact: true }).last();
			await expect(option).toBeVisible();
			const er = await editor.boundingBox();
			const mr = await option.boundingBox();
			expect(mr.x).toBeGreaterThanOrEqual(er.x - 16);
			expect(mr.x).toBeLessThan(er.x + er.width);
			expect(mr.y).toBeLessThan(er.y + er.height + 100);
			await page.screenshot({ path: `/tmp/pab-matched-${side}-editor-menu-${width}.png` });
			await page.keyboard.press("Enter");
			await editor.pressSequentially("Review heading");
			await expect(editor.locator("h2")).toHaveText("Review heading");
			console.log("PASS", width, side, "positioned slash menu");
			// Hover feedback is visible before a press.
			await page.goto(`http://localhost:4173/${side}.html?component=cell-slider`);
			await page.locator(side === "catalog-pro" ? ".cell-slider" : ".pb-cell-slider").hover();
			await expect.poll(async () => Number(await page.getByRole("slider").evaluate((node) => getComputedStyle(node, "::after").opacity))).toBeGreaterThan(0);
			console.log("PASS", width, side, "slider hover indicator");
		}

		await context.close();
	}

	// The outer review page forwards a variant choice to the opposite iframe.
	const sync = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
	await sync.goto("http://localhost:4173/");
	await sync.locator("#catalog-component").selectOption("timeline");
	const pro = sync.frames().find((frame) => frame.url().includes("catalog-pro.html"));
	const local = sync.frames().find((frame) => frame.url().includes("/catalog.html"));
	await choose(pro, "timeline", "compact-log");
	await expect(local.getByRole("button", { name: /Timeline example/ })).toContainText("Compact Log");
	console.log("PASS synchronized example selection");
	await sync.close();
	await writeFile("/tmp/pab-reference-parity-report.json", JSON.stringify(findings, null, 2));
	expect(findings).toEqual([]);
	console.log("PASS reference and replacement variants, interaction and placement checks");
} finally {
	await browser.close();
}
