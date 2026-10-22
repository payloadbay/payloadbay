import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:4173/replacement.html");
await page.getByRole("button", { name: "Open navigation" }).click();
await expect(page.getByRole("dialog", { name: "Project navigation" })).toBeVisible();
await page.evaluate(() => {
	window.reviewOverlayCounts = [];
	window.reviewOverlayObserver = new MutationObserver(() => window.reviewOverlayCounts.push(document.querySelectorAll('[role="dialog"]').length));
	window.reviewOverlayObserver.observe(document.body, { childList: true, subtree: true });
});
await page.keyboard.press("Control+k");
const search = page.getByRole("dialog", { name: "Search pages and resources" });
await expect(search).toBeVisible();
await expect(page.getByRole("dialog", { name: "Project navigation" })).toHaveCount(0);
expect(await page.evaluate(() => Math.max(...window.reviewOverlayCounts))).toBeLessThanOrEqual(1);
await page.evaluate(() => window.reviewOverlayObserver.disconnect());
const input = page.getByPlaceholder("Search pages and resources…");
await page.keyboard.press("Control+b");
await expect(search).toBeVisible();
await expect(page.getByRole("dialog", { name: "Project navigation" })).toHaveCount(0);
await input.press("ArrowDown");
await page.keyboard.type("work");
await expect(input).toHaveValue("work");
await expect(input).toBeFocused();
await expect(page.getByRole("menuitem")).toHaveCount(1);
await expect(page.getByRole("menuitem", { name: /Workspaces/ })).toBeVisible();
await page.getByRole("button", { name: "Clear search" }).click();
await expect(input).toHaveValue("");
await expect(page.getByRole("menuitem")).toHaveCount(5);
await input.fill("work");
await input.press("ArrowDown");
await input.press("Enter");
await expect(search).toHaveCount(0);
await expect(page.getByRole("status").filter({ hasText: "Selected: Workspaces" })).toBeVisible();
await page.keyboard.press("Control+k");
await page.keyboard.press("Escape");
await expect(search).toHaveCount(0);

// A narrow positioning wrapper used to put a right drawer on the left.
await page.goto("http://localhost:4173/replacement.html?side=right&motion=reduced");
await page.getByRole("button", { name: "Open navigation" }).click();
let panel = page.getByRole("dialog", { name: "Project navigation" });
await expect(panel).toBeVisible();
const rect = await panel.boundingBox();
expect(Math.abs(rect.x + rect.width - 700)).toBeLessThan(1);
expect(Math.abs(rect.width - 500)).toBeLessThan(1);
await panel.getByRole("button", { name: "Back to workspace menu" }).click();
await expect(panel.getByRole("link", { name: "Workspace members", exact: true })).toBeVisible();
await expect(page.locator(".pb-layout-page").getByText("Overview", { exact: true })).toBeVisible();
await panel.getByRole("button", { name: "Open project menu" }).click();
await panel.getByRole("link", { name: "Members", exact: true }).click();
await expect(panel).toHaveCount(0);
expect(new URL(page.url()).hash).toBe("#members");
await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();

await page.setViewportSize({ width: 1024, height: 1000 });
await page.keyboard.press("Control+b");
const rail = page.locator(".pb-desktop-sidebar");
await expect(page.locator(".pb-layout")).toHaveClass(/collapsed/);
expect(await page.locator(".pb-layout").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
const icons = [];
for (const name of ["Overview", "Destinations", "Ingress routes", "Members", "Shared code", "Event log"]) {
	const link = rail.getByRole("link", { name, exact: true });
	await expect(link.locator(".pb-navigation-label")).not.toBeVisible();
	await expect(link.locator("svg")).toBeVisible();
	icons.push(await link.locator("svg").getAttribute("class"));
	await link.hover();
	await expect(page.getByRole("tooltip", { name, exact: true })).toHaveText(name);
	const geometry = await link.evaluate((element) => {
		const outer = element.getBoundingClientRect();
		const icon = element.querySelector("svg").getBoundingClientRect();

		return { center: Math.abs(outer.x + outer.width / 2 - icon.x - icon.width / 2), width: outer.width };
	});
	expect(geometry.center).toBeLessThan(1);
	expect(geometry.width).toBeLessThan(48);
}

expect(new Set(icons).size).toBe(6);
await page.mouse.move(1000, 0);
// Both the app's cancelable event and an unsaved local edit prevent navigation.
await page.evaluate(() => window.addEventListener("payloadbay:before-navigate", (event) => event.preventDefault(), { once: true }));
await rail.getByRole("link", { name: "Event log", exact: true }).click();
expect(new URL(page.url()).hash).toBe("#members");
await page.getByRole("button", { name: "Make unsaved demo edit" }).click();
page.once("dialog", (dialog) => dialog.dismiss());
await rail.getByRole("link", { name: "Event log", exact: true }).click();
expect(new URL(page.url()).hash).toBe("#members");
page.once("dialog", (dialog) => dialog.accept());
await rail.getByRole("link", { name: "Event log", exact: true }).click();
expect(new URL(page.url()).hash).toBe("#event-log");

for (const accent of ["brand", "success", "warning"]) {
	await page.goto(`http://localhost:4173/replacement.html?accent=${accent}&motion=reduced`);
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	const contrast = await page
		.locator(".pb-step-indicator")
		.first()
		.evaluate((element) => {
			const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

			function luminance(color) {
				context.fillStyle = color;
				context.fillRect(0, 0, 1, 1);
				const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
					const c = value / 255;

					return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
				});

				return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
			}

			const style = getComputedStyle(element);
			const a = luminance(style.backgroundColor);
			const b = luminance(style.color);

			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		});
	expect(contrast, `${accent} completed icon contrast`).toBeGreaterThanOrEqual(3);
}

