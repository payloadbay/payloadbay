import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { resetBrowserData } from "../helpers/browser-data.ts";

test.beforeEach(resetBrowserData);

test("U156a API reference renders using installation-local assets and specification", async ({ page, baseURL }) => {
	const remote: string[] = [];
	const origin = new URL(baseURL!).origin;
	page.on("request", (request) => {
		if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) remote.push(new URL(request.url()).origin);
	});
	const specification = page.waitForResponse((response) => response.url().endsWith("/api/openapi.json"));
	const response = await page.goto("/docs/api");
	expect(response?.status()).toBe(200);
	await expect(page.getByRole("heading", { name: "Payload Bay API", exact: true })).toBeVisible();
	expect((await specification).status()).toBe(200);
	expect(remote).toEqual([]);
	const controls = await page.locator("body").ariaSnapshot();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByRole("heading", { name: "Payload Bay API", exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: test.info().outputPath("api-reference-mobile.png"), animations: "disabled" });
	await writeFile(test.info().outputPath("api-reference-controls.txt"), controls);
});

test("U156b Scalar sends real scoped Bearer requests and rejects the same token after revocation", async ({ page, browser, baseURL }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];

	const create = async (name: string, slug: string) => {
		const response = await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name, slug } });
		expect(response.status()).toBe(200);

		return response.json();
	};

	const visible = await create("API token project", "api-token-project");
	await create("Hidden from API token", "hidden-from-api-token");
	const created = await page.request.post("/api/v1/tokens", {
		headers: commandHeaders(),
		data: {
			scope: { type: "project", id: visible.id },
			name: "Synthetic docs review",
			permissions: ["metadata.read"],
			expiresAt: new Date(Date.now() + 86400000).toISOString(),
		},
	});
	expect(created.status()).toBe(200);
	const credential = await created.json();
	expect(typeof credential.secret === "string").toBe(true);
	const owner = await browser.newContext({ baseURL, storageState: await page.context().storageState() });
	await page.context().clearCookies();
	try {
		await page.goto("/docs/api");
		await page.getByRole("textbox", { name: "Bearer Token", exact: true }).fill(credential.secret);
		await page.getByRole("complementary", { name: "Sidebar for Payload Bay API" }).getByRole("link", { name: "Projects", exact: true }).click();
		await page.getByRole("complementary", { name: "Sidebar for Payload Bay API" }).getByRole("link", { name: "GET /projects HTTP Method: GET", exact: true }).click();
		await page.getByRole("button", { name: "Test Request (get /api/v1/projects)", exact: true }).click();

		const send = async () => {
			const [response] = await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/projects" && response.request().method() === "GET"), page.getByRole("button", { name: /^Send get request to / }).click()]);

			return response;
		};

		const result = await send();
		expect(result.status()).toBe(200);
		expect(result.request().headers().authorization === "Bearer " + credential.secret).toBe(true);
		expect((await result.json()).map((project: { name: string }) => project.name)).toEqual(["API token project"]);
		expect(await page.evaluate((secret) => Object.values(localStorage).some((value) => value.includes(secret)), credential.secret)).toBe(false);
		const revoked = await owner.request.delete("/api/v1/tokens", { headers: commandHeaders(), data: { scope: { type: "project", id: visible.id }, id: credential.id } });
		expect(revoked.status()).toBe(204);
		expect((await send()).status()).toBe(401);
	} finally {
		await owner.close();
	}
});

test("U156c mobile account help opens the local reference and returns to the signed-in overview", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name: "Docs navigation", slug: "docs-navigation" } });
	expect(project.status()).toBe(200);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.getByRole("button", { name: "Account menu", exact: true }).click();
	const menu = page.getByRole("menu", { name: "Account menu", exact: true });
	await expect(menu).toBeVisible();
	await expect(menu.getByRole("menuitem", { name: "API documentation", exact: true })).toHaveCount(1);
	await menu.getByRole("menuitem", { name: "API documentation", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Payload Bay API", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Back to Payload Bay", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Projects", exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
