import { chromium, expect } from "@playwright/test";
import { catalogVariants, variantLabel } from "./catalog-variants.ts";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	for (const width of [390, 1024]) {
		const measurements = {};
		for (const side of ["catalog-pro", "catalog"]) {
			const page = await browser.newPage({ viewport: { width, height: 900 } });
			page.setDefaultTimeout(8000);
			await page.clock.setFixedTime(new Date("2026-10-20T10:00:00Z"));
			const errors = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await page.goto(`http://localhost:4173/${side}.html?component=timeline`);
			measurements[side] = {};
			for (const variant of catalogVariants.timeline) {
				await page.getByRole("button", { name: /Timeline example/ }).click();
				await page.getByRole("option", { name: variantLabel(variant), exact: true }).click();
				await expect(page.getByRole("button", { name: /Timeline example/ })).toContainText(variantLabel(variant));
				await page.evaluate(() =>
					Promise.all(
						document
							.getAnimations()
							.filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
							.map((animation) => animation.finished.catch(() => undefined)),
					),
				);
				measurements[side][variant] = await page.locator("ol").evaluate((list) => {
					const rows = [...list.children];

					return rows.map((row) => {
						const connector = row.querySelector('[class*="connector"]');
						const box = row.getBoundingClientRect();

						return {
							height: box.height,
							gap: getComputedStyle(row).columnGap,
							lineWidth: connector ? getComputedStyle(connector).width : null,
							lineBottom: connector ? connector.getBoundingClientRect().bottom - box.bottom : null,
						};
					});
				});
				await page.screenshot({ path: `/tmp/pab-final-${side}-${variant}-${width}.png`, fullPage: true });
			}

			console.log("CHECK", width, side, "emoji");
			await page.goto(`http://localhost:4173/${side}.html?component=emoji-picker`);
			await page.getByRole("button", { name: /Choose emoji/ }).click();
			await page.locator(side === "catalog" ? ".pb-emoji-tone" : "[data-slot=emoji-picker-skin-tone-picker]").click();
			const tones = page.getByRole("dialog", { name: "Skin tone", exact: true });
			await expect(tones).toBeVisible();
			const option = tones.getByRole(side === "catalog" ? "radio" : "button", { name: side === "catalog" ? "Light skin tone" : "Light", exact: true });
			await expect(option).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
			await expect(option).toHaveCSS("border-top-width", "0px");
			await expect(option).toHaveCSS("box-shadow", "none");
			await page.waitForTimeout(200);
			await page.screenshot({ path: `/tmp/pab-final-${side}-tones-${width}.png`, fullPage: true });
			await option.click();
			await expect(tones).toHaveCount(0);
			await page.goto(`http://localhost:4173/${side}.html?component=navbar`);
			const nav = page.locator(side === "catalog" ? ".pb-navbar" : ".navbar");
			const background = await nav.evaluate((element) => {
				const probe = document.createElement("span");
				probe.style.background = "var(--background)";
				element.append(probe);
				const expected = getComputedStyle(probe).backgroundColor;
				probe.remove();

				return [getComputedStyle(element).backgroundColor, expected];
			});
			expect(background[0]).toBe(background[1]);
			console.log("CHECK", width, side, "agenda");
			await page.goto(`http://localhost:4173/${side}.html?component=agenda`);
			await page.getByText("Review deliveries", { exact: true }).first().click();
			await expect(page.getByRole("status")).toHaveText("Selected: Review deliveries");
			await expect(page.getByRole("dialog", { name: "Calendar event" })).toHaveCount(0);
			expect(errors).toEqual([]);
			await page.close();
		}

		for (const variant of catalogVariants.timeline) {
			const ours = measurements.catalog[variant];
			const reference = measurements["catalog-pro"][variant];
			for (let index = 0; index < ours.length; index++) {
				expect(ours[index].height, `${width}/${variant}/row ${index}`).toBeCloseTo(reference[index].height, 0);
				expect(ours[index].gap).toBe(reference[index].gap);
				if (index < ours.length - 1) {
					expect(ours[index].lineWidth).toBe("2px");
					expect(ours[index].lineBottom, `${width}/${variant}/connector ${index}`).toBeCloseTo(0, 0);
				}
			}
		}

		console.log(`PASS ${width}px: all timeline variants, plain tone options, navbar background, agenda selection callbacks`);
	}
} finally {
	await browser.close();
}
