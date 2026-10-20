import { writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function show(id) {
	await page.goto(`http://localhost:4173/catalog.html?component=${id}`);
	await page.locator("h1").waitFor();
}

const findings = [];
page.setDefaultTimeout(5000);

async function check(name, run) {
	try {
		await run();
		console.log("PASS", name);
	} catch (error) {
		findings.push({ name, message: error.message });
		console.log("FAIL", name, error.message.slice(0, 300));
	}
}

await check("selects", async () => {
	for (const id of ["cell-select", "inline-select"]) {
		await show(id);
		await page.getByRole("button", { name: /Status/ }).click();
		await page.getByRole("option", { name: "Paused", exact: true }).click();
		await expect(page.getByRole("button", { name: /Status/ })).toContainText("Paused");
	}
});

await check("native-select", async () => {
	await show("native-select");
	await page.getByRole("combobox", { name: "Status" }).selectOption("paused");
	await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("paused");
});

await check("cell-switch", async () => {
	await show("cell-switch");
	const toggle = page.getByRole("switch", { name: "Enabled" });
	await expect(toggle).toBeChecked();
	await page.getByText("Enabled", { exact: true }).click();
	await expect(toggle).not.toBeChecked();
	await toggle.press("Space");
	await expect(toggle).toBeChecked();
	const controls = await page.locator('[data-slot="switch-content"]').boundingBox();
	const track = await page.locator('[data-slot="switch-control"]').boundingBox();
	expect(Math.abs(controls.y + controls.height / 2 - track.y - track.height / 2)).toBeLessThan(2);
});

await check("number-stepper", async () => {
	await show("number-stepper");
	await page.getByRole("button", { name: "Increase Retries" }).click();
	await expect(page.getByRole("textbox", { name: "Retries" })).toHaveValue("25");
});

await check("cell-slider", async () => {
	await show("cell-slider");
	const slider = page.getByRole("slider");
	await slider.focus();
	await slider.press("ArrowRight");
	await expect(slider).toHaveValue("25");
});

await check("checkbox-button-group", async () => {
	await show("checkbox-button-group");
	await page.getByText("Processing", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: /Processing/ })).toBeChecked();
});

await check("radio-button-group", async () => {
	await show("radio-button-group");
	await page.getByText("Processing", { exact: true }).click();
	await expect(page.getByRole("radio", { name: /Processing/ })).toBeChecked();
});

await check("segment", async () => {
	await show("segment");
	await page.getByText("Paused", { exact: true }).click();
	await expect(page.getByRole("radio", { name: "Paused", exact: true })).toBeChecked();
	await expect
		.poll(async () => {
			const label = await page.locator(".pb-segment-item[data-selected]").boundingBox();
			const indicator = await page.locator(".pb-segment-indicator").boundingBox();

			return Math.abs(label.width - indicator.width);
		})
		.toBeLessThan(1);
});

await check("cell-color-picker", async () => {
	await show("cell-color-picker");
	await page.getByRole("button", { name: "Accent" }).click();
	await expect(page.getByRole("slider", { name: "Hue" })).toBeVisible();
	await page.getByRole("slider", { name: "Hue" }).press("ArrowRight");
	await page.getByRole("textbox", { name: "Hex color" }).fill("#ff0000");
	await page.getByRole("textbox", { name: "Hex color" }).press("Tab");
	await expect(page.locator(".pb-color-value")).toHaveText("#FF0000");
	await page.keyboard.press("Escape");
});

await check("carousel", async () => {
	await show("carousel");
	await expect(page.getByRole("button", { name: "Previous slide" })).toBeDisabled();
	await page.getByRole("region", { name: "Project tips" }).getByRole("button", { name: "Next slide" }).click();
	await expect(page.getByRole("region", { name: "Project tips" }).locator(".pb-carousel-slide:not([inert])")).toContainText("Process");
	await page.getByRole("region", { name: "Project tips" }).focus();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("region", { name: "Project tips" }).locator(".pb-carousel-slide:not([inert])")).toContainText("Deliver");
	await page.getByRole("region", { name: "Project tips" }).getByRole("button", { name: "Go to slide 3" }).click();
	await expect(page.getByRole("region", { name: "Project tips" }).getByRole("button", { name: "Next slide" })).toBeDisabled();
});

await check("file-tree", async () => {
	await show("file-tree");
	await page.getByRole("button", { name: "Expand handlers" }).click();
	const motion = await page.evaluate(async () => {
		const frames = [];
		for (let i = 0; i < 12; i++) {
			await new Promise(requestAnimationFrame);
			for (const animation of document.getAnimations()) if (animation.effect?.target?.classList?.contains("pb-file-tree")) frames.push(animation.effect.getComputedTiming().progress);
		}

		return frames;
	});
	expect(motion.some((value) => value > 0 && value < 1)).toBe(true);
	await expect(page.getByRole("row", { name: /ingress.ts/ })).toBeVisible();
	await page.getByRole("button", { name: "Collapse handlers" }).click();
	await expect(page.getByRole("row", { name: /ingress.ts/ })).toHaveCount(0);
});

