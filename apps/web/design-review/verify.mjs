import { chromium, expect } from "@playwright/test";

const b = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
for (const width of [390, 850]) {
	const p = await b.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
	p.on("pageerror", (e) => errors.push(e.message));
	await p.goto("http://localhost:4173/replacement.html");
	await p.waitForTimeout(400);
	const progress = await p.evaluate(async () => {
		Array.from(document.querySelectorAll("button"))
			.find((e) => e.textContent === "Continue")
			.click();
		const frames = [];
		for (let i = 0; i < 6; i++) {
			await new Promise((r) => setTimeout(r, 55));
			const t = getComputedStyle(document.querySelector(".pb-step-fill")).transform;
			frames.push(t === "none" ? 1 : new DOMMatrix(t).a);
		}

		return frames;
	});
	expect(progress.some((v) => v > 0 && v < 1)).toBe(true);
	console.log(width, "Animated preview with OS reduced motion:", progress);
	await p.getByRole("button", { name: /Motion/ }).click();
	await p.getByRole("option", { name: "Reduced motion", exact: true }).click();
	await expect(p.locator('[data-slot="select-popover"]')).toHaveCount(0);
	expect(await p.locator(".pb-step-fill").evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0.3s");
	await p.getByRole("button", { name: /Accent/ }).click();
	await p.getByRole("option", { name: "Success green", exact: true }).click();
	const color = await p.locator(".pb-step-fill").evaluate((e) => getComputedStyle(e).backgroundColor);
	const expectedColor = await p.evaluate(() => {
		const swatch = document.createElement("span");
		swatch.style.background = "var(--success)";
		document.body.append(swatch);
		const value = getComputedStyle(swatch).backgroundColor;
		swatch.remove();

		return value;
	});
	expect(color).toBe(expectedColor);
	await p.screenshot({ path: `/tmp/pab-v4-options-${width}.png` });
	await p.getByRole("button", { name: /Navigation side/ }).click();
	await p.getByRole("option", { name: "Right", exact: true }).click();
	if (width < 769) {
		await p.getByRole("button", { name: "Open navigation" }).click();
		await p.waitForTimeout(400);
		const dialog = p.getByRole("dialog", { name: "Project navigation" });
		await expect(dialog).toBeVisible();
		const rect = await dialog.boundingBox();
		expect(Math.abs(rect.width - Math.min(width * 0.8, 500))).toBeLessThanOrEqual(1);
		expect(Math.abs(rect.x + rect.width - width)).toBeLessThanOrEqual(1);
		await p.getByRole("button", { name: "Close navigation" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(p.getByRole("button", { name: "Open navigation" })).toBeFocused();
		await p.getByRole("button", { name: "Open navigation" }).click();
		await p.setViewportSize({ width: 900, height: 1000 });
		await expect(dialog).not.toBeVisible();
		await p.setViewportSize({ width, height: 1000 });
	} else {
		await expect(p.getByRole("button", { name: "Open navigation" })).not.toBeVisible();
		await expect(p.locator(".pb-desktop-sidebar")).toBeVisible();
	}

	for (const side of ["pro", "replacement"]) {
		await p.goto(`http://localhost:4173/${side}.html?navigation`);
		await p.waitForTimeout(400);
		if (width < 769) {
			await p.getByRole("button", { name: "Open navigation" }).click();
			await p.waitForTimeout(400);
			await p.screenshot({ path: `/tmp/pab-v4-${side}-full-mobile.png` });
			await expect(p.getByRole("dialog")).toBeVisible();
			expect(await p.locator("body").evaluate((e) => e.scrollWidth > innerWidth)).toBe(false);
			await p.keyboard.press("Escape");
		} else {
			await p.screenshot({ path: `/tmp/pab-v4-${side}-full-desktop.png` });
		}
	}

	await p.close();
}

expect(errors).toEqual([]);
await b.close();
console.log("PASS options, explicit motion, OS reduced motion, full layouts, mobile close/focus, persistent sidebar.");
