import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test, expect } from "../helpers/browser-test.ts";
import { verifyParityGaps } from "../../apps/web/design-review/verify-parity-gaps.mjs";
import { verifyCatalogInteractions } from "../../apps/web/design-review/verify-catalog-interactions.mjs";
import { componentIds, componentName } from "../../apps/web/design-review/catalog-items.ts";
import { catalogVariants, variantLabel } from "../../apps/web/design-review/catalog-variants.ts";

const directory = mkdtempSync(join(tmpdir(), "payloadbay-ui-coverage-"));
const origin = "http://127.0.0.1:4183";
let server: ChildProcess;

test.use({ coverageAssets: { directory, prefix: "/" } });

test.beforeAll(async () => {
	server = spawn("bun", ["apps/web/design-review/serve.mjs"], {
		env: {
			...process.env,
			REVIEW_PORT: "4183",
			REVIEW_HOST: "127.0.0.1",
			REVIEW_OUTPUT_DIR: directory,
			REVIEW_SOURCE_COVERAGE: "true",
			REVIEW_REFERENCE_DIR: "",
			REVIEW_BUILD_ONLY: "0",
		},
		stdio: ["ignore", "ignore", "inherit"],
	});
	await expect
		.poll(
			async () => {
				if (server.exitCode !== null) throw Error("Public component gallery stopped before startup");
				try {
					return await (await fetch(origin + "/__revision")).json();
				} catch {
					return { revision: 0 };
				}
			},
			{ timeout: 30000 },
		)
		.toMatchObject({ error: "", revision: 1 });
});

test.afterAll(async () => {
	if (server && server.exitCode === null && server.signalCode === null) {
		const stopped = once(server, "exit");
		server.kill("SIGTERM");
		await stopped;
	}

	rmSync(directory, { recursive: true, force: true });
});

test("public UI catalog preserves its interactive contracts on mobile", async ({ page }) => {
	test.setTimeout(120000);
	await page.setViewportSize({ width: 390, height: 900 });
	await verifyCatalogInteractions(page, origin);
});

test("emoji categories retain global search and the selected skin tone", async ({ page }) => {
	await page.goto(origin + "/catalog.html?component=emoji-picker");
	await page.getByRole("button", { name: "Choose emoji", exact: true }).click();
	const categories = page.getByRole("radiogroup", { name: "Emoji category" });
	await categories.getByRole("radio", { name: "Food & drink", exact: true }).click();
	await expect(page.getByRole("option", { name: "🍇", exact: true })).toBeVisible();
	await page.getByPlaceholder("Search emoji…").fill("thumbs up");
	await expect(categories.getByRole("radio", { name: "All emoji", exact: true })).toBeChecked();
	await page.locator(".pb-emoji-tone").click();
	await page.getByRole("radio", { name: "Medium dark skin tone", exact: true }).click();
	await page.getByRole("option", { name: "👍🏾", exact: true }).click();
	await expect(page.getByRole("button", { name: "Choose emoji", exact: true })).toContainText("👍🏾");
});

test("count charts expose readable traffic and job tooltip values", async ({ page }) => {
	await page.goto(origin + "/replacement.html");
	for (const label of ["Traffic", "Jobs", "Low-count traffic"]) {
		const section = page.getByRole("region", { name: label, exact: true });
		await section.scrollIntoViewIfNeeded();
		const chart = section.locator(".recharts-wrapper");
		const box = await chart.boundingBox();
		if (!box) throw Error("Chart has no visible bounds");
		await chart.hover({ position: { x: box.width / 2, y: box.height / 2 } });
		await expect(section.locator(".pb-traffic-tooltip")).toBeVisible();
		await expect(section.locator(".pb-traffic-tooltip-row").first()).toContainText(/\d/);
	}
});

test("public UI catalog renders every component and variant without runtime errors", async ({ page }) => {
	test.setTimeout(180000);
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(origin + "/catalog.html?component=all");
	for (const id of componentIds) {
		await test.step(componentName(id), async () => {
			const section = page.locator(`[data-review-component="${id}"]`);
			await section.scrollIntoViewIfNeeded();
			await expect(section.getByRole("heading", { name: componentName(id), exact: true })).toBeVisible();
			for (const variant of catalogVariants[id] ?? []) {
				const select = section.getByRole("button", { name: new RegExp(componentName(id) + " example") });
				await select.click();
				await page.getByRole("option", { name: variantLabel(variant), exact: true }).click();
				await expect(select).toContainText(variantLabel(variant));
			}
		});
	}

	expect(errors).toEqual([]);
});

