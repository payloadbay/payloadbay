import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

const url = "http://localhost:4173";

const state = async () => (await fetch(`${url}/__revision`)).json();

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${url}/catalog.html?component=area-chart`);
await page.locator("h1").waitFor();
await page.waitForTimeout(1300);
const baseline = await state();
const file = new URL("./catalog.tsx", import.meta.url);
const original = await readFile(file, "utf8");
const broken = original + "\nconst __watch_failure_probe = ;\n";
await page.evaluate(() => {
	window.__watchProbe = true;
});
try {
	await writeFile(file, broken);
	await expect.poll(async () => Boolean((await state()).error), { timeout: 20000 }).toBe(true);
	expect((await state()).revision).toBe(baseline.revision);
	expect((await fetch(`${url}/catalog.html?component=area-chart`)).status).toBe(200);
	expect(await page.evaluate(() => window.__watchProbe)).toBe(true);
} finally {
	if ((await readFile(file, "utf8")) === broken) await writeFile(file, original);
}

await expect.poll(async () => (await state()).revision, { timeout: 30000 }).toBeGreaterThan(baseline.revision);
await expect.poll(async () => page.evaluate(() => Boolean(window.__watchProbe)), { timeout: 10000 }).toBe(false);
await expect(page.locator("h1")).toHaveText("Area Chart");
expect((await state()).error).toBe("");
await browser.close();
console.log("PASS failed rebuild retains working preview; restored source rebuilds and refreshes the same component.");
