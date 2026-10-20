import { chooseOption } from "../helpers/select-option.ts";
import { test, expect } from "../helpers/browser-test.ts";
import { nextFixture } from "../helpers/next-fixture.ts";

test("signed-out application root opens sign-in instead of a bootstrap landing page", async ({ page }) => {
	await page.route("**/api/v1/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "unauthenticated", message: "Sign in required" } }) }));
	await page.goto("/");
	await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await expect(page.getByRole("img", { name: "Payload Bay", exact: true })).toBeVisible();
});

test("email entry advances to accessible OTP entry without a success toast", async ({ page, context }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.route("**/api/auth/email-otp/send-verification-otp", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
	await page.goto("/login");
	await page.getByLabel("Email address").fill("reviewer@preview.payloadbay.test");
	const emailWidth = await page.getByLabel("Email address").boundingBox();
	const submitWidth = await page.getByRole("button", { name: "Send sign-in code" }).boundingBox();
	expect(submitWidth!.width).toBeGreaterThan(emailWidth!.width * 0.95);
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
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
			"/api/v1/overview": {
				totals: {
					ingress: 0,
					accepted: 0,
					rejected: 0,
					responded: 0,
					errored: 0,
					deliveries: 0,
					delivered: 0,
					failed: 0,
					executions: 0,
				},
				series: Array.from({ length: 24 }, (_, hour) => ({
					hour: `2026-10-15T${String(hour).padStart(2, "0")}:00:00Z`,
					ingress: 0,
					accepted: 0,
					rejected: 0,
					deliveries: 0,
					executions: 0,
				})),
				recent: [],
			},
			"/api/v1/projects": [
				{
					id: "project",
					name: "Demo integrations",
					slug: "demo-integrations",
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
	await expect(page.getByRole("row", { name: /Demo integrations/ })).toBeVisible();
	await expect(page.getByText("long-reviewer-address@preview.payloadbay.test", { exact: true })).toHaveCount(0);
	await page.setViewportSize({ width: 320, height: 740 });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	const accountBounds = await page.getByRole("button", { name: "Account menu" }).boundingBox();
	expect(accountBounds!.x + accountBounds!.width).toBeLessThanOrEqual(320);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	const navigation = page.getByRole("dialog", { name: "Dashboard navigation", exact: true });
	await expect(navigation).toBeVisible();
	await expect(navigation.getByText("Browse hierarchy", { exact: true })).toHaveCount(0);
	await expect(navigation.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
	await expect(navigation.getByRole("link", { name: "Workspaces", exact: true })).toBeVisible();
	await navigation.getByRole("button", { name: "Search pages and resources", exact: true }).click();
	const command = page.getByRole("dialog", { name: "Search pages and resources", exact: true });
	await expect(command).toBeVisible();
	await expect(navigation).toBeHidden();
	const query = command.getByPlaceholder("Search pages and resources…");
	await query.fill("Demo");
	await query.press("ArrowDown");
	await query.pressSequentially(" integrations");
	await expect(query).toHaveValue("Demo integrations");
	await expect(command.getByRole("menuitem", { name: "Demo integrations / Project Jump to", exact: true })).toBeVisible();
	await command.getByRole("button", { name: "Clear search", exact: true }).click();
	await expect(query).toHaveValue("");
	await page.keyboard.press("Escape");
	await expect(command).toBeHidden();
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await page.keyboard.press("Escape");
	await expect(navigation).toBeHidden();
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await navigation.getByRole("link", { name: "Instance members", exact: true }).click();
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
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
		await page.route("**/api/v1/organizations", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/workspaces", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/projects", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/projects/project", (route) => route.fulfill({ json: { id: "project", name: "Project", permissions } }));
		await page.route("**/api/v1/notifications?*", (route) => route.fulfill({ json: [] }));
		await page.route("**/api/v1/changes?*", (route) => route.fulfill({ contentType: "text/event-stream", body: ": connected\n\n" }));
	});

	test("failed event loading offers retry instead of claiming no events exist", async ({ page }) => {
		let unavailable = true;
		await page.route("**/api/v1/projects/project/events?*", (route) => route.fulfill(unavailable ? { status: 503, json: { error: { code: "unavailable", message: "Service unavailable" } } } : { json: { items: [], nextCursor: null } }));
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
		await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("No active notifications.", { exact: true })).toHaveCount(0);
		release();
		await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("Notifications unavailable.", { exact: true })).toBeVisible();
		unavailable = false;
		await page.getByRole("button", { name: "Retry loading notifications" }).click();
		await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("No active notifications.", { exact: true })).toBeVisible();
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
			"/api/v1/overview": {
				totals: {
					ingress: 0,
					accepted: 0,
					rejected: 0,
					deliveries: 0,
				},
				series: [],
				recent: [],
			},
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
	const navigation = page.getByRole("dialog", { name: "Dashboard navigation", exact: true });
	await expect(navigation.getByRole("link", { name: "Route events", exact: true })).toBeVisible();
	await expect(navigation.getByRole("link", { name: "Secrets", exact: true })).toBeVisible();
	await expect(navigation.getByRole("link", { name: "Instance members", exact: true })).toHaveCount(0);
	await expect(navigation.getByRole("button", { name: "Back to project", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("link", { name: "Open scripts", exact: true }).click();
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
	await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect.poll(() => savedBody).toContain('status: 201, body: "formatted"');
	expect(savedBody.startsWith("export async function POST")).toBe(true);
	await expect(page.getByText("Draft saved / Not published", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Scripting guide", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Writing Payload Bay scripts" })).toBeVisible();
	await expect(page.getByRole("dialog").getByText(/Only exported methods run/)).toBeVisible();
	await page.getByRole("button", { name: "Got it" }).click();
	await chooseOption(page.getByRole("button", { name: new RegExp("Ingress template") }), "unverified");
	await expect(page.getByRole("button", { name: /Ingress template/ })).toContainText("Explicitly unverified");
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await page.getByRole("dialog").getByRole("link", { name: "Secrets", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Secret inventory", exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox", { name: "Signing key v1 available in ingress", exact: true })).toBeChecked();
	await expect(page.getByRole("checkbox", { name: "Signing key v1 available in processing", exact: true })).toBeChecked();
	await page.setViewportSize({ width: 320, height: 740 });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({ path: testInfo.outputPath("route-editor-mobile.png"), fullPage: true });
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByRole("link", { name: "Route events", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Toggle navigation" })).toBeVisible();
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
	await page.getByRole("button", { name: "Keep editing", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Secret inventory" })).toBeVisible();
});

test("L01 sign-in hint is opt-in plain text without a demo account selector", async ({ page }) => {
	test.setTimeout(120000);
	const hint = "Try these accounts:\nInstance owner: owner@example.test\nProject viewer: viewer@example.test\n<script>not executable</script>";
	for (const options of [{ loginHint: hint }, { loginHint: "   " }, { preview: true }]) {
		await nextFixture(async ({ url }) => {
			try {
				await page.goto(url + "/login");
				await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
				await expect(page.getByRole("combobox")).toHaveCount(0);
				await expect(page.getByLabel("Email address")).toHaveValue("");
				const note = page.getByRole("note", { name: "Sign-in information" });
				if (options.loginHint === hint) {
					await expect(note).toHaveText(hint);
					await expect(note.locator("script")).toHaveCount(0);
					await page.route("**/api/auth/email-otp/send-verification-otp", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
					await page.getByLabel("Email address").fill("viewer@example.test");
					await page.getByRole("button", { name: "Send sign-in code" }).click();
					await expect(page.getByLabel("Sign-in code", { exact: true })).toBeVisible();
					await expect(note).toHaveCount(0);
				} else await expect(note).toHaveCount(0);
			} finally {
				// Release browser connections before the isolated server flushes coverage and exits.
				await page.goto("about:blank");
			}
		}, options);
	}
});