test("agenda emits caller-owned create, move, resize, select and delete events", async ({ page }) => {
	await page.clock.setFixedTime(new Date("2026-10-20T10:00:00Z"));
	await page.goto(origin + "/catalog.html?fixture=agenda-callbacks");

	const calls = () => page.locator("[data-agenda-calls]").evaluate((node) => JSON.parse(node.textContent ?? "[]"));

	const event = page.getByRole("button", { name: /Callback event/ });
	await event.click();
	await expect(event).toHaveAttribute("aria-pressed", "true");
	expect(await calls()).toEqual([{ kind: "select", id: "review" }]);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await event.focus();
	await event.press("Alt+ArrowDown");
	expect((await calls()).at(-1)).toEqual({
		kind: "move",
		id: "review",
		start: "2026-10-20T09:15:00.000Z",
		end: "2026-10-20T10:15:00.000Z",
	});
	const grip = event.locator(".pb-agenda-resize");
	await grip.hover();
	const box = await grip.boundingBox();
	if (!box) throw Error("Agenda resize grip is not visible");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 30, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await calls()).at(-1)?.kind).toBe("resize");
	expect((await calls()).at(-1)).toEqual({
		kind: "resize",
		id: "review",
		start: "2026-10-20T09:15:00.000Z",
		end: "2026-10-20T10:45:00.000Z",
	});
	await page.getByRole("button", { name: /Add event .* 13:00/ }).focus();
	await page.keyboard.press("Enter");
	expect((await calls()).at(-1)).toEqual({ kind: "create", start: "2026-10-20T11:00:00.000Z", end: "2026-10-20T12:00:00.000Z" });
	await event.focus();
	await event.press("Delete");
	await expect(event).toHaveCount(0);
	expect((await calls()).slice(-2)).toEqual([
		{ kind: "delete", id: "review" },
		{ kind: "select", id: null },
	]);
	await expect(page.locator(".pb-agenda-now")).toHaveCSS("height", "2px");
	await expect(page.locator(".pb-agenda-now")).toHaveCSS("width", await page.locator(".pb-agenda-day").evaluate((node) => `${node.clientWidth}px`));

	await page.getByRole("button", { name: "All-day release", exact: true }).click();
	await expect(page.getByRole("button", { name: "All-day release", exact: true })).toHaveAttribute("aria-pressed", "true");
	const day = await page.locator(".pb-agenda-day").boundingBox();
	const scroll = await page.locator(".pb-agenda-scroll").boundingBox();
	if (!day || !scroll) throw Error("Agenda day is not visible");
	const beforeCreate = (await calls()).length;
	await page.mouse.move(day.x + day.width * 0.7, scroll.y + scroll.height / 2);
	await page.mouse.down();
	await page.mouse.move(day.x + day.width * 0.7, scroll.y + scroll.height / 2 + 30, { steps: 8 });
	await page.mouse.up();
	await expect.poll(async () => (await calls()).length).toBeGreaterThan(beforeCreate);
	expect((await calls()).at(-1)?.kind).toBe("create");
	await page.getByRole("button", { name: "Previous period", exact: true }).click();
	await page.getByRole("button", { name: "Next period", exact: true }).click();
	await page.getByRole("button", { name: "Today", exact: true }).click();
	expect((await calls()).at(-1)?.kind).toBe("date");
	await page.getByRole("radio", { name: "Month", exact: true }).click();
	await expect(page.locator(".pb-agenda-month-week > section")).toHaveCount(42);
	await page
		.locator(".pb-agenda-month-week > section")
		.nth(10)
		.getByRole("button", { name: /Add event/ })
		.click();
	expect((await calls()).at(-1)?.kind).toBe("create");
});

test("public UI advanced fixtures preserve navigation, resizing and editor commands", async ({ page }) => {
	test.setTimeout(120000);
	await verifyParityGaps(page, origin, 1280);
});

