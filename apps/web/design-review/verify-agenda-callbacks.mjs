import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
	const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
	await page.clock.setFixedTime(new Date("2026-10-20T10:00:00Z"));
	await page.goto("http://localhost:4173/catalog.html?fixture=agenda-callbacks");

	const calls = () => page.locator("[data-agenda-calls]").evaluate((node) => JSON.parse(node.textContent));

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
	console.log("PASS caller-owned selection, create, move, resize, delete with zoned timestamps and no built-in editor");
} finally {
	await browser.close();
}
