import { chooseOption } from "../helpers/select-option.ts";
import { test, expect } from "../helpers/browser-test.ts";
import { ensureBrowserOwner } from "../helpers/browser-auth.ts";
import { resetBrowserData } from "../helpers/browser-data.ts";

test.beforeEach(resetBrowserData);

test("UX41 organization creation preserves edits after a conflict and collection search follows the result", async ({ page }) => {
	await ensureBrowserOwner(page);
	await page.goto("/organizations");
	await page.getByRole("button", { name: "Create organization", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "New organization" });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel("Name", { exact: true }).fill("Cancelled organization");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Create organization", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New organization" });
	await dialog.getByLabel("Name", { exact: true }).fill("Review organization");
	await expect(dialog.getByLabel("Slug", { exact: true })).toHaveValue("review-organization");
	await dialog.getByLabel("Slug", { exact: true }).fill("review-company");
	await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const collection = page.getByRole("grid", { name: "Organizations", exact: true });
	await expect(collection.getByRole("row").filter({ hasText: "Review organization" })).toContainText("0");
	await page.getByRole("button", { name: "Create organization", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New organization" });
	await dialog.getByLabel("Name", { exact: true }).fill("Second organization");
	await dialog.getByLabel("Slug", { exact: true }).fill("review-company");
	await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Organization could not be created" })).toBeVisible();
	await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Second organization");
	await dialog.getByLabel("Slug", { exact: true }).fill("second-company");
	await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("textbox", { name: "Search organizations", exact: true }).fill("Second");
	await expect(collection.getByRole("link", { name: "Second organization", exact: true })).toBeVisible();
	await expect(collection.getByRole("link", { name: "Review organization", exact: true })).toHaveCount(0);
	await page.getByRole("textbox", { name: "Search organizations", exact: true }).clear();
	await expect(collection.getByRole("link", { name: "Review organization", exact: true })).toBeVisible();
});

test("UX42 notification settings recover an unavailable channel catalog without changing subscriptions", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/v1/notification-channels", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic channel outage" } }) });
		else await route.continue();
	});
	await page.goto("/account/notifications");
	await expect(page.getByRole("heading", { name: "Notification preferences unavailable" })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry loading preferences", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Choose what should notify you", exact: true })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Configure notification rules", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Retry loading preferences", exact: true })).toHaveCount(0);
});

test("UX43 job administration retries a transient snapshot failure using the actual authorized API", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/v1/jobs", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic queue snapshot outage" } }) });
		else await route.continue();
	});
	await page.goto("/admin/jobs");
	await expect(page.getByText("Job status is unavailable.", { exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Platform jobs", exact: true })).toBeVisible();
	await expect(page.getByText("Job status is unavailable.", { exact: true })).toHaveCount(0);
	await expect(page.getByText("Provider acknowledgement latency is not measured.", { exact: true })).toBeVisible();
});

test("UX44 installation health recovers after an outage and can be refreshed without exposing credentials", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/v1/installation/settings", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic installation outage" } }) });
		else await route.continue();
	});
	await page.goto("/admin/installation");
	await expect(page.getByText("Installation status is unavailable.", { exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Service health", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Service health", exact: true })).toBeVisible();
	await expect(page.locator("main")).not.toContainText(process.env.PAYLOADBAY_ENCRYPTION_KEY!);
});

test("UX45 audit inspection retries its first page and refreshes the real authorized history", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/v1/audit?*", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic audit outage" } }) });
		else await route.continue();
	});
	await page.goto("/admin/audit");
	await expect(page.getByText("Audit history is unavailable.", { exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Audit log", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Audit log", exact: true })).toBeVisible();
});