test("copy, carousel, TOC and mobile keyboard actions produce visible results", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto(origin + "/catalog.html?component=code-block");
	await page.getByRole("button", { name: "Copy code", exact: true }).click();
	await expect(page.getByRole("button", { name: "Copied code", exact: true })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
	await page.goto(origin + "/catalog.html?component=carousel");
	await page.getByRole("button", { name: "Next slide", exact: true }).click();
	await page.getByRole("button", { name: "Previous slide", exact: true }).click();
	await expect(page.getByRole("button", { name: "Go to slide 1", exact: true })).toHaveAttribute("aria-current", "true");
	await page.goto(origin + "/catalog.html?component=floating-toc");
	await page.locator(".pb-toc-bars").hover();
	await page.getByRole("navigation", { name: "Table of contents", exact: true }).getByRole("link", { name: "Configuration", exact: true }).click();
	await expect(page.getByRole("status")).toHaveText("toc-configuration");
	await page.goto(origin + "/catalog.html?fixture=stepper");
	await page.getByText("Additional interaction cases", { exact: true }).click();
	await page.getByRole("button", { name: "Go to step 1", exact: true }).click();
	await expect(page.locator('[aria-current="step"]')).toContainText("Receive");
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto(origin + "/catalog.html?component=navbar");
	await page.getByRole("button", { name: "Open menu", exact: true }).click();
	await page.getByRole("navigation", { name: "Mobile navigation", exact: true }).getByRole("link").first().focus();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("navigation", { name: "Mobile navigation", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeFocused();
});

test("rich text formatting actions and history retain editable content", async ({ page }) => {
	await page.goto(origin + "/catalog.html?component=rich-text-editor");
	const editor = page.getByRole("textbox", { name: "Notification message", exact: true });
	await editor.fill("Formatted example");
	for (const name of ["Bold", "Italic", "Strike through", "Heading", "Bullet list", "Ordered list", "Code block"]) {
		await page.getByRole("button", { name, exact: true }).click();
		await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
	}

	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(page.getByRole("button", { name: "Code block", exact: true })).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await expect(editor).toContainText("Formatted example");
});

test("file trees and data grids expose row actions, keyboard reordering and empty search results", async ({ page }) => {
	await page.goto(origin + "/catalog.html?component=file-tree");
	await page.getByRole("row", { name: /helpers.ts/ }).focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("status")).toHaveText("helpers");
	await page.goto(origin + "/catalog.html?fixture=file-tree");
	await page.getByText("Additional interaction cases", { exact: true }).click();
	await page.getByRole("button", { name: "Move helpers.ts", exact: true }).focus();
	await page.keyboard.press("Enter");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("Enter");
	await expect(page.getByRole("status")).toHaveText("helpers to handlers");
	await page.goto(origin + "/catalog.html?fixture=data-grid");
	await page.getByText("Additional interaction cases", { exact: true }).click();
	await page.getByRole("row").filter({ hasText: "Route 0" }).click();
	await expect(page.getByRole("status")).toHaveText("Opened 0");
	await page.getByRole("searchbox", { name: "Search Virtualized routes", exact: true }).fill("missing route");
	await expect(page.getByText("No matching rows", { exact: true })).toBeVisible();
});

test("sheet drag handles settle small drags and support keyboard dismissal", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(origin + "/catalog.html?component=sheet");
	await page.getByRole("button", { name: "Open sheet", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Delivery details", exact: true });
	const handle = dialog.getByRole("button", { name: "Drag down or press to close sheet", exact: true });
	await page.evaluate(() => document.fonts.ready);
	const original = await dialog.boundingBox();
	const bounds = await handle.boundingBox();
	if (!bounds || !original) throw Error("Sheet handle has no visible bounds");
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 20, { steps: 10 });
	await expect.poll(async () => (await dialog.boundingBox())!.y).toBeGreaterThan(original.y + 10);
	await page.waitForTimeout(100);
	await page.mouse.up();
	await expect(dialog).toBeVisible();
	await expect.poll(async () => (await dialog.boundingBox())!.y).toBeCloseTo(original.y, 0);
	await handle.focus();
	await page.keyboard.press("Enter");
	await expect(dialog).toHaveCount(0);
});
