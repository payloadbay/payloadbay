import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	for (const width of [390, 1024]) {
		const page = await browser.newPage({ viewport: { width, height: 844 } });
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto("http://localhost:4173/catalog.html?fixture=styling-props");
		for (const [probe, base] of Object.entries({
			widget: "pb-widget",
			header: "pb-widget-header",
			content: "pb-widget-content",
			footer: "pb-widget-footer",
			inline: "pb-inline-root",
			cell: "pb-cell",
			slider: "pb-cell-slider",
			switch: "pb-cell-switch",
			list: "pb-list-view",
			item: "pb-list-view-item",
			function: "pb-list-view",
			virtual: "pb-list-view",
		})) {
			const element = page.locator(`.probe-${probe}`);
			await expect(element).toHaveClass(new RegExp(`\\b${base}\\b`));
			await expect(element).toHaveCSS("max-width", "237px");
			await expect(element).toHaveCSS("color", "rgb(120, 80, 40)");
		}

		await expect(page.locator(".probe-color")).toHaveClass(/pb-color-picker/);
		for (const probe of ["native", "native-full"]) {
			const element = page.locator(`.probe-${probe}`);
			await expect(element).toHaveCSS("max-width", "237px");
			await expect(element).toHaveCSS("color", "rgb(120, 80, 40)");
		}

		const widths = await page.locator(".probe-native-full").evaluate((element) => [element.style.width, element.parentElement.style.width]);
		expect(widths).toEqual(["100%", "100%"]);
		await expect(page.locator(".probe-function")).toHaveCSS("height", "99px");
		await expect(page.locator(".probe-function")).toHaveCSS("padding", "9px");
		await expect(page.locator(".probe-virtual")).toHaveCSS("height", "140px");
		await expect(page.locator(".probe-virtual")).toHaveCSS("padding", "0px");
		await expect(page.locator(".probe-virtual")).toHaveCSS("overflow", "auto");
		await expect(page.locator(".probe-virtual")).toHaveCSS("display", "block");
		const toggle = page.locator(".probe-switch");
		await expect(toggle).toHaveClass(/probe-unselected/);
		await expect(toggle).toHaveCSS("opacity", "0.7");
		await toggle.click();
		await expect(toggle).toHaveClass(/probe-selected/);
		await expect(toggle).toHaveCSS("opacity", "0.9");
		for (const parent of ["function", "virtual"]) {
			const row = page.locator(`.probe-${parent} .probe-function-item`);
			await expect(row).toHaveClass(/pb-list-view-item/);
			await expect(row).toHaveClass(/probe-unselected/);
			await expect(row).toHaveCSS("opacity", "0.7");
			await row.click();
			await expect(row).toHaveClass(/probe-selected/);
			await expect(row).toHaveCSS("opacity", "0.9");
			await expect(row).toHaveText("Selected row");
		}

		expect(errors).toEqual([]);
		console.log(`PASS caller classes, styles and state callbacks at ${width}px`);
		await page.close();
	}
} finally {
	await browser.close();
}
