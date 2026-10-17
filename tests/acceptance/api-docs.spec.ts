import { test, expect } from "../helpers/browser-test.ts";
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

test("K01 personal settings creates a show-once API key and revokes it", async ({ page, request }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.goto("/account");
	await page.getByRole("link", { name: "Manage personal API keys", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Personal API keys", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create API key", exact: true }).click();
	await page.getByLabel("Key name", { exact: true }).fill("Review automation");
	await page.getByText("metadata.read", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "metadata.read", exact: true })).toBeChecked();
	await page.getByRole("button", { name: "Create key", exact: true }).click();
	const secret = await page.getByRole("textbox", { name: "New API key", exact: true }).inputValue();
	expect(/^pb_[A-Za-z0-9_-]{43}$/.test(secret)).toBe(true);
	const response = await request.get("/api/v1/projects", { headers: { authorization: "Bearer " + secret } });
	expect(response.status()).toBe(200);
	await page.getByRole("button", { name: "I saved this key", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "New API key", exact: true })).toHaveCount(0);
	const row = page.getByRole("row").filter({ hasText: "Review automation" });
	await expect(row).toBeVisible();
	await row.getByRole("button", { name: "Revoke", exact: true }).click();
	await page.getByRole("dialog", { name: "Revoke API key" }).getByRole("button", { name: "Revoke key", exact: true }).click();
	await expect(row).toContainText("Revoked");
	expect((await request.get("/api/v1/projects", { headers: { authorization: "Bearer " + secret } })).status()).toBe(401);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("K02 organization settings creates a key limited to selected workspaces", async ({ page, request }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const organization = (await (await page.request.get("/api/v1/organizations")).json())[0];
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const hiddenResponse = await page.request.post("/api/v1/workspaces", { headers: commandHeaders(), data: { parentId: organization.id, name: "Excluded workspace", slug: "excluded-workspace" } });
	expect(hiddenResponse.status()).toBe(200);
	const hidden = await hiddenResponse.json();

	const createProject = async (parentId: string, name: string, slug: string) => {
		const result = await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId, name, slug } });
		expect(result.status()).toBe(200);

		return result.json();
	};

	const visible = await createProject(workspace.id, "Allowed integration", "allowed-integration");
	await createProject(hidden.id, "Excluded integration", "excluded-integration");
	await page.goto(`/organizations/${organization.id}`);
	await page.getByRole("row", { name: "API keys", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Organization API keys", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create API key", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Create API key", exact: true });
	await dialog.getByLabel("Key name", { exact: true }).fill("Workspace integration");
	await dialog.getByLabel("Workspace access", { exact: true }).selectOption("selected");
	await dialog.getByText(workspace.name, { exact: true }).click();
	await dialog.getByText("metadata.read", { exact: true }).click();
	await dialog.getByRole("button", { name: "Create key", exact: true }).click();
	const secret = await page.getByRole("textbox", { name: "New API key", exact: true }).inputValue();
	const headers = { authorization: "Bearer " + secret };
	const projects = await request.get("/api/v1/projects", { headers });
	expect(projects.status()).toBe(200);
	expect((await projects.json()).map((item: { id: string }) => item.id)).toEqual([visible.id]);
	expect(await (await request.get(`/api/v1/projects?workspaceId=${hidden.id}`, { headers })).json()).toEqual([]);
	await page.getByRole("button", { name: "I saved this key", exact: true }).click();
	await expect(page.getByRole("row").filter({ hasText: "Workspace integration" })).toContainText("1 selected workspace");
});
