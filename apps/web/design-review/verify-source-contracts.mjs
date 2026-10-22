import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.setDefaultTimeout(8000);

async function show(id) {
	await page.goto(`http://localhost:4173/catalog.html?component=${id}`);
	await page.locator("h1").first().waitFor();
}

try {
	await show("hover-card");
	const trigger = page.getByRole("button", { name: "Orders project", exact: true });
	const preview = page.getByRole("dialog", { name: "Orders project details" });
	await trigger.hover();
	await page.waitForTimeout(200);
	await expect(preview).toHaveCount(0);
	await expect(preview).toBeVisible();
	const bounds = await preview.boundingBox();
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 15 });
	await page.waitForTimeout(450);
	await expect(preview).toBeVisible();
	await page.getByRole("button", { name: "Open project", exact: true }).focus();
	await page.keyboard.press("Escape");
	await expect(preview).toHaveCount(0);
	await page.mouse.move(1, 1);
	await page.keyboard.press("Tab");
	await trigger.focus();
	await expect(preview).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(preview).toHaveCount(0);
	console.log("PASS hover delay, pointer transit, interactive content, keyboard focus and Escape");

	const touchContext = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
	try {
		const touchPage = await touchContext.newPage();
		await touchPage.goto("http://localhost:4173/catalog.html?component=hover-card");
		const target = await touchPage.getByRole("button", { name: "Orders project", exact: true }).boundingBox();
		const input = await touchContext.newCDPSession(touchPage);
		await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
		await touchPage.waitForTimeout(900);
		await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect(touchPage.getByRole("dialog", { name: "Orders project details" })).toBeVisible();
	} finally {
		await touchContext.close();
	}

	console.log("PASS touch long press opens the interactive preview");

	await show("floating-toc");
	await page.getByRole("button", { name: "Table of contents", exact: true }).hover();
	await expect(page.getByRole("navigation", { name: "Table of contents" })).toBeVisible();
	await page.getByRole("link", { name: "Delivery", exact: true }).hover();
	await page.waitForTimeout(400);
	await expect(page.getByRole("navigation", { name: "Table of contents" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("navigation", { name: "Table of contents" })).toHaveCount(0);
	console.log("PASS TOC opens on hover and survives pointer movement into its content");

	await show("segment");
	const start = await page.locator(".pb-segment-indicator").boundingBox();
	await page.getByRole("radio", { name: "Archived", exact: true }).click();
	const positions = await page.evaluate(async () => {
		const values = [];
		for (let index = 0; index < 20; index++) {
			await new Promise(requestAnimationFrame);
			values.push(document.querySelector(".pb-segment-indicator").getBoundingClientRect().x);
		}

		return values;
	});
	const end = await page.locator(".pb-segment-indicator").boundingBox();
	expect(positions.some((x) => x > start.x + 1 && x < end.x - 1)).toBe(true);
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(await page.locator(".pb-segment-indicator").evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	console.log("PASS segment has intermediate movement and honors reduced motion");

	await show("cell-color-picker");
	const color = page.getByRole("button", { name: "Accent", exact: true });
	const colorBounds = await color.boundingBox();
	const available = await color.evaluate((element) => element.parentElement.getBoundingClientRect().width);
	expect(Math.abs(colorBounds.width - available)).toBeLessThan(2);
	const colorStyle = await color.evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
	expect(colorStyle.background).not.toBe(colorStyle.color);
	console.log("PASS full-width field-style color picker");

	await show("cell-slider");
	const track = page.locator('[data-slot="slider-track"]');
	expect((await track.boundingBox()).height).toBe(36);
	await expect(track).toContainText("Concurrency");
	await expect(track).toContainText("24");
	console.log("PASS cell slider composes label/output inside the draggable field");

	await show("kpi-group");
	await expect(page.locator(".pb-kpi-chart .recharts-area-curve")).toHaveCount(2);
	const cards = await page.locator(".pb-kpi").evaluateAll((elements) => elements.map((element) => ({ y: element.getBoundingClientRect().y, width: element.getBoundingClientRect().width })));
	expect(cards[0].y).toBe(cards[1].y);
	const unclipped = await page.locator(".pb-kpi-content").evaluateAll((elements) => elements.every((element) => [...element.children].every((child) => child.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1)));
	expect(unclipped).toBe(true);
	expect(
		await page
			.locator(".pb-kpi-chart")
			.first()
			.evaluate((element) => getComputedStyle(element).maskImage),
	).not.toBe("none");
	console.log("PASS KPI grouped geometry and real gradient sparklines");

	await show("file-tree");
	await expect(page.locator(".pb-file-tree").first().locator(".pb-tree-guide")).toHaveCount(2);
	const guide = await page.locator(".pb-file-tree").first().locator(".pb-tree-guide").first().boundingBox();
	expect(guide.width).toBe(1);
	expect(guide.height).toBeGreaterThan(20);
	console.log("PASS depth guides span nested file rows");

	await show("code-block");
	await page.getByRole("button", { name: "Copy code", exact: true }).click();
	await expect(page.getByRole("button", { name: "Copied code", exact: true })).toBeVisible();
	await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("export async function POST");
	const iconOpacities = await page.getByRole("button", { name: "Copied code", exact: true }).evaluate(async (button) => {
		const values = [];
		for (let index = 0; index < 12; index++) {
			await new Promise(requestAnimationFrame);
			const icon = button.querySelector("span");
			if (icon) values.push(Number(getComputedStyle(icon).opacity));
		}

		return values;
	});
	expect(iconOpacities.some((opacity) => opacity > 0.01 && opacity < 0.99)).toBe(true);
	console.log("PASS actual code copy and animated completion state");

	await show("pressable-feedback");
	const press = page.getByRole("button", { name: "Press me", exact: true });
	await press.hover();
	await page.mouse.down();
	await page.waitForTimeout(300);
	await expect(page.locator(".pb-press-ripple")).toHaveCount(1);
	expect(await page.locator(".pb-press-ripple").evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.05);
	await page.mouse.up();
	await expect(page.locator(".pb-press-ripple")).toHaveCount(0);
	console.log("PASS ripple stays visible while held and fades after release");

	await show("sheet");
	await page.getByRole("button", { name: "Open sheet", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Delivery details" });
	await page.waitForTimeout(550);
	const before = await dialog.boundingBox();
	const handle = await page.getByRole("button", { name: "Drag down or press to close sheet" }).boundingBox();
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 30, { steps: 10 });
	const during = await dialog.boundingBox();
	expect(during.y - before.y).toBeGreaterThan(25);
	await page.waitForTimeout(300);
	await page.mouse.up();
	await page.waitForTimeout(550);
	await expect(dialog).toBeVisible();
	expect(Math.abs((await dialog.boundingBox()).y - before.y)).toBeLessThan(2);
	console.log("PASS sheet drag moves the surface and a short drag returns smoothly");

	await page.setViewportSize({ width: 1500, height: 1000 });
	await page.goto("http://localhost:4173/");
	const reference = page.frameLocator('iframe[title="HeroUI Pro reference"]');
	const independent = page.frameLocator('iframe[title="Independent replacement"]');
	await expect(reference.locator("[data-review-component]")).toHaveCount(52);
	await expect(independent.locator("[data-review-component]")).toHaveCount(52);
	for (const [from, to, id] of [
		[reference, independent, "kpi"],
		[independent, reference, "cell-color-picker"],
		[reference, independent, "file-tree"],
	]) {
		await from.locator(`#review-${id}`).evaluate((element) => element.scrollIntoView());
		await expect.poll(() => to.locator(`#review-${id}`).evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(3);
	}

	console.log("PASS all 52 pairs on one page, synchronized scrolling in both directions");

	expect(errors).toEqual([]);
} finally {
	await browser.close();
}