test("UX46 organization usage retries a failed window and switches its actual UTC query", async ({ page }) => {
	const { browserOrganization } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const id = await browserOrganization(page);
	let unavailable = true;
	await page.route("**/api/v1/organizations/" + id + "/usage?*", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic usage outage" } }) });
		else await route.continue();
	});
	await page.goto("/organizations/" + id + "/usage");
	await expect(page.getByText("Usage is unavailable.", { exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Try again", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Organization usage", exact: true })).toBeVisible();
	const changed = page.waitForResponse((response) => response.url().includes("/organizations/" + id + "/usage?") && response.ok());
	await chooseOption(page.getByRole("button", { name: new RegExp("Usage window") }), "168");
	const query = new URL((await changed).url()).searchParams;
	expect(new Date(query.get("to")!).getTime() - new Date(query.get("from")!).getTime()).toBe(168 * 3600000);
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Organization usage", exact: true })).toBeVisible();
});

test("UX47 passkey list recovery leaves normal passwordless account settings available", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/auth/passkey/list-user-passkeys", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "UNAVAILABLE", message: "Synthetic passkey catalog outage" }) });
		else await route.continue();
	});
	await page.goto("/account");
	await expect(page.getByText("Passkeys could not be loaded.", { exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry loading passkeys", exact: true }).click();
	await expect(page.getByText("No passkeys registered yet.", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Add passkey", exact: true })).toBeEnabled();
});

test("UX48 cancelling organization-scoped workspace creation leaves the collection unchanged", async ({ page }) => {
	const { browserOrganization } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const id = await browserOrganization(page);
	const before = await (await page.request.get("/api/v1/workspaces")).json();
	await page.goto("/organizations/" + id);
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "New workspace" });
	await dialog.getByLabel("Name", { exact: true }).fill("Cancelled workspace");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New workspace" });
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	const after = await (await page.request.get("/api/v1/workspaces")).json();
	expect(after.map((workspace: { id: string }) => workspace.id).sort()).toEqual(before.map((workspace: { id: string }) => workspace.id).sort());
});

test("UX49 hidden instance customization preserves current settings", async ({ page }) => {
	await ensureBrowserOwner(page);
	const before = await (await page.request.get("/api/v1/email-settings")).json();
	const response = await page.goto("/admin/email");
	expect(response?.status()).toBe(404);
	const after = await (await page.request.get("/api/v1/email-settings")).json();
	expect(after).toEqual(before);
});

test("UX50 resource collections create scoped projects and preserve their lists when creation is cancelled", async ({ page }) => {
	const { browserOrganization } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const organizationId = await browserOrganization(page);
	await page.goto("/workspaces");
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "New workspace", exact: true });
	await chooseOption(dialog.getByRole("button", { name: new RegExp("Organization") }), organizationId);
	await dialog.getByLabel("Name", { exact: true }).fill("Collection workspace");
	await expect(dialog.getByLabel("Slug", { exact: true })).toHaveValue("collection-workspace");
	await dialog.getByLabel("Slug", { exact: true }).fill("collection-review");
	await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const workspaces = await (await page.request.get("/api/v1/workspaces")).json();
	const workspace = workspaces.find((item: { name: string }) => item.name === "Collection workspace");
	expect(workspace.organization_id).toBe(organizationId);
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await page.goto("/projects");
	await page.getByRole("button", { name: "Create project", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New project", exact: true });
	await chooseOption(dialog.getByRole("button", { name: new RegExp("Project workspace") }), workspace.id);
	await dialog.getByLabel("Name", { exact: true }).fill("Collection project");
	await dialog.getByLabel("Slug", { exact: true }).fill("collection-project");
	await dialog.getByRole("button", { name: "Create project", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await chooseOption(page.getByRole("button", { name: new RegExp("Workspace") }), workspace.id);
	await page.getByRole("textbox", { name: "Search projects", exact: true }).fill("Collection project");
	await expect(page.getByRole("grid", { name: "Projects", exact: true }).getByRole("row").filter({ hasText: "Collection project" })).toBeVisible();
	await page.getByRole("button", { name: "Create project", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New project", exact: true });
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New workspace", exact: true });
	await chooseOption(dialog.getByRole("button", { name: new RegExp("Organization") }), organizationId);
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const projects = await (await page.request.get("/api/v1/projects")).json();
	const project = projects.find((item: { name: string }) => item.name === "Collection project");
	expect(project.workspace_id).toBe(workspace.id);
	await page.goto("/workspaces/" + workspace.id);
	await page.getByRole("button", { name: "Create project", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New project", exact: true });
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Create project", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await page.goto("/projects/" + project.id);
	await page.getByRole("button", { name: "Add destination", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "New destination", exact: true });
	await dialog.getByLabel("Name", { exact: true }).fill("Cancelled destination");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Add destination", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	expect(await (await page.request.get("/api/v1/projects/" + project.id + "/destinations")).json()).toEqual([]);
});

test("UX51 notification modules support catalog creation, keyboard publishing, pause and version activation", async ({ page }) => {
	await ensureBrowserOwner(page);
	await page.goto("/admin/notification-channels");
	const before = await (await page.request.get("/api/v1/notification-channels")).json();
	await page.getByRole("button", { name: "Create module", exact: true }).click();
	await page.getByLabel("Module name", { exact: true }).fill("Cancelled module");
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	expect(await (await page.request.get("/api/v1/notification-channels")).json()).toEqual(before);
	await page.getByRole("button", { name: "Create module", exact: true }).click();
	await page.getByLabel("Module name", { exact: true }).fill("Lifecycle email");
	await chooseOption(page.getByRole("button", { name: new RegExp("Transport") }), "webhook");
	await chooseOption(page.getByRole("button", { name: new RegExp("Transport") }), "email");
	await page.getByRole("button", { name: "Open editor", exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/notification-channels\/new\?/);
	const editor = page.getByRole("textbox", { name: "Notification module source", exact: true });
	const firstPublish = page.waitForResponse((response) => response.url().endsWith("/api/v1/notification-channels") && response.request().method() === "POST");
	await editor.focus();
	await page.keyboard.press("ControlOrMeta+s");
	expect((await firstPublish).status()).toBe(200);
	await expect(page).toHaveURL(/\/admin\/notification-channels\/[0-9a-f-]{36}$/);
	const channelId = new URL(page.url()).pathname.split("/").at(-1)!;
	let saved = await (await page.request.get("/api/v1/notification-channels/" + channelId)).json();
	expect(saved.name).toBe("Lifecycle email");
	expect(saved.activeVersion).toBe(1);
	const firstRevision = saved.activeRevisionId;
	await page.getByRole("button", { name: "Pause module", exact: true }).click();
	await expect(page.getByRole("button", { name: "Enable module", exact: true })).toBeVisible();
	expect((await (await page.request.get("/api/v1/notification-channels/" + channelId)).json()).enabled).toBe(false);
	await page.getByRole("button", { name: "Enable module", exact: true }).click();
	await expect(page.getByRole("button", { name: "Pause module", exact: true })).toBeVisible();
	await page.getByLabel("Module name", { exact: true }).fill("Lifecycle email updated");
	const secondPublish = page.waitForResponse((response) => response.url().endsWith("/api/v1/notification-channels") && response.request().method() === "POST");
	await editor.focus();
	await page.keyboard.press("ControlOrMeta+s");
	expect((await secondPublish).status()).toBe(200);
	await expect(page.getByRole("button", { name: /Module version/ })).toContainText("v2 / Active / Latest");
	await chooseOption(page.getByRole("button", { name: /Module version/ }), firstRevision);
	await expect(page.getByRole("button", { name: "Use selected version", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Use selected version", exact: true }).click();
	await expect(page.getByRole("button", { name: /Module version/ })).toContainText("v1 / Active");
	saved = await (await page.request.get("/api/v1/notification-channels/" + channelId)).json();
	expect(saved.activeRevisionId).toBe(firstRevision);
	expect(saved.revisions).toHaveLength(2);
	await page.getByRole("button", { name: "Send published test", exact: true }).click();
	await expect(page.getByRole("alertdialog").filter({ hasText: "Queued a real test" })).toBeVisible();
	await page.getByRole("navigation", { name: "Breadcrumbs", exact: true }).getByRole("link", { name: "Notification modules", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Notification modules", exact: true })).toContainText("Lifecycle email updated");
});

test("UX52 overview recovers a failed snapshot and exposes the hourly graph values on hover", async ({ page }) => {
	await ensureBrowserOwner(page);
	let unavailable = true;
	await page.route("**/api/v1/overview", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Synthetic traffic snapshot outage" } }) });
		else await route.continue();
	});
	await page.goto("/");
	await expect(page.getByRole("button", { name: "Retry loading overview", exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry loading overview", exact: true }).click();
	const graph = page.getByRole("img", { name: /^24-hour traffic:/ });
	await expect(graph).toBeVisible();
	await expect(page.getByRole("button", { name: "Retry loading overview", exact: true })).toHaveCount(0);
	await graph.hover({ position: { x: 120, y: 100 } });
	await expect(page.locator(".recharts-tooltip-wrapper")).toContainText("Ingress");
	await expect(page.locator(".recharts-tooltip-wrapper")).toContainText("Accepted");
});

test("UX53 route keyboard saves and publication rollback preserve already queued version pins", async ({ page }) => {
	const { browserOrganization, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	expect(workspace.organization_id).toBe(await browserOrganization(page));
	const projectResponse = await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Version controls", slug: "version-controls" } });
	expect(projectResponse.status()).toBe(200);
	const project = await projectResponse.json();
	const routeResponse = await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Versioned route", slug: "versioned" } });
	expect(routeResponse.status()).toBe(200);
	const route = await routeResponse.json();
	const ingressDraft = await page.request.patch("/api/v1/endpoints/" + route.id + "/drafts/ingress", { headers: { ...headers, "if-match": JSON.stringify("1") }, data: { body: 'export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"Accepted"}}); }' } });
	expect(ingressDraft.status()).toBe(200);
	const firstResponse = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 2, processing: 1 } } });
	expect(firstResponse.status()).toBe(200);
	const first = await firstResponse.json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.getByRole("button", { name: "Copy URL", exact: true }).click();
	const endpoint = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(endpoint.ingressUrl);
	await page.getByRole("link", { name: "Open scripts", exact: true }).click();
	await page.getByRole("tab", { name: "Processing", exact: true }).click();
	const editor = page.getByRole("textbox", { name: "Processing code", exact: true });
	await editor.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export default async function processEvent(ctx: ProcessingContext): Promise<ProcessingDecision> { ctx.log.info("Keyboard draft"); return ctx.complete(); }');
	const savedResponse = page.waitForResponse((response) => response.url().endsWith("/drafts/processing") && response.request().method() === "PATCH");
	await page.keyboard.press("ControlOrMeta+s");
	expect((await savedResponse).status()).toBe(200);
	const draft = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/processing")).json();
	expect(draft.version).toBe(2);
	expect(draft.body).toContain("Keyboard draft");
	const secondResponse = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: first.version, draftVersions: { ingress: 2, processing: 2 } } });
	expect(secondResponse.status()).toBe(200);
	const second = await secondResponse.json();
	expect((await page.request.post(endpoint.ingressUrl, { data: "queued version fixture" })).status()).toBe(202);
	await page.reload();
	await page.getByRole("link", { name: "Publications", exact: true }).click();
	const publications = page.getByRole("grid", { name: "Publication history", exact: true });
	await expect(publications.getByRole("row").filter({ hasText: "v2" })).toContainText("Active");
	const firstRow = publications.getByRole("row").filter({ hasText: "v1" });
	await expect(firstRow.getByRole("button", { name: "Delete publication v1", exact: true })).toBeDisabled();
	await expect(publications.getByRole("button", { name: "Archive publication v2", exact: true })).toBeDisabled();
	await firstRow.getByRole("button", { name: "Archive publication v1", exact: true }).click();
	await expect(firstRow).toContainText("Archived");
	await expect(firstRow.getByRole("button", { name: "Activate publication v1", exact: true })).toBeDisabled();
	await firstRow.getByRole("button", { name: "Restore publication v1", exact: true }).click();
	await expect(firstRow).not.toContainText("Archived");
	await firstRow.getByRole("button", { name: "Activate publication v1", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/endpoints/" + route.id)).json()).activePublicationId).toBe(first.id);
	const events = await (await page.request.get("/api/v1/projects/" + project.id + "/events")).json();
	expect(events.items).toHaveLength(1);
	const history = await (await page.request.get("/api/v1/events/" + events.items[0].id)).json();
	expect(history.publicationId).toBe(second.id);
	expect(history.executions[0].publication_id).toBe(second.id);
	expect(history.executions[0].state).toBe("queued");
});

test("UX64 mobile middleware handles reorder with touch and retain keyboard alternatives", async ({ page }) => {
	const { commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name: "Touch order", slug: "touch-order" } })).json();
	for (const [position, name] of ["First policy", "Second policy"].entries()) {
		const result = await page.request.post("/api/v1/middleware", {
			headers: commandHeaders(),
			data: {
				scope: { type: "project", id: project.id },
				stage: "ingress",
				name,
				body: "return ctx.continue();",
				position,
				failurePolicy: "required",
				overridePolicy: "allowed",
			},
		});
		expect(result.status()).toBe(200);
	}

	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
	await cdp.send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", platform: "Linux armv8l" });
	await page.goto("/code/project/" + project.id + "?section=middleware");
	await page.getByRole("tab", { name: "Middleware", exact: true }).click();
	const handle = page.getByRole("button", { name: "Drag Second policy", exact: true });
	await handle.scrollIntoViewIfNeeded();
	const source = await handle.boundingBox();
	const target = await page.getByRole("button", { name: "Drag First policy", exact: true }).boundingBox();
	expect(source).toBeTruthy();
	expect(target).toBeTruthy();

	const x = source!.x + source!.width / 2;
	const start = source!.y + source!.height / 2;
	const end = target!.y + 3;

	const order = async () => (await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json()).map((item: { name: string }) => item.name);

	await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start }] });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: end }] });
	await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
	await expect.poll(order).toEqual(["First policy", "Second policy"]);

	await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start }] });
	await page.waitForTimeout(900);
	for (let step = 1; step <= 12; step++) {
		await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: start + ((end - start) * step) / 12 }] });
		await page.waitForTimeout(40);
	}

	await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

	await expect.poll(order).toEqual(["Second policy", "First policy"]);
	await page.getByRole("button", { name: "Move First policy up", exact: true }).click();
	await expect.poll(order).toEqual(["First policy", "Second policy"]);
	await page.screenshot({ path: test.info().outputPath("middleware-touch-order-mobile.png") });
	await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
	await page.setViewportSize({ width: 1440, height: 1000 });
	const mouseSource = await handle.boundingBox();
	const mouseTarget = await page.getByRole("button", { name: "Drag First policy", exact: true }).boundingBox();
	await page.mouse.move(mouseSource!.x + mouseSource!.width / 2, mouseSource!.y + mouseSource!.height / 2);
	await page.mouse.down();
	await page.mouse.move(mouseTarget!.x + mouseTarget!.width / 2, mouseTarget!.y + 3, { steps: 12 });
	await page.mouse.up();
	await expect.poll(order).toEqual(["Second policy", "First policy"]);
	await page.screenshot({ path: test.info().outputPath("middleware-handle-order-desktop.png") });

	await cdp.detach();
});

