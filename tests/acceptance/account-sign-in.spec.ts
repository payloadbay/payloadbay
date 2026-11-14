import { test, expect } from "../helpers/browser-test.ts";
import { resetBrowserData } from "../helpers/browser-data.ts";
import { ensureBrowserOwner } from "../helpers/browser-auth.ts";

test.beforeEach(resetBrowserData);

test("customers manage connected sign-in methods and restart authentication on desktop and mobile", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	let connected = true;
	let needsLogin = false;
	const connections: { provider: string; callbackURL: string }[] = [];
	await page.route("**/api/v1/onboarding", (route) => route.fulfill(unavailable ? { status: 503, json: { error: { message: "Temporarily unavailable" } } } : { json: { registrationEnabled: false, oauthProviders: ["google", "github"] } }));
	await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ json: connected ? [{ id: "synthetic-github-account", providerId: "github", accountId: "synthetic-subject" }] : [] }));
	await page.route("**/api/auth/link-social", async (route) => {
		connections.push(route.request().postDataJSON());
		await route.fulfill(needsLogin ? { status: 401, json: { message: "Sign in again before linking an identity provider" } } : { json: { url: "", redirect: false } });
	});
	await page.route("**/api/auth/unlink-account", async (route) => {
		expect(route.request().postDataJSON()).toEqual({ accountId: "synthetic-github-account" });
		connected = false;
		await route.fulfill({ json: { status: true } });
	});
	await page.goto("/account");
	await expect(page.getByRole("button", { name: "Retry loading sign-in methods", exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry loading sign-in methods", exact: true }).click();
	const table = page.getByRole("grid", { name: "Connected sign-in methods", exact: true });
	await expect(table).toBeVisible();
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 1000 });
		await expect(table.getByRole("row").filter({ hasText: "GitHub" })).toContainText("Connected");
		await expect(page.getByRole("button", { name: "Connect Google", exact: true })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.evaluate(() => window.scrollTo(0, 0));
		expect((await page.locator(".pb-layout-header").boundingBox())?.y).toBe(0);
		await page.screenshot({ path: test.info().outputPath(`connected-sign-in-${width}.png`), fullPage: true, animations: "disabled" });
	}

	await page.getByRole("button", { name: "Connect Google", exact: true }).click();
	await expect.poll(() => connections.length).toBe(1);
	expect(connections[0]).toEqual({ provider: "google", callbackURL: new URL("/account", page.url()).href });
	await page.getByRole("button", { name: "Disconnect GitHub", exact: true }).click();
	await expect(page.getByRole("button", { name: "Connect GitHub", exact: true })).toBeVisible();
	needsLogin = true;
	await page.getByRole("button", { name: "Connect Google", exact: true }).click();
	await expect(page.getByRole("button", { name: "Sign in again to connect Google", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Sign in again to connect Google", exact: true }).click();
	await expect(page).toHaveURL(/\/login\?returnTo=\/account$/);
	await expect(page.getByLabel("Email address")).toBeVisible();
});
