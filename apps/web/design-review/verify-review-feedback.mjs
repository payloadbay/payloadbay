import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const failures = [];
const evidence = [];

async function check(name, run) {
	try {
		await run();
		console.log("PASS", name);
	} catch (error) {
		failures.push({ name, error: error.message });
		console.log("FAIL", name, error.message.slice(0, 250));
	}
}

async function styles(locator, properties) {
	return locator.evaluate((node, keys) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(node)[key]])), properties);
}

async function variant(page, component, name) {
	await page.getByRole("button", { name: new RegExp(`${component} example`) }).click();
	await page.getByRole("option", { name, exact: true }).click();
}

try {
	for (const width of [390, 1024]) {
		const pages = await Promise.all(
			[true, false].map(async (reference) => {
				const page = await browser.newPage({ viewport: { width, height: 1000 } });
				page.setDefaultTimeout(5000);
				await page.clock.setFixedTime(new Date("2026-10-20T10:00:00Z"));

				return { page, reference, side: reference ? "catalog-pro" : "catalog" };
			}),
		);

		async function visit(id) {
			for (const { page, side } of pages) await page.goto(`http://localhost:4173/${side}.html?component=${id}`);
		}

		async function compare(id, selector, properties, hover = false) {
			await visit(id);
			const results = [];
			for (const { page, reference } of pages) {
				const target = page.locator(selector(reference)).first();
				if (hover) await target.hover();
				await page.waitForTimeout(200);
				results.push(await styles(target, properties));
			}

			evidence.push({ width, id, results });
			expect(results[1]).toEqual(results[0]);
		}

		await check(`${width} radar web theme`, () => compare("radar-chart", () => ".recharts-polar-grid-concentric-polygon", ["stroke", "strokeOpacity"]));
		await check(`${width} list row hover`, () => compare("list-view", (r) => (r ? "[data-slot=list-view-item]" : ".pb-list-view-item"), ["backgroundColor"], true));
		await check(`${width} stepper surface`, () => compare("number-stepper", (r) => (r ? "[data-slot=number-stepper-group]" : ".pb-number-stepper"), ["backgroundColor", "padding", "borderWidth"]));
		await check(`${width} resize line`, async () => {
			await compare("resizable", (r) => (r ? "[data-slot=resizable-handle]" : ".pb-resize-handle"), ["width", "backgroundColor"]);
			const local = pages[1].page;
			const handle = local.getByRole("separator", { name: "Resize panels" });
			const previous = await handle.getAttribute("aria-valuenow");
			await handle.focus();
			await local.keyboard.press("ArrowRight");
			await expect(handle).not.toHaveAttribute("aria-valuenow", previous);
			const expected = await pages[0].page.locator("[data-slot=resizable-handle]").evaluate((node) => {
				const probe = document.createElement("span");
				probe.style.background = "var(--resizable-handle-color-hover)";
				node.append(probe);
				const color = getComputedStyle(probe).backgroundColor;
				probe.remove();

				return color;
			});
			await handle.hover();
			await expect.poll(() => handle.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(expected);
		});
		await check(`${width} clear label`, async () => {
			await visit("action-bar");
			for (const { page } of pages) await expect(page.getByRole("button", { name: /Clear/ })).toHaveText("Clear");
		});
		await check(`${width} thumbnail squares`, async () => {
			await visit("carousel");
			for (const { page, reference } of pages) {
				await variant(page, "Carousel", "Thumbnails");
				const button = page.locator(reference ? "[data-slot=carousel-thumbnail]" : ".pb-carousel-thumbnails > button").first();
				const box = await button.boundingBox();
				expect(box.width).toBeCloseTo(box.height, 0);
				const viewport = await page.locator(reference ? "[data-slot=carousel-viewport]" : ".pb-carousel-viewport").boundingBox();
				const next = await page.getByRole("button", { name: "Next slide", exact: true }).boundingBox();
				expect(Math.abs(next.y + next.height / 2 - viewport.y - viewport.height / 2)).toBeLessThanOrEqual(1);
				await button.click();
			}
		});
		await check(`${width} centered milestone border`, async () => {
			await visit("timeline");
			const results = [];
			for (const { page, reference } of pages) {
				await variant(page, "Timeline", "Centered Milestones");
				results.push(await styles(page.locator(reference ? "[data-slot=timeline-marker]" : ".pb-timeline-marker").first(), ["borderWidth", "borderColor"]));
			}

			expect(results[1]).toEqual(results[0]);
		});
		await check(`${width} select value and arrow alignment`, async () => {
			await visit("cell-select");
			for (const { page, reference } of pages) {
				const value = page.locator(reference ? "[data-slot=cell-select-value]" : ".pb-cell .select__value");
				const indicator = page.locator(reference ? ".cell-select [data-slot=select-indicator]" : ".pb-cell .select__indicator");
				const a = await value.boundingBox();
				const b = await indicator.boundingBox();
				expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(1);
			}
		});
		await check(`${width} inline select fills its row`, async () => {
			await visit("inline-select");
			const boxes = [];
			for (const { page, reference } of pages) {
				boxes.push(await page.locator(reference ? "[data-slot=inline-select-trigger]" : ".pb-inline-select").boundingBox());
			}

			expect(boxes[1].width).toBeCloseTo(boxes[0].width, 0);
		});
		await check(`${width} TOC opens only at bars`, async () => {
			await visit("floating-toc");
			for (const { page } of pages) {
				const trigger = page.getByRole("button", { name: "Table of contents" });
				const box = await trigger.boundingBox();
				expect(box.width).toBeLessThanOrEqual(40);
				await page.mouse.move(box.x - 50, box.y + box.height / 2);
				await page.waitForTimeout(350);
				await expect(page.getByText("API reference", { exact: true })).toHaveCount(1);
				await trigger.hover();
				await expect(page.getByText("API reference", { exact: true })).toHaveCount(2);
			}
		});
		await check(`${width} emoji dimensions, inline tone and joined glyph`, async () => {
			await visit("emoji-picker");
			const sizes = [];
			for (const { page, reference, side } of pages) {
				await page.getByRole("button", { name: "Choose emoji" }).click();
				const popup = page.locator(reference ? "[data-slot=emoji-picker-popover]" : ".pb-emoji-popover");
				await page.waitForTimeout(250);
				const box = await popup.boundingBox();
				sizes.push([box.width, box.height]);
				const triggerBox = await page.getByRole("button", { name: "Choose emoji" }).evaluate((node) => ({ width: node.offsetWidth, height: node.offsetHeight }));
				expect(triggerBox.width).toBeLessThanOrEqual(24);
				expect(triggerBox.height).toBe(24);
				const search = page.getByRole("searchbox", { name: "Search emoji" });
				const tone = page.locator(reference ? "[data-slot=emoji-picker-skin-tone-picker]" : ".pb-emoji-tone");
				const a = await search.boundingBox();
				const b = await tone.boundingBox();
				expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(2);
				const group = await page.locator(".search-field__group").boundingBox();
				expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
				expect(b.x + b.width).toBeLessThanOrEqual(group.x + group.width);

				await tone.click();
				const tones = page.getByRole("dialog", { name: "Skin tone", exact: true });
				await expect(tones).toBeVisible();
				await tones.getByRole(reference ? "button" : "radio", { name: reference ? "Medium-Dark" : "Medium dark skin tone", exact: true }).click();
				await expect(tones).toHaveCount(0);
				await expect(popup).toBeVisible();
				await expect(tone).toContainText("✋🏾");
				await search.fill("family: man, woman, girl, boy");
				const family = page.getByRole("option").filter({ hasText: "👨‍👩‍👧‍👦" }).first();
				await expect(family).toBeVisible();
				const fits = await family.evaluate((node) => {
					const range = document.createRange();
					range.selectNodeContents(node);

					return range.getBoundingClientRect().width <= node.getBoundingClientRect().width;
				});
				expect(fits).toBe(true);
				await page.screenshot({ path: `/tmp/pab-feedback-${side}-emoji-${width}.png` });
			}

			expect(sizes[1]).toEqual(sizes[0]);
		});
		await check(`${width} navbar has a functioning menu toggle`, async () => {
			await visit("navbar");
			for (const { page, reference } of pages) {
				const toggle = page.locator(reference ? "[data-slot=navbar-menu-toggle]" : ".pb-navbar-toggle");
				await expect(toggle).toBeVisible();
				await toggle.click();
				const link = page.getByRole("link", { name: "Projects", exact: true }).last();
				await expect(link).toBeVisible();
				if (reference) await toggle.click();
				else {
					const box = await page.getByRole("navigation", { name: "Mobile navigation" }).boundingBox();
					expect(box.y + box.height).toBeLessThanOrEqual(1001);
					await link.focus();
					await page.keyboard.press("Escape");
					await expect(toggle).toHaveAttribute("aria-expanded", "false");
				}
			}
		});
		await check(`${width} agenda weekday headings fit their columns`, async () => {
			await visit("agenda");
			for (const { page, reference } of pages) {
				const headers = page.locator(reference ? "[data-slot=agenda-day-header]" : ".pb-agenda-day-heading");
				await expect(headers).toHaveCount(7);
				for (const header of await headers.all()) {
					const fits = await header.evaluate((node) => {
						const box = node.getBoundingClientRect();

						return [...node.children].every((child) => {
							const rect = child.getBoundingClientRect();

							return rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
						});
					});
					expect(fits).toBe(true);
				}
			}
		});
		await check(`${width} agenda drag creates selected duration`, async () => {
			await visit("agenda");
			for (const { page, reference, side } of pages) {
				await variant(page, "Agenda", "Day");
				await page.waitForTimeout(200);
				const day = page.locator(reference ? "[data-slot=agenda-day-column]" : ".pb-agenda-day");
				const body = page.locator(reference ? "[data-slot=agenda-time-grid]" : ".pb-agenda-scroll");
				const grid = await body.boundingBox();
				const column = await day.boundingBox();
				const header = page.locator(reference ? "[data-slot=agenda-week-header]" : ".pb-agenda-day-headers");
				const beforeHeader = await header.boundingBox();
				const originalScroll = await body.evaluate((node) => node.scrollTop);
				await body.evaluate((node) => {
					node.scrollTop += 60;
				});
				expect((await header.boundingBox()).y).toBe(beforeHeader.y);
				await body.evaluate((node, top) => {
					node.scrollTop = top;
				}, originalScroll);
				expect(await day.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
				const x = column.x + column.width * 0.75;
				const hourHeight = await day.evaluate((node) => node.clientHeight / 24);
				expect(hourHeight).toBe(width <= 640 ? 48 : 60);
				const y = grid.y + hourHeight * 2 + hourHeight / 12;
				await page.mouse.move(x, y);
				await page.mouse.down();
				await page.mouse.move(x, y + hourHeight, { steps: 8 });
				const preview = page.locator(reference ? ".agenda__create-preview" : ".pb-agenda-create-preview");
				// The installed Pro hides the preview on small screens, but the gesture still creates.
				if (width > 640 || !reference) {
					await expect(preview).toBeVisible();
					expect(await styles(preview, ["borderStyle"])).toEqual({ borderStyle: "dashed" });
				}

				await page.mouse.up();
				const created = page.locator(reference ? "[data-slot=agenda-event]" : ".pb-agenda-event").filter({ hasText: "New event" });
				await expect(created).toHaveCount(1);
				await expect.poll(async () => Math.round((await created.boundingBox()).height)).toBe(hourHeight);
				expect(await body.evaluate((node) => getComputedStyle(node).scrollbarWidth)).toBe("none");
				await page.mouse.move(x, y + hourHeight * 3);
				await page.mouse.down();
				await page.mouse.move(x, y + hourHeight * 2, { steps: 8 });
				if (width > 640 || !reference) await expect.poll(async () => preview.evaluate((node) => Math.round(parseFloat(getComputedStyle(node).height)))).toBe(hourHeight);
				await page.mouse.up();
				await expect(created).toHaveCount(2);
				await page.mouse.move(x, y + hourHeight * 4);
				await page.mouse.down();
				await page.waitForTimeout(30);
				await page.mouse.up();
				await expect(created).toHaveCount(3);
				for (const event of await created.all()) expect(Math.round((await event.boundingBox()).height)).toBe(hourHeight);
				if (!reference) {
					await page.mouse.move(x, y + hourHeight * 3.5);
					await page.mouse.down();
					await page.mouse.move(x, y + hourHeight * 3.75, { steps: 5 });
					await page.keyboard.press("Escape");
					await page.mouse.up();
					await expect(created).toHaveCount(3);
				}

				await page.screenshot({ path: `/tmp/pab-feedback-${side}-agenda-${width}.png` });
			}
		});
		for (const { page } of pages) await page.close();
	}

	await writeFile("/tmp/pab-review-feedback-evidence.json", JSON.stringify({ evidence, failures }, null, 2));
	expect(failures).toEqual([]);
} finally {
	await browser.close();
}
