import { test, expect } from "@playwright/test";

test("signed-out application root opens sign-in instead of a bootstrap landing page", async ({ page }) => {
	await page.route("**/api/v1/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "unauthenticated", message: "Sign in required" } }) }));
	await page.goto("/");
	await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await expect(page.getByRole("img", { name: "Payload Bay", exact: true })).toBeVisible();
});

test("email entry advances to accessible OTP entry without a success toast", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.route("**/api/auth/email-otp/send-verification-otp", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
	await page.goto("/login");
	await page.getByLabel("Email address").fill("reviewer@preview.payloadbay.test");
	await page.getByRole("button", { name: "Send sign-in code" }).click();
	await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
	await expect(page.getByText("reviewer@preview.payloadbay.test", { exact: true })).toBeVisible();
	await expect(page.getByLabel("Email address")).toHaveCount(0);
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(page.locator(".input-otp__slot")).toHaveCount(6);
	const code = page.getByRole("textbox", { name: "Sign-in code", exact: true });
	const submit = page.getByRole("button", { name: "Sign in", exact: true });
	await code.fill("123");
	await expect(submit).toBeDisabled();
	await code.fill("");
	await page.evaluate(() => navigator.clipboard.writeText(" 654 321\n"));
	await code.focus();
	await code.press("Control+V");
	await expect(code).toHaveValue("654321");
	await expect(submit).toBeEnabled();
	await code.press("Backspace");
	await expect(submit).toBeDisabled();
	await page.getByRole("button", { name: "Change email" }).click();
	await expect(page.getByLabel("Email address")).toHaveValue("reviewer@preview.payloadbay.test");
	await expect(code).toHaveCount(0);
});

test("failed sign-in request shows a bottom toast without advancing the form", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.route("**/api/auth/email-otp/send-verification-otp", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
	await page.goto("/login");
	await page.getByLabel("Email address").fill("reviewer@preview.payloadbay.test");
	await page.getByRole("button", { name: "Send sign-in code" }).click();
	const error = page.getByRole("alertdialog", { name: "Could not sign in", exact: true });
	await expect(error).toBeVisible();
	await expect(page.getByLabel("Email address")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
	await expect
		.poll(async () => {
			const bounds = await error.boundingBox();

			return Boolean(bounds && bounds.y > 844 / 2 && bounds.y + bounds.height <= 844);
		})
		.toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile dashboard keeps account actions in the avatar menu and projects in a compact table", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	let name = "Very Long Reviewer Display Name";
	const permissions = ["metadata.read", "members.manage", "workspaces.create", "projects.create", "ownership.transfer", "notifications.read"];
	await page.route("**/api/v1/**", (route) => {
		const path = new URL(route.request().url()).pathname;
		const responses: Record<string, unknown> = {
			"/api/v1/me": {
				user: { id: "reviewer", name, email: "long-reviewer-address@preview.payloadbay.test" },
				instanceId: "instance",
				permissions,
				roles: {},
			},
			"/api/v1/workspaces": [
				{
					id: "workspace",
					name: "Preview Workspace",
					slug: "preview",
					permissions,
				},
			],
			"/api/v1/projects": [
				{
					id: "project",
					name: "Webhook Playground",
					slug: "webhook-playground",
					workspace_id: "workspace",
					permissions,
				},
			],
		};

		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responses[path] ?? []) });
	});
	await page.route("**/api/auth/passkey/list-user-passkeys", (route) => route.fulfill({ json: [] }));
	await page.route("**/api/auth/update-user", (route) => {
		name = route.request().postDataJSON().name;

		return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
	await page.goto("/");
	await expect(page.getByRole("grid", { name: "Projects", exact: true })).toBeVisible();
	await expect(page.getByRole("row", { name: /Webhook Playground/ })).toBeVisible();
	await expect(page.getByText("long-reviewer-address@preview.payloadbay.test", { exact: true })).toHaveCount(0);
	await page.setViewportSize({ width: 320, height: 740 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	const navigation = page.getByRole("dialog");
	await expect(navigation).toBeVisible();
	await expect(navigation.getByText("Webhook Playground", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(navigation).toBeHidden();
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await navigation.getByRole("row", { name: "Instance members", exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/members$/);
	await expect(navigation).toBeHidden();
	await page.getByRole("button", { name: "Account menu" }).click();
	await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
	await page.getByRole("menuitem", { name: "Account settings", exact: true }).click();
	await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
	await expect(page.getByRole("heading", { name: "Account settings", exact: true })).toBeVisible();
	await page.getByRole("textbox", { name: /^Display name/ }).fill("Updated Reviewer");
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByRole("alertdialog", { name: "Account saved", exact: true })).toBeVisible();
	expect(name).toBe("Updated Reviewer");
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe("unavailable and empty states", () => {
	test.beforeEach(async ({ page }) => {
		const permissions = ["metadata.read", "members.manage", "notifications.read"];
		await page.route("**/api/v1/me", (route) =>
			route.fulfill({
				json: {
					user: { id: "reviewer", name: "Reviewer", email: "reviewer@example.test" },
					instanceId: "instance",
					permissions,
					roles: {},
				},
			}),
		);
		await page.route("**/api/v1/workspaces", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/projects", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/projects/project", (route) => route.fulfill({ json: { id: "project", name: "Project", permissions } }));
		await page.route("**/api/v1/notifications?*", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/changes?*", (route) => route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" }));
	});

	test("failed event loading offers retry instead of claiming no events exist", async ({ page }) => {
		let unavailable = true;
		await page.route("**/api/v1/projects/project/events", (route) => route.fulfill(unavailable ? { status: 503, json: { error: { code: "unavailable", message: "Service unavailable" } } } : { json: { items: [], nextCursor: null } }));
		await page.goto("/projects/project/events");
		await expect(page.getByRole("heading", { name: "Events unavailable", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "No events yet", exact: true })).toHaveCount(0);
		unavailable = false;
		await page.getByRole("button", { name: "Retry loading events" }).click();
		await expect(page.getByRole("heading", { name: "No events yet", exact: true })).toBeVisible();
	});

	test("failed member loading offers retry instead of claiming no members exist", async ({ page }) => {
		let unavailable = true;
		await page.route("**/api/v1/invitations?*", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/members?*", (route) => route.fulfill(unavailable ? { status: 503, json: { error: { code: "unavailable", message: "Service unavailable" } } } : { json: [] }));
		await page.goto("/admin/members");
		await expect(page.getByRole("heading", { name: "Members unavailable", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "No local members", exact: true })).toHaveCount(0);
		unavailable = false;
		await page.getByRole("button", { name: "Retry loading members" }).click();
		await expect(page.getByRole("heading", { name: "No local members", exact: true })).toBeVisible();
	});

	test("notification inbox distinguishes pending, unavailable and genuinely empty", async ({ page }) => {
		let release!: () => void;
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		let unavailable = true;
		await page.route("**/api/v1/notifications?*", async (route) => {
			await pending;
			await route.fulfill(unavailable ? { status: 503, json: { error: { code: "unavailable", message: "Service unavailable" } } } : { json: [] });
		});
		await page.goto("/");
		await page.getByRole("button", { name: "Notifications", exact: true }).click();
		await expect(page.getByText("Loading notifications…", { exact: true })).toBeVisible();
		await expect(page.getByText("No active notifications.", { exact: true })).toHaveCount(0);
		release();
		await expect(page.getByText("Notifications unavailable.", { exact: true })).toBeVisible();
		unavailable = false;
		await page.getByRole("button", { name: "Retry loading notifications" }).click();
		await expect(page.getByText("No active notifications.", { exact: true })).toBeVisible();
	});
});

test("route editor has nested navigation, a scripting guide, typed method handlers and formatted saves", async ({ page }, testInfo) => {
	test.setTimeout(90000);

	await page.setViewportSize({ width: 390, height: 844 });
	const permissions = ["metadata.read", "code.read", "code.edit", "code.publish", "code.test", "members.manage", "notifications.rules.manage", "secrets.use", "secrets.manage"];
	let savedBody = "";
	const draft = {
		body: 'export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"hello"}); }',
		version: 1,
		shared_bindings: {},
		secret_bindings: { SIGNING_SECRET: "secret" },
	};
	await page.route("**/api/v1/**", (route) => {
		const path = new URL(route.request().url()).pathname;
		if (route.request().method() === "PATCH") {
			savedBody = route.request().postDataJSON().body;

			return route.fulfill({ json: { ...draft, body: savedBody, version: 2 } });
		}

		const responses: Record<string, unknown> = {
			"/api/v1/me": {
				user: { id: "reviewer", name: "Reviewer", email: "reviewer@example.test" },
				instanceId: "instance",
				permissions,
				roles: {},
			},
			"/api/v1/workspaces": [],
			"/api/v1/secrets": [
				{
					id: "secret",
					name: "Signing key",
					version: 1,
					revoked_at: null,
				},
			],
			"/api/v1/projects": [
				{
					id: "project",
					name: "Playground",
					workspace_id: "workspace",
					slug: "playground",
					permissions,
				},
			],
			"/api/v1/endpoints/endpoint": {
				id: "endpoint",
				projectId: "project",
				name: "Sample Webhook",
				version: 1,
				permissions,
				paused: false,
				activePublicationId: null,
				ingressUrl: "https://preview.example.test/ingress/a-very-long-receiving-key-that-must-scroll-inside-the-code-box",
			},
			"/api/v1/endpoints/endpoint/drafts/ingress": draft,
			"/api/v1/endpoints/endpoint/drafts/processing": { ...draft, body: "return ctx.complete();" },
		};

		return route.fulfill({ json: responses[path] ?? [] });
	});
	await page.goto("/projects/project/routes/endpoint");
	await expect(page.getByRole("heading", { name: "Sample Webhook", exact: true })).toBeVisible();
	await expect(page.getByLabel("Synthetic request body", { exact: true })).toBeHidden();
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	const navigation = page.getByRole("dialog");
	await expect(navigation.getByRole("row", { name: "Route events", exact: true })).toBeVisible();
	await expect(navigation.getByRole("row", { name: "Secrets", exact: true })).toBeVisible();
	await expect(navigation.getByRole("row", { name: "Instance members", exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	const editor = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await expect(page.locator(".monaco-editor .view-lines").first()).toBeVisible();
	await expect(page.getByText("Loading code editor…", { exact: true })).toHaveCount(0, { timeout: 20000 });
	await editor.focus();
	await page.keyboard.press("Control+Home");
	for (let i = 0; i < 28; i++) await page.keyboard.press("ArrowRight");
	await page.keyboard.press("Control+k");
	await page.keyboard.press("Control+i");
	await expect(page.locator(".monaco-hover:visible").first()).toBeVisible({ timeout: 15000 });
	await expect(page.locator(".monaco-hover:visible").first()).toContainText(/ctx: (PayloadBay\.)?IngressContext/);
	await page.keyboard.press("Escape");
	await editor.focus();
	await page.keyboard.press("Control+Home");
	await page.keyboard.press("Control+a");
	await page.keyboard.insertText('export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:201,body:"formatted"}); }');
	await expect(page.getByText("Unsaved changes", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect.poll(() => savedBody).toContain('status: 201, body: "formatted"');
	expect(savedBody.startsWith("export async function POST")).toBe(true);
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Scripting guide", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Writing Payload Bay scripts" })).toBeVisible();
	await expect(page.getByRole("dialog").getByText(/Only exported methods run/)).toBeVisible();
	await page.getByRole("button", { name: "Got it" }).click();
	await page.getByLabel("Ingress template", { exact: true }).selectOption("unverified");
	await expect(page.getByLabel("Ingress template", { exact: true })).toHaveValue("unverified");
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await page.getByRole("dialog").getByRole("row", { name: "Secrets", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Secret bindings", exact: true })).toBeVisible();
	await expect(page.getByRole("row", { name: /SIGNING_SECRET/ })).toBeVisible();
	await page.setViewportSize({ width: 320, height: 740 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({ path: testInfo.outputPath("route-editor-mobile.png"), fullPage: true });
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByRole("row", { name: "Route events", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Toggle navigation" })).toBeHidden();
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
	await page.getByRole("button", { name: "Keep editing", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Secret bindings" })).toBeVisible();
});
