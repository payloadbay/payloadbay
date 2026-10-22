import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const findings = [];
try {
	for (const side of ["catalog-pro", "catalog"]) {
		const context = await browser.newContext({
			viewport: { width: 390, height: 900 },
			hasTouch: true,
			isMobile: true,
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
		});
		await context.addInitScript(() => {
			Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
			Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
		});
		const page = await context.newPage();
		page.setDefaultTimeout(6000);
		for (const id of ["bar-chart", "floating-toc", "context-menu", "navbar", "emoji-picker", "cell-color-picker"]) {
			try {
				await page.goto(`http://localhost:4173/${side}.html?component=${id}`);
				if (id === "bar-chart") {
					await page.locator(".recharts-bar-rectangle").first().hover();
					const cursor = page.locator(".recharts-tooltip-cursor");
					await expect(cursor).toBeVisible();
					expect(await cursor.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(0.05);
				}

				if (id === "floating-toc") {
					const trigger = page.getByRole("button", { name: "Table of contents" });
					await trigger.click();
					const item = page.getByText("API reference", { exact: true }).last();
					await expect(item).toBeVisible();
					const a = await trigger.boundingBox();
					const b = await item.boundingBox();
					expect(b.x + b.width).toBeLessThanOrEqual(a.x + 5);
					expect(Math.abs(b.y - a.y)).toBeLessThan(150);
					await item.click();
				}

				if (id === "context-menu") {
					const target = page.getByText("Right-click, long-press, or use Shift+F10", { exact: true });
					await target.scrollIntoViewIfNeeded();
					const box = await target.boundingBox();
					const cdp = await context.newCDPSession(page);
					await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
					await page.waitForTimeout(750);
					await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
					await expect(page.getByRole("menuitem", { name: "Rename" })).toBeVisible();
					await page.getByRole("menuitem", { name: "Rename" }).tap();
					await expect(page.getByRole("status")).toHaveText("rename");
					await cdp.detach();
				}

				if (id === "navbar") {
					const button = page.locator(side === "catalog-pro" ? "[data-slot=navbar-menu-toggle]" : ".pb-navbar-toggle");
					await button.click();
					await expect(button).toHaveAttribute(side === "catalog-pro" ? "aria-pressed" : "aria-expanded", "true");
					const link = page.getByRole("link", { name: "Projects", exact: true }).last();
					await expect(link).toBeVisible();
					if (side === "catalog-pro") await button.click();
					else {
						await link.focus();
						await page.keyboard.press("Escape");
					}

					await expect(button).toHaveAttribute(side === "catalog-pro" ? "aria-pressed" : "aria-expanded", "false");
				}

				if (id === "cell-color-picker") {
					await page.getByRole("button", { name: /Accent/ }).click();
					await expect(page.getByRole("textbox", { name: "Hex color" })).toBeVisible();
					await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".color-area").getBoundingClientRect().width - document.querySelector(".color-slider").getBoundingClientRect().width))).toBeLessThanOrEqual(1);
				}

				if (id === "emoji-picker") {
					await page.getByRole("button", { name: "Choose emoji" }).click();
					await page.getByRole("searchbox", { name: "Search emoji" }).fill("rocket");
					await page
						.getByRole("option", { name: /rocket|🚀/i })
						.first()
						.click();
					await expect(page.getByRole("button", { name: "Choose emoji" })).toContainText("🚀");
				}

				await page.screenshot({ path: `/tmp/pab-review-interaction-${side}-${id}.png` });
				console.log("PASS", side, id);
			} catch (error) {
				findings.push({ side, id, error: error.message });
				console.log("FAIL", side, id, error.message);
			}
		}

		await context.close();
	}

	expect(findings).toEqual([]);
} finally {
	await browser.close();
}
