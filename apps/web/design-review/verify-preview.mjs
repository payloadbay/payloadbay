import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:4173/");
await page.getByRole("button", { name: "Components", exact: true }).click();
await page.getByRole("button", { name: "Mobile 390 × 844" }).click();
await page.getByRole("button", { name: "Full navigation layout" }).click();
const replacement = page.frameLocator('iframe[title="Independent replacement"]');
await expect(replacement.getByRole("button", { name: "Open navigation" })).toBeVisible();
for (const frame of page.frames().filter((item) => item.parentFrame())) {
	expect(await frame.evaluate(() => [innerWidth, innerHeight])).toEqual([390, 844]);
}

const positions = await replacement.locator("body").evaluate(async () => {
	document.querySelector('button[aria-label="Open navigation"]').click();
	const samples = [];
	for (let index = 0; index < 10; index++) {
		await new Promise((resolve) => setTimeout(resolve, 35));
		samples.push(document.querySelector(".pb-navigation-dialog").getBoundingClientRect().x);
	}

	return samples;
});
expect(new Set(positions.map((value) => Math.round(value))).size).toBeGreaterThan(3);
expect(Math.abs(positions.at(-1))).toBeLessThan(1);
await page.screenshot({ path: "/tmp/pab-preview-mobile.png" });
const closePositions = await replacement.locator("body").evaluate(async () => {
	document.querySelector('button[aria-label="Close navigation"]').click();
	const samples = [];
	for (let index = 0; index < 10; index++) {
		await new Promise((resolve) => setTimeout(resolve, 35));
		const dialog = document.querySelector(".pb-navigation-dialog");
		samples.push(dialog ? dialog.getBoundingClientRect().x : null);
	}

	return samples;
});
expect(closePositions.some((value) => value !== null && value < -1)).toBe(true);
await expect(replacement.getByRole("dialog")).not.toBeVisible();
await page.getByRole("button", { name: "Desktop 1024 × 768" }).click();
await expect(replacement.getByRole("button", { name: "Open navigation" })).not.toBeVisible();
expect(await replacement.locator("body").evaluate(() => [innerWidth, innerHeight])).toEqual([1024, 768]);
await expect(replacement.locator(".pb-desktop-sidebar")).toBeVisible();
await page.screenshot({ path: "/tmp/pab-preview-desktop.png" });
await page.getByRole("button", { name: "Components", exact: true }).click();
await expect(replacement.getByRole("button", { name: /Search pages/ })).toBeVisible();
const opacities = await replacement.locator("body").evaluate(async () => {
	[...document.querySelectorAll("button")].find((button) => button.textContent.includes("Search pages and resources")).click();
	const samples = [];
	for (let index = 0; index < 8; index++) {
		await new Promise((resolve) => setTimeout(resolve, 30));
		samples.push(Number(getComputedStyle(document.querySelector(".pb-command-container")).opacity));
	}

	return samples;
});
expect(opacities.some((value) => value > 0 && value < 1)).toBe(true);
expect(opacities.at(-1)).toBe(1);
expect(errors).toEqual([]);
console.log(JSON.stringify({ openPositions: positions, closePositions, searchOpacities: opacities }));
await browser.close();
