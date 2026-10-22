import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	for (const width of [390, 1024]) {
		const page = await browser.newPage({ viewport: { width, height: 900 } });
		await page.goto("http://localhost:4173/catalog.html?component=emoji-picker");
		await page.getByRole("button", { name: "Choose emoji", exact: true }).click();
		const categories = page.getByRole("radiogroup", { name: "Emoji category" });
		await expect(categories.getByRole("radio")).toHaveCount(9);
		await categories.getByRole("radio", { name: "Food & drink", exact: true }).click();
		await expect(page.getByRole("option", { name: "🍇", exact: true })).toBeVisible();
		await expect(page.getByRole("option", { name: "😀", exact: true })).toHaveCount(0);
		await page.getByPlaceholder("Search emoji…").fill("thumbs up");
		await expect(categories.getByRole("radio", { name: "All emoji", exact: true })).toBeChecked();
		await expect(page.getByRole("option", { name: "👍", exact: true })).toBeVisible();
		await page.locator(".pb-emoji-tone").click();
		await page.getByRole("radio", { name: "Medium dark skin tone", exact: true }).click();
		await page.getByRole("option", { name: "👍🏾", exact: true }).click();
		await expect(page.getByRole("button", { name: "Choose emoji", exact: true })).toContainText("👍🏾");
		await page.getByRole("button", { name: "Choose emoji", exact: true }).click();
		await categories.getByRole("radio", { name: "Flags", exact: true }).click();
		await expect(page.getByPlaceholder("Search emoji…")).toHaveValue("");
		await expect(page.getByRole("option", { name: "🏁", exact: true })).toBeVisible();
		const bounds = await categories.boundingBox();
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
		await page.screenshot({ path: `/tmp/pab-emoji-categories-${width}.png` });
		await page.close();
	}

	console.log("Emoji categories, global search, skin tones and mobile bounds passed.");
} finally {
	await browser.close();
}
