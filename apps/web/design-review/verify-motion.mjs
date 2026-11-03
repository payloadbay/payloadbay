import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const preference of ["system", "reduced"]) {
	for (const side of ["pro", "replacement"]) {
		const page = await browser.newPage({ viewport: { width: 1024, height: 1000 }, reducedMotion: "reduce" });
		await page.goto(`http://localhost:4173/${side}.html?motion=${preference}`);
		await expect(page.locator("html")).toHaveAttribute("data-review-motion", preference);
		const fill = page.locator(side === "pro" ? ".stepper__separator-fill" : ".pb-step-fill").first();
		expect(await fill.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.3s");
		const title = page.locator(side === "pro" ? ".stepper__title" : ".pb-step-title").first();
		expect(await title.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.3s");
		await page.getByRole("button", { name: "Continue", exact: true }).click();
		if (side === "pro") {
			expect(await page.locator('.stepper__indicator[data-status="complete"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
		} else {
			const frames = await page
				.locator(".pb-step-indicator")
				.first()
				.evaluate(async (element) => {
					const scales = [];
					for (let index = 0; index < 5; index++) {
						scales.push(getComputedStyle(element).transform);
						await new Promise(requestAnimationFrame);
					}

					return scales;
				});
			for (const transform of frames) expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
		}

		// Public select popovers intentionally retain their entry animation.
		await page.getByRole("button", { name: /Accent/ }).click();
		const selectMotion = await page.locator('[data-slot="select-popover"]').evaluate((element) => ({ name: getComputedStyle(element).animationName, duration: getComputedStyle(element).animationDuration }));
		expect(selectMotion.name).not.toBe("none");
		expect(selectMotion.duration).not.toBe("0s");
		await page.keyboard.press("Escape");
		await expect(page.locator('[data-slot="select-popover"]')).toHaveCount(0);
		if (side === "replacement") {
			await page.keyboard.press("Control+b");
			expect(await page.locator(".pb-layout").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
			const link = page.locator(".pb-desktop-sidebar").getByRole("link", { name: "Event log", exact: true });
			await link.scrollIntoViewIfNeeded();
			await page.mouse.move(900, 0);
			await page.waitForTimeout(100);
			await link.hover();
			const tooltipMotion = await page.getByRole("tooltip", { name: "Event log" }).evaluate((element) => ({ name: getComputedStyle(element).animationName, duration: getComputedStyle(element).animationDuration }));
			expect(tooltipMotion.name).not.toBe("none");
			expect(tooltipMotion.duration).not.toBe("0s");
		}

		await page.close();
	}
}

await browser.close();
console.log("PASS reduced motion preserves connector/select/tooltip effects while suppressing completion flourish and sidebar movement.");
