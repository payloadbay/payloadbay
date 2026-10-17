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
	await expect(page.getByText("No failure rules are configured for your accessible projects.", { exact: false })).toBeVisible();
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
	await page.getByLabel("Usage window", { exact: true }).selectOption("168");
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

test("UX49 email draft previews use edited presentation while reset cancellation preserves saved settings", async ({ page }) => {
	await ensureBrowserOwner(page);
	const before = await (await page.request.get("/api/v1/email-settings")).json();
	await page.goto("/admin/email");
	await page.getByLabel("Brand name", { exact: true }).fill("Draft review team");
	await page.getByLabel("Accent color", { exact: true }).fill("#123456");
	await page.getByLabel("Logo URL", { exact: true }).fill(new URL("/brand/payloadbay-email-logo.png", page.url()).href);
	await page.getByLabel("Footer", { exact: true }).fill("Synthetic draft preview");
	await page.getByLabel("Sample email", { exact: true }).selectOption("invitation");
	await page.getByRole("button", { name: "Preview email", exact: true }).click();
	const preview = page.frameLocator("iframe[title='Branded email preview']");
	await expect(preview.getByRole("img", { name: "Draft review team", exact: true })).toHaveAttribute("src", new URL("/brand/payloadbay-email-logo.png", page.url()).href);
	await expect(preview.locator("body")).toContainText("Synthetic draft preview");
	await page.getByRole("button", { name: "Reset to shipped defaults", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Reset email settings?" });
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue("Draft review team");
	const after = await (await page.request.get("/api/v1/email-settings")).json();
	expect(after).toEqual(before);
});
