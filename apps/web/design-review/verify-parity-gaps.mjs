import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const width = Number(process.env.REVIEW_WIDTH ?? 1024);
const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 768 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.setDefaultTimeout(8000);

async function fixture(id) {
	await page.goto(`http://localhost:4173/catalog.html?fixture=${id}`);
	await page.getByText("Additional interaction cases", { exact: true }).click();
	const target = page.locator(`[data-parity-fixture="${id}"]`);
	await target.scrollIntoViewIfNeeded();

	return target;
}

try {
	let target = await fixture("carousel");
	await target.getByRole("button", { name: "Preview slide 3" }).click();
	await expect(target.getByRole("button", { name: "Preview slide 3" })).toHaveAttribute("aria-current", "true");
	await target.locator(".pb-carousel").focus();
	await page.keyboard.press("ArrowRight");
	await expect(target.getByRole("button", { name: "Preview slide 2" })).toHaveAttribute("aria-current", "true");
	console.log("PASS thumbnail selection and RTL keyboard navigation");

	target = await fixture("stepper");
	await target.getByRole("button", { name: "Go to step 3" }).focus();
	await page.keyboard.press("Enter");
	await expect(target.locator('[aria-current="step"]')).toContainText("Deliver");
	const steps = await target.locator(".pb-step").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().y));
	expect(steps[0]).toBeLessThan(steps[1]);
	expect(steps[1]).toBeLessThan(steps[2]);
	console.log("PASS vertical steps, descriptions and keyboard selection");

	target = await fixture("timeline");
	await expect(target.locator('[data-status="complete"]')).toHaveCount(1);
	await expect(target.locator('[aria-current="true"]')).toContainText("Process");
	console.log("PASS timeline complete/current/alternate states");

	target = await fixture("resizable");
	const handle = target.getByRole("separator", { name: "Resize vertical panels" });
	const before = await target.getByText("Persistent upper panel").evaluate((node) => node.parentElement.getBoundingClientRect().height);
	await handle.focus();
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("ArrowDown");
	const after = await target.getByText("Persistent upper panel").evaluate((node) => node.parentElement.getBoundingClientRect().height);
	expect(after).toBeGreaterThan(before);
	await page.waitForTimeout(150);
	await page.reload();
	await page.getByText("Additional interaction cases", { exact: true }).click();
	const persisted = await page.getByText("Persistent upper panel").evaluate((node) => node.parentElement.getBoundingClientRect().height);
	expect(Math.abs(persisted - after)).toBeLessThan(2);
	console.log("PASS percentage sizes, vertical keyboard resizing and persistence");

	target = await fixture("context-menu");
	await target.getByText("Right-click for nested actions").click({ button: "right" });
	await page.getByRole("menuitem", { name: "Move to" }).hover();
	await page.getByRole("menuitem", { name: "Workspace", exact: true }).click();
	await expect(target.getByRole("status")).toHaveText("workspace");
	console.log("PASS nested menu pointer selection");

	target = await fixture("sheet");
	await target.getByRole("button", { name: "right sheet", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Snap sheet" });
	await expect(dialog).toBeVisible();
	await page.waitForTimeout(650);
	const bounds = await dialog.boundingBox();
	expect(bounds.x).toBeGreaterThan(width * 0.35);
	expect(bounds.x + bounds.width).toBeGreaterThan(width - 34);
	await dialog.getByRole("button", { name: "Change snap point" }).click();
	await expect.poll(async () => (await dialog.boundingBox()).width).toBeGreaterThan(width * 0.7);
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	console.log("PASS directional detached sheet, snap resize and Escape");

	target = await fixture("list-view");
	expect(await target.getByRole("row").count()).toBeLessThan(100);
	const list = target.getByRole("grid");
	await list.evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});
	await expect(target.getByRole("row").filter({ hasText: "Route 499" })).toBeVisible();
	console.log("PASS virtual list bounds and scrolling to final item");

	target = await fixture("data-grid");
	expect(await target.getByRole("row").count()).toBeLessThan(100);
	await target.getByRole("button", { name: "Load more", exact: true }).click();
	await expect(target.getByRole("status")).toHaveText("Load more requested");
	const scroll = target.locator('[data-slot="table-scroll-container"]');
	await scroll.evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});
	await expect(target.getByRole("row").filter({ hasText: "Route 499" })).toBeVisible();
	console.log("PASS virtual table bounds, final-row scrolling and load-more callback");

	target = await fixture("rich-text-editor");
	const editor = target.getByRole("textbox", { name: "Extended editor" });
	await editor.fill("/head");
	await expect(page.getByRole("option", { name: "Heading", exact: true })).toBeVisible();
	await editor.press("Enter");
	await editor.pressSequentially("A heading");
	await expect(editor.locator("h2")).toHaveText("A heading");
	console.log("PASS slash command filtering and keyboard application");

	target = await fixture("agenda");
	const event = target.getByRole("button", { name: /Editable event/ });
	await event.focus();
	await page.keyboard.press("Alt+ArrowDown");
	await expect(target.getByRole("status")).toHaveText("2026-10-20T09:15:00.000Z");
	console.log("PASS zoned calendar keyboard edit preserves instant");

	target = await fixture("sidebar");
	await target.getByRole("link", { name: "Project", exact: true }).click();
	await expect(target.getByRole("button", { name: "Back to Instance" })).toBeVisible();
	await expect(target.getByRole("link", { name: "Members", exact: true })).toBeVisible();
	await target.getByRole("button", { name: "Back to Instance" }).click();
	await expect(target.getByRole("link", { name: "Project", exact: true })).toBeVisible();
	console.log("PASS contextual sidebar local forward/back navigation");

	target = await fixture("pressable-feedback");
	await target.getByRole("button", { name: "Click to confirm", exact: true }).click();
	await page.waitForTimeout(160);
	const intermediate = await target.locator(".pb-hold-progress").evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m22);
	expect(intermediate).toBeGreaterThan(0);
	expect(intermediate).toBeLessThan(1);
	await expect(target.getByRole("status")).toHaveText("Completed");
	console.log("PASS continuous progress sweep and completion callback");

	target = await fixture("sheet");
	await target.getByRole("button", { name: "bottom sheet", exact: true }).click();
	const parent = page.getByRole("dialog", { name: "Snap sheet", exact: true });
	await parent.getByRole("button", { name: "Nested sheet", exact: true }).click();
	const nested = page.getByRole("dialog", { name: "Nested sheet", exact: true });
	await expect(nested).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(nested).toHaveCount(0);
	await expect(parent).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(parent).toHaveCount(0);
	console.log("PASS nested sheet dismissal keeps parent open");

	const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
	try {
		const mobile = await touch.newPage();
		await mobile.goto("http://localhost:4173/catalog.html?component=pressable-feedback");
		const button = mobile.getByRole("button", { name: "Press me", exact: true });
		const bounds = await button.boundingBox();
		const session = await touch.newCDPSession(mobile);
		await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
		await mobile.waitForTimeout(60);
		await expect(button.locator(".pb-press-ripple")).toHaveCount(0);
		await mobile.waitForTimeout(150);
		await expect(button.locator(".pb-press-ripple")).toHaveCount(1);
		await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect(button.locator(".pb-press-ripple")).toHaveCount(0);
		console.log("PASS delayed touch ripple and release lifecycle");
	} finally {
		await touch.close();
	}

	expect(errors).toEqual([]);
	console.log("PASS advanced parity fixtures without browser errors");
} finally {
	await browser.close();
}