await check("data-grid", async () => {
	await show("data-grid");
	await page.getByRole("searchbox", { name: "Search Routes" }).fill("pay");
	await expect(page.getByRole("row").filter({ hasText: "Payments" })).toBeVisible();
	await expect(page.getByRole("row").filter({ hasText: "Orders" })).toHaveCount(0);
	await page.getByRole("button", { name: "Clear search" }).click();
	await page.getByRole("columnheader", { name: "Events" }).click();
	await expect(page.getByRole("row").nth(1)).toContainText("Alerts");
	await page.getByRole("row").filter({ hasText: "Orders" }).getByRole("checkbox").focus();
	await page.keyboard.press("Space");
	await expect(page.getByRole("row").filter({ hasText: "Orders" })).toHaveAttribute("aria-selected", "true");
});

await check("drop-zone", async () => {
	await show("drop-zone");
	await page.locator('input[type="file"]').setInputFiles({ name: "fixture.json", mimeType: "application/json", buffer: Buffer.from("{}") });
	await expect(page.getByText("fixture.json", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Remove fixture.json" }).click();
	await expect(page.getByText("fixture.json", { exact: true })).toHaveCount(0);
	await page.locator('input[type="file"]').setInputFiles({ name: "unsafe.txt", mimeType: "text/plain", buffer: Buffer.from("not json") });
	await expect(page.getByRole("alert")).toContainText("unsupported file type");
});

await check("rich-text-editor", async () => {
	await show("rich-text-editor");
	const editor = page.getByRole("textbox", { name: "Notification message" });
	await editor.fill("Delivery succeeded");
	await editor.press("Control+a");
	await page.getByRole("button", { name: "Bold", exact: true }).click();
	await expect(editor.locator("strong")).toHaveText("Delivery succeeded");
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(editor.locator("strong")).toHaveCount(0);
});

await check("context-menu", async () => {
	await show("context-menu");
	await page.getByText("Right-click, long-press, or use Shift+F10", { exact: true }).click({ button: "right" });
	await page.getByRole("menuitem", { name: "Rename" }).click();
	await expect(page.getByRole("status")).toHaveText("rename");
});

await check("hover-card", async () => {
	await show("hover-card");
	await page.getByRole("button", { name: "Orders project", exact: true }).hover();
	await expect(page.getByRole("dialog", { name: "Orders project details" })).toBeVisible();
	await page.getByRole("button", { name: "Open project", exact: true }).click();
	await expect(page.getByRole("status")).toHaveText("Project opened");
});

await check("sheet", async () => {
	await show("sheet");
	await page.getByRole("button", { name: "Open sheet", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Delivery details" });
	await expect(sheet).toBeVisible();
	await page.getByRole("button", { name: "Close sheet", exact: true }).click();
	await expect(sheet).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Open sheet", exact: true })).toBeFocused();
	await page.getByRole("button", { name: "Open sheet", exact: true }).click();
	await expect(sheet).toBeVisible();
	const handle = page.getByRole("button", { name: "Drag down or press to close sheet" });
	const box = await handle.boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 25, { steps: 8 });
	await page.waitForTimeout(200);
	await page.mouse.up();
	await expect(sheet).toBeVisible();
	await handle.press("Enter");
	await expect(sheet).toHaveCount(0);
});

await check("pressable-feedback", async () => {
	await show("pressable-feedback");
	const hold = page.getByRole("button", { name: "Hold to confirm" });
	await hold.click();
	await expect(page.getByRole("status")).toHaveCount(0);
	await hold.focus();
	await page.keyboard.down("Space");
	await page.waitForTimeout(900);
	await page.keyboard.up("Space");
	await expect(page.getByRole("status")).toHaveText("Confirmed");
});

await check("action-bar", async () => {
	await show("action-bar");
	await page.getByRole("button", { name: "Clear selection" }).click();
	await expect(page.getByRole("toolbar", { name: "Selection actions" })).toHaveCount(0);
});

await check("agenda", async () => {
	await show("agenda");
	await page.getByRole("radio", { name: "Month", exact: true }).click();
	await expect(page.locator(".pb-agenda-month-week > section")).toHaveCount(42);
	await page.getByRole("radio", { name: "Day", exact: true }).click();
	await expect(page.locator(".pb-agenda-day")).toHaveCount(1);
});

await check("emoji-picker", async () => {
	await show("emoji-picker");
	await page.getByRole("button", { name: "Choose emoji" }).click();
	await expect(page.locator(".pb-emoji-grid")).toBeVisible();
	const emojiSearch = page.getByRole("searchbox", { name: "Search emoji" });
	await emojiSearch.fill("rocket");
	await page.getByRole("option", { name: "🚀", exact: true }).first().click();
	await expect(page.getByRole("button", { name: "Choose emoji" })).toContainText("🚀");
});
await check("navbar", async () => {
	await show("navbar");
	await page.getByRole("button", { name: "Open menu" }).click();
	await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
	await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Projects" }).click();
	await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
});
await check("text-shimmer-motion", async () => {
	await show("text-shimmer");
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(await page.locator(".pb-text-shimmer").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	expect(await page.locator(".pb-text-shimmer").evaluate((element) => getComputedStyle(element).animationName)).toBe("pb-shimmer");
});
await browser.close();
await writeFile("/tmp/pab-catalog-interaction-report.json", JSON.stringify({ findings, errors }, null, 2));
expect(errors).toEqual([]);
expect(findings).toEqual([]);
console.log("PASS all catalog interaction contracts");