test("UX65 secret rotation pins stages independently and cancelled forms discard plaintext", async ({ page }) => {
	const { commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name: "Secret rotation", slug: "secret-rotation" } })).json();
	const endpoint = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers: commandHeaders(), data: { name: "Rotation route", slug: "rotation-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + endpoint.id + "?section=secrets");
	const create = page.getByRole("dialog", { name: "Create secret version", exact: true });
	for (const dismiss of ["cancel", "escape"]) {
		await page.getByRole("button", { name: "Create secret version", exact: true }).click();
		await expect(create.getByLabel("Secret value", { exact: true })).toHaveValue("");
		await create.getByLabel("Secret key", { exact: true }).fill("DISCARDED_KEY");
		await create.getByLabel("Secret value", { exact: true }).fill("discarded-synthetic-value");
		if (dismiss === "cancel") await create.getByRole("button", { name: "Cancel", exact: true }).click();
		else await page.keyboard.press("Escape");
		await expect(create).toHaveCount(0);
	}

	const environment = page.getByRole("dialog", { name: "Import environment secrets", exact: true });
	for (const dismiss of ["cancel", "escape"]) {
		await page.getByRole("button", { name: "Import .env", exact: true }).click();
		await expect(environment.getByLabel("Environment text", { exact: true })).toHaveValue("");
		await environment.getByLabel("Environment text", { exact: true }).fill("DISCARDED_KEY=discarded-synthetic-value");
		await environment.getByRole("checkbox", { name: "Processing", exact: true }).press("Space");
		if (dismiss === "cancel") await environment.getByRole("button", { name: "Cancel", exact: true }).click();
		else await page.keyboard.press("Escape");
		await expect(environment).toHaveCount(0);
	}

	expect(await (await page.request.get("/api/v1/secrets?scopeType=project&scopeId=" + project.id)).json()).toEqual([]);
	for (const [index, excluded] of ["Processing", "Ingress"].entries()) {
		await page.getByRole("button", { name: "Create secret version", exact: true }).click();
		await expect(create.getByLabel("Secret key", { exact: true })).toHaveValue("");
		await expect(create.getByLabel("Secret value", { exact: true })).toHaveValue("");
		await create.getByLabel("Secret key", { exact: true }).fill("SHARED_KEY");
		await create.getByLabel("Secret value", { exact: true }).fill("synthetic-version-" + (index + 1));
		await create.getByRole("checkbox", { name: excluded, exact: true }).press("Space");
		await create.getByRole("button", { name: "Create secret version", exact: true }).click();
		await expect(create).toHaveCount(0);
		await page.getByRole("alertdialog", { name: "Secret status", exact: true }).getByRole("button", { name: "Close", exact: true }).press("Enter");
	}

	const versions = await (await page.request.get("/api/v1/secrets?scopeType=project&scopeId=" + project.id)).json();
	expect(versions).toHaveLength(2);
	expect(JSON.stringify(versions)).not.toContain("synthetic-version-");
	const first = versions.find((item: { version: number }) => item.version === 1);
	const second = versions.find((item: { version: number }) => item.version === 2);
	await page.getByRole("button", { name: "Bind secret version", exact: true }).click();
	const bind = page.getByRole("dialog", { name: "Bind a secret", exact: true });
	await bind.getByLabel("Script key", { exact: true }).fill("LEGACY_KEY");
	await chooseOption(bind.getByRole("button", { name: new RegExp("Secret version") }), first.id);
	const ingress = bind.getByRole("checkbox", { name: "Ingress", exact: true });
	await expect(ingress).not.toBeChecked();
	await ingress.press("Space");
	await ingress.press("Space");
	await bind.getByRole("button", { name: "Bind secret version", exact: true }).click();
	await expect(bind).toHaveCount(0);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
	const inDraft = await (await page.request.get("/api/v1/endpoints/" + endpoint.id + "/drafts/ingress")).json();
	const outDraft = await (await page.request.get("/api/v1/endpoints/" + endpoint.id + "/drafts/processing")).json();
	expect(inDraft.secret_bindings).toEqual({ SHARED_KEY: first.id });
	expect(outDraft.secret_bindings).toEqual({ SHARED_KEY: second.id, LEGACY_KEY: first.id });
});