for (const [name, labels] of [
	["Traffic", ["Ingress", "Accepted", "Rejected", "Outgoing attempts"]],
	["Jobs", ["Succeeded", "Failed"]],
	["Low-count traffic", ["Ingress", "Accepted", "Rejected", "Outgoing attempts"]],
]) {
	const fixture = page.getByRole("region", { name, exact: true });
	await fixture.scrollIntoViewIfNeeded();
	const chart = fixture.locator(".recharts-wrapper");
	const box = await chart.boundingBox();
	await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4);
	const tooltip = fixture.locator(".pb-traffic-tooltip");
	await expect(tooltip).toBeVisible();
	await expect(tooltip.locator(".pb-traffic-tooltip-row")).toHaveCount(labels.length);
	for (const label of labels) await expect(tooltip.getByText(label, { exact: true })).toBeVisible();
	for (const tick of await fixture.locator(".recharts-yAxis .recharts-cartesian-axis-tick-value").allTextContents()) expect(tick).not.toMatch(/\d[.,]\d/);
}

await page.getByRole("button", { name: "Retry", exact: true }).click();
await expect(page.getByRole("status").filter({ hasText: "Events loaded" })).toBeVisible();
await expect(page.getByRole("region", { name: "No middleware yet" }).locator("svg")).toHaveCount(0);
await expect(page.getByRole("region", { name: "No notification rules" })).toHaveCSS("border-top-style", "dashed");

// Parent synchronizes configuration and carries it into both full-layout links.
await page.goto("http://localhost:4173/");
await page.getByRole("button", { name: "Components", exact: true }).click();
await page.setViewportSize({ width: 1500, height: 1100 });
const replacement = page.frameLocator('iframe[title="Independent replacement"]');
const pro = page.frameLocator('iframe[title="HeroUI Pro reference"]');
await replacement.getByRole("button", { name: /Navigation side/ }).click();
await replacement.getByRole("option", { name: "Right", exact: true }).click();
await expect(pro.getByRole("button", { name: /Navigation side/ })).toContainText("Right");
await replacement.getByRole("button", { name: /Motion/ }).click();
await replacement.getByRole("option", { name: "Reduced motion", exact: true }).click();
await expect(pro.getByRole("button", { name: /Motion/ })).toContainText("Reduced motion");
for (const link of await page.locator("h2 a").all()) {
	const href = await link.getAttribute("href");
	expect(new URL(href).searchParams.get("side")).toBe("right");
	expect(new URL(href).searchParams.get("motion")).toBe("reduced");
	const full = await browser.newPage({ viewport: { width: 700, height: 1000 } });
	await full.goto(href);
	await full.getByRole("button", { name: "Open navigation" }).click();
	const visible = full.getByRole("dialog");
	await expect(visible).toBeVisible();
	const r = await visible.boundingBox();
	expect(Math.abs(r.x + r.width - 700)).toBeLessThan(1);
	await full.close();
}

expect(
	await pro
		.locator(".stepper__separator-fill")
		.first()
		.evaluate((element) => getComputedStyle(element).transitionDuration),
).toBe("0.3s");
for (const deviceMotion of ["reduce", "no-preference"]) {
	const follow = await browser.newPage({ viewport: { width: 1000, height: 1000 }, reducedMotion: deviceMotion });
	await follow.goto("http://localhost:4173/replacement.html?motion=system");
	await expect(follow.locator(".pb-steps")).toHaveAttribute("data-motion", deviceMotion === "reduce" ? "reduced" : "enabled");
	await follow.keyboard.press("Control+b");
	expect(await follow.locator(".pb-layout").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(deviceMotion === "reduce" ? "0s" : "0.2s");
	await follow.close();
}

expect(errors).toEqual([]);
await browser.close();
console.log("PASS keyboard filtering, exclusive overlays, right anchor, rail icons/tooltips, guards, chart contracts, contrast, empty fixtures and equivalent configuration.");