test("UX77 OAuth providers are edited in the dashboard while SMTP stays deployment-only", async ({ page }) => {
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto("/admin/installation");
	await page.getByRole("button", { name: "Add provider", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "OAuth sign-in provider", exact: true });
	await dialog.getByRole("button", { name: "OAuth provider" }).click();
	await page.getByRole("option", { name: "Discord", exact: true }).click();
	await expect(dialog.getByRole("button", { name: "OAuth provider" })).toContainText("Discord");
	await dialog.getByRole("button", { name: "OAuth provider" }).click();
	await page.getByRole("option", { name: "Amazon Cognito", exact: true }).click();
	await expect(dialog.getByLabel("User pool ID", { exact: true })).toBeVisible();
	await dialog.getByLabel("Cognito domain", { exact: true }).fill("fixture.auth.us-east-1.amazoncognito.com");
	await dialog.getByRole("button", { name: "OAuth provider" }).click();
	await page.getByRole("option", { name: "Microsoft", exact: true }).click();
	await dialog.getByLabel("Tenant ID", { exact: true }).fill("organizations");
	await dialog.getByRole("button", { name: "OAuth provider" }).click();
	await page.getByRole("option", { name: "PayPal", exact: true }).click();
	await dialog.getByRole("button", { name: "Provider environment" }).click();
	await page.getByRole("option", { name: "live", exact: true }).click();
	await dialog.getByRole("button", { name: "OAuth provider" }).click();
	await page.getByRole("option", { name: "Google", exact: true }).click();
	await dialog.getByLabel("Client ID", { exact: true }).fill("synthetic-review-client");
	await dialog.getByLabel("Client secret", { exact: true }).fill("synthetic-review-secret");
	await dialog.getByRole("button", { name: "Save provider", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole("grid", { name: "OAuth sign-in providers" })).toContainText("synthetic-review-client");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.evaluate(() => window.scrollTo(0, 700));
	const chrome = page.locator(".dashboard-app-layout > .pb-layout-header");
	await expect(chrome).toBeInViewport();
	const background = await chrome.locator(":scope > div").evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(background).not.toBe("rgba(0, 0, 0, 0)");
	expect(background).not.toMatch(/\/\s*0?\.\d+\)/);
	await page.screenshot({ path: "/tmp/pab-mobile-review-header.png", animations: "disabled" });
	const settings = await (await page.request.get("/api/v1/installation/settings")).json();
	expect(JSON.stringify(settings)).not.toContain("synthetic-review-secret");
	expect(settings.configuration.settings.oauth.google.secretConfigured).toBe(true);
	expect(settings.configuration.settings.smtp).toBeUndefined();
	expect((await (await page.request.get("/api/v1/onboarding")).json()).oauthProviders).toEqual(["google"]);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole("button", { name: "Edit google", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "OAuth sign-in provider", exact: true });
	await expect(dialog.getByLabel("Client secret", { exact: true })).toHaveValue("");
	await expect(dialog).toBeInViewport();
	await page.screenshot({ path: "/tmp/pab-audit-oauth-mobile.png", animations: "disabled" });
	await dialog.getByRole("button", { name: "Save provider", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Remove google", exact: true }).click();
	await page.getByRole("dialog", { name: "Remove sign-in provider?" }).getByRole("button", { name: "Remove provider", exact: true }).click();
	await expect(page.getByText("No OAuth sign-in providers configured.", { exact: true })).toBeVisible();
});

test("UX79 organization owner can require passkeys after enrolling their device", async ({ page, context }) => {
	const { commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const client = await context.newCDPSession(page);
	await client.send("WebAuthn.enable");
	await client.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	});
	await page.goto("/account");
	await page.getByLabel("Passkey name", { exact: true }).fill("Organization device");
	await page.getByRole("button", { name: "Add passkey", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Your passkeys" })).toContainText("Organization device");
	const organization = (await (await page.request.get("/api/v1/organizations")).json())[0];
	await page.setViewportSize({ width: 390, height: 844 });

	let unavailable = true;
	await page.route("**/api/v1/organizations/" + organization.id + "/security", (route) => (unavailable && route.request().method() === "GET" ? route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Synthetic settings outage" } } }) : route.continue()));
	await page.goto("/organizations/" + organization.id + "/security");
	await expect(page.getByRole("button", { name: "Retry security settings", exact: true })).toBeVisible();
	unavailable = false;
	await page.getByRole("button", { name: "Retry security settings", exact: true }).click();
	const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumbs", exact: true });
	await expect(breadcrumbs.getByRole("link", { name: organization.name, exact: true })).toHaveAttribute("href", "/organizations/" + organization.id);
	await expect(breadcrumbs.getByText("Security", { exact: true })).toBeVisible();

	const switchBox = await page.locator('[data-slot="switch-control"]').boundingBox();
	const labelBox = await page.getByText("Require a registered passkey", { exact: true }).boundingBox();
	expect(switchBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
	expect(Math.abs(switchBox!.y + switchBox!.height / 2 - (labelBox!.y + labelBox!.height / 2))).toBeLessThan(3);
	await page.getByText("Require a registered passkey", { exact: true }).click();
	await page.getByRole("button", { name: "Save security policy", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save security policy", exact: true })).toBeDisabled();
	const saved = await (await page.request.get("/api/v1/organizations/" + organization.id + "/security")).json();
	expect(saved.requirePasskey).toBe(true);
	await page.screenshot({ path: "/tmp/pab-audit-passkey-mobile.png", fullPage: true, animations: "disabled" });
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.screenshot({ path: "/tmp/pab-mobile-review-passkey-desktop.png", animations: "disabled" });
	await page.setViewportSize({ width: 390, height: 844 });
	const keys = await (await page.request.get("/api/auth/passkey/list-user-passkeys")).json();
	const removed = await page.request.post("/api/auth/passkey/delete-passkey", { headers: commandHeaders(), data: { id: keys[0].id } });
	expect(removed.status()).toBe(400);
	expect((await removed.json()).message).toContain("requires at least one registered passkey");
	const still = await (await page.request.get("/api/auth/passkey/list-user-passkeys")).json();
	expect(still).toHaveLength(1);
	await page.getByText("Require a registered passkey", { exact: true }).click();
	await page.getByRole("button", { name: "Save security policy", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save security policy", exact: true })).toBeDisabled();
});

test("UX85 installation editing persists policy, changes public onboarding and confirms retention", async ({ page }) => {
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/admin/installation");
	await page.getByRole("button", { name: "Edit settings", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "Edit installation settings", exact: true });
	await dialog.getByRole("button", { name: /Registration policy/ }).click();
	await page.getByRole("option", { name: "Organization onboarding", exact: true }).click();
	await dialog.getByRole("textbox", { name: "Incoming body limit (bytes)" }).fill("512");
	await dialog.getByRole("textbox", { name: "Default delivery attempts" }).fill("2");
	await dialog.getByRole("textbox", { name: "Keep completed events (days)" }).fill("30");
	await page.screenshot({ path: "/tmp/pab-settings-mobile-edit.png", animations: "disabled" });
	await dialog.getByRole("button", { name: "Save settings", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "Delete old event history?", exact: true });
	await expect(dialog).toContainText("permanently deleted");
	await dialog.getByRole("button", { name: "Back to settings", exact: true }).click();
	await page.getByRole("dialog", { name: "Edit installation settings", exact: true }).getByRole("button", { name: "Save settings", exact: true }).click();
	await page.getByRole("dialog", { name: "Delete old event history?", exact: true }).getByRole("button", { name: "Confirm retention and save", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Delete old event history?", exact: true })).toHaveCount(0);
	const saved = await (await page.request.get("/api/v1/installation/settings")).json();
	expect(saved.configuration.settings.bodyLimit).toBe(512);
	expect(saved.configuration.settings.maxAttempts).toBe(2);
	expect((await (await page.request.get("/api/v1/onboarding")).json()).registrationEnabled).toBe(true);
	const { commandHeaders } = await import("../helpers/browser-auth.ts");
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Live settings", slug: "live-settings" } })).json();
	const endpoint = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Bounded route", slug: "bounded-route" } })).json();
	expect(endpoint.ingress_key).toBeTruthy();
	const oversized = await page.request.post("/ingress/" + endpoint.ingress_key, { data: "x".repeat(600) });
	expect(oversized.status()).toBe(413);

	await page.reload();
	await page.getByRole("button", { name: "Edit settings", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "Edit installation settings", exact: true });
	await expect(dialog.getByRole("textbox", { name: "Incoming body limit (bytes)" })).toHaveValue("512");
	await expect(dialog.getByText("SMTP", { exact: true })).toHaveCount(0);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.screenshot({ path: "/tmp/pab-settings-desktop-edit.png", animations: "disabled" });
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
