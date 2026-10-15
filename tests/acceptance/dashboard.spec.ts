import { test, expect } from "@playwright/test";
import { resetBrowserData } from "../helpers/browser-data.ts";

test.beforeEach(resetBrowserData);

test("U60 setup explains service errors and retry recovers", async ({ page }) => {
	let unavailable = true;
	await page.route("**/api/v1/bootstrap", async (route) => {
		if (unavailable) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Service unavailable" } }) });
		else await route.continue();
	});
	await page.goto("/setup");
	await expect(page.getByRole("heading", { name: "Set up Payload Bay" })).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Setup unavailable", exact: true })).toContainText("Check the database and SMTP configuration");
	unavailable = false;
	await page.getByRole("button", { name: "Retry setup check" }).click();
	await expect(page.getByLabel("Your name")).toBeVisible();
	await expect(page.getByLabel("Setup secret")).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Setup unavailable", exact: true })).toHaveCount(0);
});

test("U61 setup and login use real SMTP codes", async ({ page, request }) => {
	const mailUrl = process.env.PAB_TEST_MAIL_URL;
	expect(mailUrl).toBeTruthy();

	async function code(after = 0) {
		let id = "";
		await expect
			.poll(async () => {
				const data = await (await request.get(mailUrl + "/api/v1/messages")).json();
				if (data.total > after) id = data.messages[0].ID;

				return data.total;
			})
			.toBeGreaterThan(after);
		const message = await (await request.get(mailUrl + "/api/v1/message/" + id)).json();
		const otp = message.Text.match(/\b\d{6}\b/)?.[0];
		expect(otp).toBeTruthy();

		return otp!;
	}

	await page.goto("/setup");
	await page.getByLabel("Your name").fill("Browser owner");
	await page.getByLabel("Setup secret").fill(process.env.PAYLOADBAY_BOOTSTRAP_SECRET!);
	await page.getByLabel("Email address").fill("browser@example.test");
	await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
	await page.getByLabel("Sign-in code").fill(await code());
	await page.getByRole("button", { name: "Create owner and continue" }).click();
	await expect(page).toHaveURL(/\/$/);
	const me = await page.request.get("/api/v1/me");
	expect(me.status()).toBe(200);
	expect((await me.json()).user.email).toBe("browser@example.test");
	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await page.getByLabel("Email address").fill("browser@example.test");
	await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
	await page.getByLabel("Sign-in code").fill(await code(1));
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	expect((await page.request.get("/api/v1/me")).status()).toBe(200);
});

test("U62 dashboard hides projects outside inherited access", async ({ page }) => {
	const { ensureBrowserOwner, signInBrowser, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const headers = commandHeaders();
	const workspaceResponse = await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Browser workspace", slug: "browser-workspace" } });
	expect(workspaceResponse.status()).toBe(200);
	const workspace = await workspaceResponse.json();

	const create = async (name: string, slug: string) => {
		const response = await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name, slug } });
		expect(response.status()).toBe(200);

		return response.json();
	};

	const visible = await create("Visible project", "visible");
	await create("Hidden project", "hidden");
	const { database } = await import("../../packages/domain/src/db.ts");
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { readServerConfig } = await import("../../packages/domain/src/config.ts");
	const pool = database(process.env.DATABASE_URL!);
	const service = createAuth(pool, readServerConfig(process.env));
	try {
		const user = (await service.api.createUser({ body: { email: "viewer@example.test", name: "Project viewer" } })).user;
		await pool.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,$2)", [me.instanceId, user.id]);
		await pool.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'project',$2,'viewer',ARRAY['metadata.read'])", [user.id, visible.id]);
	} finally {
		await service.close();
		await pool.end();
	}

	await signInBrowser(page, "viewer@example.test");
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Projects", exact: true }).getByRole("row", { name: /Visible project/ })).toBeVisible();
	await expect(page.getByText("Hidden project", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Create workspace" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Create project" })).toHaveCount(0);
});

test("U63 member editing preserves presets and customized rights", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const { database } = await import("../../packages/domain/src/db.ts");
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { readServerConfig } = await import("../../packages/domain/src/config.ts");
	const pool = database(process.env.DATABASE_URL!);
	const service = createAuth(pool, readServerConfig(process.env));
	let memberId = "";
	try {
		const member = (await service.api.createUser({ body: { email: "member@example.test", name: "Editable member" } })).user;
		memberId = member.id;
		await pool.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,$2)", [me.instanceId, memberId]);
		await pool.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'instance',$2,'viewer',ARRAY['metadata.read','notifications.read'])", [memberId, me.instanceId]);
	} finally {
		await service.close();
		await pool.end();
	}

	await page.goto("/admin/members");
	await expect(page.getByRole("heading", { name: "Instance members" })).toBeVisible();
	await page.getByRole("button", { name: "Edit permissions for Editable member" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.getByLabel("Role preset").selectOption("operator");
	await expect(page.getByRole("checkbox", { name: "Read event payloads", exact: true })).toBeChecked();
	await page.getByText("Read event payloads", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Read event payloads", exact: true })).not.toBeChecked();
	await page.getByText("Read audit history", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Read audit history", exact: true })).toBeChecked();
	await expect(page.getByLabel("Role preset")).toHaveValue("custom");
	await page.getByRole("button", { name: "Save permissions" }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	const members = await (await page.request.get("/api/v1/members?scopeType=instance&scopeId=" + me.instanceId)).json();
	const member = members.find((m: { user_id: string }) => m.user_id === memberId);
	expect(member.role_preset).toBe("custom");
	expect(member.permissions).toContain("audit.read");
	expect(member.permissions).not.toContain("payload.read");
	expect(member.version).toBe(2);
});

test("U64 local theme fonts and icons render without remote requests", async ({ page }) => {
	const remote: string[] = [];
	page.on("request", (r) => {
		if (!["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)) remote.push(r.url());
	});
	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	const theme = await page.evaluate(async () => {
		await document.fonts.ready;
		const dark = getComputedStyle(document.body).backgroundColor;
		document.documentElement.setAttribute("data-theme", "light");
		const light = getComputedStyle(document.body).backgroundColor;

		return {
			dark,
			light,
			font: getComputedStyle(document.body).fontFamily,
			loaded: document.fonts.check('16px "Inter Variable"'),
			accent: getComputedStyle(document.documentElement).getPropertyValue("--accent"),
		};
	});
	expect(theme.font).toContain("Inter Variable");
	expect(theme.loaded).toBe(true);
	expect(theme.accent).toContain("oklch");
	expect(theme.dark).not.toBe(theme.light);
	expect(remote).toEqual([]);
});

test("U261 project dashboard configures ingress route and destination", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Delivery workspace", slug: "delivery-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Delivery project", slug: "delivery-project" } })).json();
	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("heading", { name: "Delivery project", exact: true }), "Project detail must be available").toBeVisible();
	await page.getByRole("button", { name: "Add destination", exact: true }).click();
	await page.getByLabel("Name", { exact: true }).fill("Application");
	await page.getByLabel("Destination URL").fill(process.env.PAB_TEST_HTTP_URL + "/delivery");
	await page.getByRole("button", { name: "Create destination", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Application", exact: true })).toBeVisible();
	await expect(page.getByText("Default delivery target", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Add ingress route", exact: true }).click();
	await page.getByLabel("Name", { exact: true }).fill("Stripe");
	await page.getByRole("button", { name: "Create ingress route", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Stripe", exact: true })).toBeVisible();
	await expect(page.getByText("Not published", { exact: true })).toBeVisible();
	const routes = await (await page.request.get("/api/v1/projects/" + project.id + "/endpoints")).json();
	expect(routes).toHaveLength(1);
	const destinations = await (await page.request.get("/api/v1/projects/" + project.id + "/destinations")).json();
	expect(destinations).toHaveLength(1);
	expect(destinations[0].is_default).toBe(true);
});

test("U80 route editor separates ingress and processing bodies", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Editor workspace", slug: "editor-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Editor project", slug: "editor-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Editable route", slug: "editable" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await expect(page.getByRole("tab", { name: "Ingress", exact: true }), "Separate lifecycle editor tabs must exist").toBeVisible();
	await expect(page.getByRole("tab", { name: "Ingress", exact: true })).toHaveAttribute("aria-selected", "true");
	await expect(page.locator(".monaco-editor .view-lines").first()).toContainText("async function POST(ctx: IngressContext)");
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toBeAttached();
	await page.getByRole("tab", { name: "Processing", exact: true }).click();
	await expect(page.locator(".monaco-editor .view-lines").first()).toContainText("async function processEvent(ctx: ProcessingContext)");
	await expect(page.getByRole("textbox", { name: "Processing code", exact: true })).toBeAttached();
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toHaveCount(0);
});

test("U75 copied template remains editable and leaves future copies unchanged", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { unverifiedHttpTemplate } = await import("../../packages/script-sdk/src/templates/unverified.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Template workspace", slug: "template-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Template project", slug: "template-project" } })).json();

	const create = async (slug: string) => (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: slug, slug } })).json();

	const first = await create("first");
	const second = await create("second");
	await page.goto("/projects/" + project.id + "/routes/" + first.id);
	await page.getByLabel("Ingress template").selectOption("unverified");
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"my custom copy"}); }');
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	const saved = await (await page.request.get("/api/v1/endpoints/" + first.id + "/drafts/ingress")).json();
	expect(saved.body).toContain("my custom copy");
	expect(saved.body).not.toBe(unverifiedHttpTemplate.source);
	await page.goto("/projects/" + project.id + "/routes/" + second.id);
	await page.getByLabel("Ingress template").selectOption("unverified");
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toBeAttached();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	const another = await (await page.request.get("/api/v1/endpoints/" + second.id + "/drafts/ingress")).json();
	expect(another.body.replace(/\s/g, ""), "New template copies must preserve source while applying project formatting").toBe(unverifiedHttpTemplate.source.replace(/\s/g, ""));
});

test("U265 route editor binds an encrypted signing secret version", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Secret workspace", slug: "secret-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Secret project", slug: "secret-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Signed route", slug: "signed" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.getByLabel("Ingress template").selectOption("hmac");
	await page.getByRole("row", { name: "Secrets", exact: true }).click();
	await expect(page.getByRole("button", { name: "Create a secret version", exact: true }), "Secret version controls must be available").toBeVisible();
	await page.getByRole("button", { name: "Create a secret version", exact: true }).click();
	await page.getByLabel("Secret name").fill("Signing key");
	await page.getByLabel("Secret value").fill("fixture-private-signing-key");
	await page.getByRole("button", { name: "Create secret version", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Secret status", exact: true })).toContainText("Secret version created");
	await page.getByRole("button", { name: "Bind secret version", exact: true }).click();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	const draft = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	const versions = await (await page.request.get("/api/v1/secrets?scopeType=project&scopeId=" + project.id)).json();
	expect(draft.secret_bindings.SIGNING_SECRET).toBe(versions[0].id);
	expect(JSON.stringify(draft)).not.toContain("fixture-private-signing-key");
	expect(JSON.stringify(versions)).not.toContain("fixture-private-signing-key");
});

test("U116 event inspector displays HTML payload as escaped text", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Inspector workspace", slug: "inspector-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Inspector project", slug: "inspector-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Inspector route", slug: "inspector" } })).json();
	const published = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } });
	expect(published.status()).toBe(200);
	const publication = await published.json();
	const body = '<script>globalThis.PAYLOADBAY_ATTACKED=true</script><img src="x" onerror="globalThis.PAYLOADBAY_ATTACKED=true">';
	const { database } = await import("../../packages/domain/src/db.ts");
	const pool = database(process.env.DATABASE_URL!);
	try {
		const event = (await pool.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,$3,$3,'{}','text/html') RETURNING id", [route.id, publication.id, Buffer.from(body)])).rows[0].id;
		await pool.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state,final_result) VALUES($1,$2,$3,'succeeded','{\"kind\":\"complete\"}')", [event, route.id, publication.id]);
	} finally {
		await pool.end();
	}

	await page.goto("/projects/" + project.id + "/events");
	await expect(page.getByRole("grid", { name: "Stored events" }), "Event inspection screen must exist").toBeVisible();
	await page.getByRole("button", { name: /Inspect event/ }).click();
	await expect(page.getByLabel("Original request body")).toHaveText(body);
	await expect(page.getByLabel("Accepted event body")).toHaveText(body);
	await expect(page.locator('img[src="x"]')).toHaveCount(0);
	expect(await page.evaluate(() => Boolean((globalThis as typeof globalThis & { PAYLOADBAY_ATTACKED?: boolean }).PAYLOADBAY_ATTACKED))).toBe(false);
	await expect(page.getByText("Handler completed", { exact: true }).last()).toBeVisible();
});

test("U275 stored event appears through authenticated live updates", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Live workspace", slug: "live-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Live project", slug: "live-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Live route", slug: "live" } })).json();
	const published = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } });
	expect(published.status()).toBe(200);
	const publication = await published.json();
	await page.goto("/projects/" + project.id + "/events");
	await expect(page.getByText("No events yet", { exact: true })).toBeVisible();
	const { database } = await import("../../packages/domain/src/db.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const pool = database(process.env.DATABASE_URL!);
	try {
		const db = await pool.connect();
		try {
			await db.query("BEGIN");
			const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,$3,$3,'{}','text/plain') RETURNING id", [route.id, publication.id, Buffer.from("live fixture")])).rows[0].id;
			await appendChange(db, { scope: { type: "project", id: project.id }, kind: "event.accepted", resourceId: event });
			await db.query("COMMIT");
		} finally {
			db.release();
		}
	} finally {
		await pool.end();
	}

	await expect(page.getByRole("grid", { name: "Stored events" }), "Committed events must appear without manual refresh").toBeVisible({ timeout: 6000 });
	await expect(page.getByRole("button", { name: /Inspect event/ })).toHaveCount(1);
});

test("U276 administrator opens and personally dismisses runtime advice", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.goto("/");
	await expect(page.getByRole("button", { name: "Notifications", exact: true }), "Notification inbox must be available").toBeVisible();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Scripts use ordinary Docker containment", exact: true })).toBeVisible();
	await expect(page.getByText(/PAYLOADBAY_EXECUTOR_RUNTIME=runsc/)).toBeVisible();
	await page.getByRole("button", { name: "Dismiss notification Scripts use ordinary Docker containment", exact: true }).click();
	await expect(page.getByText("No active notifications.", { exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByText("No active notifications.", { exact: true })).toBeVisible();
});

test("U292 project code page creates helper version and processing middleware", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Code workspace", slug: "code-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Code project", slug: "code-project" } })).json();
	await page.goto("/code/project/" + project.id);
	await expect(page.getByRole("heading", { name: "Code and middleware", exact: true }), "Code management page must be available").toBeVisible();
	await page.getByRole("button", { name: "Create helper", exact: true }).click();
	await page.getByLabel("Helper name", { exact: true }).fill("Messages");
	const code = page.getByRole("textbox", { name: "Shared helper code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export function message(){return "shared";}');
	await page.getByRole("button", { name: "Save helper version", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Saved a new immutable helper version");
	await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Middleware", exact: true }).click();
	await page.getByRole("button", { name: "Create middleware", exact: true }).click();
	await page.getByLabel("Middleware name", { exact: true }).fill("Project policy");
	await expect(page.locator(".monaco-editor .view-lines").first()).toContainText("ProcessingMiddlewareContext");
	await page.getByRole("button", { name: "Save middleware", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Middleware saved");
	await expect(page.getByRole("heading", { name: "Project policy", exact: true })).toBeVisible();
	const bindings = await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json();
	expect(bindings).toHaveLength(1);
	expect(bindings[0].scope.id).toBe(project.id);
	expect(bindings[0].stage).toBe("processing");
});

test("U83 route editor binds helper version and supports editable file imports", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Import workspace", slug: "import-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Import project", slug: "import-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Imported route", slug: "imported" } })).json();
	const created = await page.request.post("/api/v1/shared-code", { headers, data: { scope: { type: "project", id: project.id }, name: "Messages", source: 'export function message(){return "from shared helper";}' } });
	expect(created.status()).toBe(200);
	const helper = await created.json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.getByRole("row", { name: "Helper imports", exact: true }).click();
	await expect(page.getByLabel("Shared helper version"), "Shared helper controls must exist").toBeVisible();
	await page.getByLabel("Shared helper version").selectOption(helper.id);
	await page.getByRole("button", { name: "Add import", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Helper imports" })).toContainText('import * as Helpers from "@shared/Helpers";');
	await page.getByRole("row", { name: "Scripts", exact: true }).click();
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('import * as Helpers from "@shared/Helpers";\nexport async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:Helpers.message()}); }\nexport async function GET(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"ready"}); }');
	await page.getByRole("button", { name: "Publish both stages", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Published", { timeout: 20000 });
	const endpoint = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	const response = await page.request.post(endpoint.ingressUrl, { data: "fixture" });
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe("from shared helper");
	await page.getByRole("row", { name: "Playground", exact: true }).click();
	await page.getByLabel("HTTP method", { exact: true }).selectOption("GET");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByText("HTTP 200", { exact: true })).toBeVisible();
	await expect(page.getByText("ready", { exact: true })).toBeVisible();
});

test("U293 project navigation opens scoped code management", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Navigation workspace", slug: "navigation-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Navigation project", slug: "navigation-project" } })).json();
	await page.goto("/projects/" + project.id);
	await page.getByRole("row", { name: "Code and middleware", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/code/project/" + project.id + "$"));
	await expect(page.getByRole("heading", { name: "Code and middleware", exact: true })).toBeVisible();
});

test("U296 project member navigation uses project scope", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Member workspace", slug: "member-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Member project", slug: "member-project" } })).json();
	await page.goto("/projects/" + project.id);
	await page.getByRole("row", { name: "Project members", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Project members", exact: true }), "Project member page must exist").toBeVisible();
	await expect(page.getByRole("rowheader", { name: /Browser owner/ })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Instance members", exact: true })).toHaveCount(0);
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Member project", exact: true })).toBeVisible();
});

test("U299 action feedback appears in toasts instead of inline boxes", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Toast workspace", slug: "toast-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Toast project", slug: "toast-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Toast route", slug: "toast-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.getByRole("button", { name: "Pause delivery", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true }), "Completed delivery commands use a toast").toBeVisible();
	await expect(page.locator("main").getByRole("status", { name: "Script status" })).toHaveCount(0);
	await page.getByRole("button", { name: "Resume delivery", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toHaveCount(1);
});

test("U300 route editor tests unsaved ingress with synthetic fixture", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Test workspace", slug: "test-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Test project", slug: "test-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Test route", slug: "test-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"synthetic:"+new TextDecoder().decode(ctx.request.body)}); }');
	await page.getByRole("row", { name: "Script test", exact: true }).click();
	await page.getByLabel("Synthetic request body", { exact: true }).fill("hello");
	await page.getByRole("button", { name: "Test ingress (dry)", exact: true }).click();
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("synthetic:hello", { timeout: 20000 });
	await expect(page.locator('[data-slot="toast"]').filter({ hasText: "Synthetic test completed" })).toHaveCount(0);
	const saved = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	expect(saved.version).toBe(1);
	expect(saved.body).not.toContain("synthetic:");
	const events = await (await page.request.get("/api/v1/projects/" + project.id + "/events")).json();
	expect(events.items).toHaveLength(0);
});

test("U301 code scope picker navigates workspace and project", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Scope workspace", slug: "scope-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Scope project", slug: "scope-project" } })).json();
	await page.goto("/code/project/" + project.id);
	await expect(page.getByLabel("Code scope", { exact: true }), "Code scope picker must exist").toBeVisible();
	await page.getByLabel("Code scope", { exact: true }).selectOption("workspace:" + workspace.id);
	await expect(page).toHaveURL(new RegExp("/code/workspace/" + workspace.id + "$"));
	await expect(page.getByRole("button", { name: "Create helper", exact: true })).toBeVisible();
	await page.getByLabel("Code scope", { exact: true }).selectOption("project:" + project.id);
	await expect(page).toHaveURL(new RegExp("/code/project/" + project.id + "$"));
	await expect(page.getByRole("button", { name: "Create helper", exact: true })).toBeVisible();
});

test("U302 repeated saves retain a clear saved state without redundant toasts", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Repeat workspace", slug: "repeat-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Repeat project", slug: "repeat-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Repeat route", slug: "repeat-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved · Not published", { exact: true })).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toHaveCount(0);
});

test("U131 inherited middleware shows provenance and copies a local override", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Policy workspace", slug: "policy-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Policy project", slug: "policy-project" } })).json();
	const parentResponse = await page.request.post("/api/v1/middleware", {
		headers,
		data: {
			scope: { type: "workspace", id: workspace.id },
			stage: "processing",
			name: "Parent policy",
			body: "return ctx.continue({event:{metadata:{parent:true}}});",
			position: 0,
			failurePolicy: "required",
			overridePolicy: "allowed",
		},
	});
	expect(parentResponse.status()).toBe(200);
	const parent = await parentResponse.json();
	const locked = await page.request.post("/api/v1/middleware", {
		headers,
		data: {
			scope: { type: "workspace", id: workspace.id },
			stage: "processing",
			name: "Locked policy",
			body: "return ctx.continue();",
			position: 1,
			failurePolicy: "required",
			overridePolicy: "forbidden",
		},
	});
	expect(locked.status()).toBe(200);
	await page.goto("/code/project/" + project.id);
	await page.getByRole("tab", { name: "Middleware", exact: true }).click();
	const inherited = page.getByRole("group", { name: "Middleware Parent policy", exact: true });
	await expect(inherited, "Inherited scope must be visible").toContainText("workspace · Policy workspace");
	await expect(inherited).toContainText("Inherited");
	await expect(inherited.getByRole("button", { name: "Edit middleware", exact: true })).toHaveCount(0);
	await expect(page.getByRole("group", { name: "Middleware Locked policy", exact: true }).getByRole("button", { name: "Create local override", exact: true })).toHaveCount(0);
	await inherited.getByRole("button", { name: "Create local override", exact: true }).click();
	await page.getByLabel("Middleware name", { exact: true }).fill("Local policy");
	await page.getByRole("button", { name: "Save middleware", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Middleware saved", { timeout: 20000 });
	const bindings = await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json();
	const local = bindings.find((binding: any) => binding.name === "Local policy");
	expect(local.scope.id).toBe(project.id);
	expect(local.originBindingId).toBe(parent.id);
	const unchanged = await (await page.request.get("/api/v1/middleware/" + parent.id)).json();
	expect(unchanged.version).toBe(1);
	expect(unchanged.body).toContain("parent:true");
});

test("U305 project dashboard configures explicit route failure notifications", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Rules workspace", slug: "rules-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Rules project", slug: "rules-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Stripe route", slug: "stripe" } })).json();
	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("row", { name: "Notification rules", exact: true }), "Project notification configuration must be discoverable").toBeVisible();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
	await expect(page.getByText("No active notifications.", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("row", { name: "Notification rules", exact: true }).click();
	await expect(page.getByRole("heading", { name: "No failure notification rules", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create notification rule", exact: true }).click();
	const enabled = page.getByRole("checkbox", { name: "Enable failure notifications", exact: true });
	await expect(enabled).not.toBeChecked();
	await page.getByText("Enable failure notifications", { exact: true }).click();
	await expect(enabled).toBeChecked();
	await page.getByLabel("Rule ingress route", { exact: true }).selectOption(route.id);
	await page.getByRole("button", { name: "Save notification rule", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Notification rule status", exact: true })).toContainText("Notification rule saved");
	let rules = await (await page.request.get("/api/v1/projects/" + project.id + "/notification-rules")).json();
	expect(rules).toHaveLength(1);
	expect(rules[0].count).toBe(1);
	expect(rules[0].enabled).toBe(true);
	expect(rules[0].endpointId).toBe(route.id);
	await page.getByRole("button", { name: "Edit rule", exact: true }).click();
	await page.getByText("Enable failure notifications", { exact: true }).click();
	await expect(enabled).not.toBeChecked();
	await page.getByRole("button", { name: "Save notification rule", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Notification rule status", exact: true })).toContainText("Notification rule saved");
	rules = await (await page.request.get("/api/v1/projects/" + project.id + "/notification-rules")).json();
	expect(rules[0].enabled).toBe(false);
	expect(rules[0].version).toBe(2);
});

test("U307 route editor pauses and resumes delivery with versioned commands", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Pause workspace", slug: "pause-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Pause project", slug: "pause-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Pause route", slug: "pause-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await expect(page.getByRole("button", { name: "Pause delivery", exact: true }), "Delivery controls must be available").toBeVisible();
	await page.getByRole("button", { name: "Pause delivery", exact: true }).click();
	await expect(page.getByLabel("Delivery state", { exact: true })).toContainText("ingress still accepts events");
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Delivery paused");
	let stored = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	expect(stored.paused).toBe(true);
	expect(stored.version).toBe(2);
	await page.getByRole("button", { name: "Resume delivery", exact: true }).click();
	await expect(page.getByLabel("Delivery state", { exact: true })).toContainText("Delivery active");
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Delivery resumed");
	stored = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	expect(stored.paused).toBe(false);
	expect(stored.version).toBe(3);
});

test("account registers a passkey, signs in with it and removes it", async ({ page, context }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
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
	await page.getByLabel("Passkey name").fill("Review device");
	await page.getByRole("button", { name: "Add passkey", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Your passkeys" })).toContainText("Review device");
	await page.getByRole("button", { name: "Account menu" }).click();
	await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
	await page.getByRole("button", { name: "Sign in with a passkey", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.goto("/account");
	await page.getByRole("button", { name: "Remove passkey Review device", exact: true }).click();
	await expect(page.getByText("No passkeys registered yet.", { exact: true })).toBeVisible();
});

test("project invitations remain pending until the recipient signs in and accepts", async ({ page, context }) => {
	const { ensureBrowserOwner, signInBrowser, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Invitation workspace", slug: "invitation-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Invited project", slug: "invited-project" } })).json();
	await page.goto("/projects/" + project.id + "/members");
	await page.getByRole("button", { name: "Invite someone", exact: true }).click();
	await page.getByLabel("Email address").fill("invited-reviewer@example.test");
	await page.getByRole("button", { name: "Send invitation", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Pending invitations" })).toContainText("invited-reviewer@example.test");
	let invitationUrl = "";
	await expect
		.poll(async () => {
			const rows = await (await page.request.get(process.env.PAB_TEST_MAIL_URL + "/api/v1/messages")).json();
			for (const item of rows.messages) {
				if (item.Subject !== "You're invited to Payload Bay") continue;
				const message = await (await page.request.get(process.env.PAB_TEST_MAIL_URL + "/api/v1/message/" + item.ID)).json();
				invitationUrl = message.Text.match(/https?:\/\/[^\s]+\/invitations\/[A-Za-z0-9_-]+/)?.[0] ?? "";
			}

			return Boolean(invitationUrl);
		})
		.toBe(true);
	await context.clearCookies();
	await page.goto(invitationUrl);
	await expect(page.getByLabel("Email address")).toHaveValue("invited-reviewer@example.test");
	await signInBrowser(page, "invited-reviewer@example.test");
	await page.goto(invitationUrl);
	await page.getByRole("button", { name: "Accept invitation", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "$"));
	const invited = await (await page.request.get("/api/v1/me")).json();
	expect(invited.permissions).toEqual([]);
	const visible = await (await page.request.get("/api/v1/projects")).json();
	expect(visible.map((item: { id: string }) => item.id)).toEqual([project.id]);
});

test("workspace notification rules and personal email preferences use separate controls", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers: commandHeaders(), data: { parentId: me.instanceId, name: "Alert workspace", slug: "alert-workspace" } })).json();
	await page.goto("/workspaces/" + workspace.id + "/notifications");
	await page.getByRole("button", { name: "Create notification rule", exact: true }).click();
	await expect(page.getByLabel("Rule ingress route", { exact: true })).toHaveCount(0);
	await page.getByText("Enable failure notifications", { exact: true }).click();
	await page.getByRole("button", { name: "Save notification rule", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Notification rule status" })).toBeVisible();
	const rules = await (await page.request.get("/api/v1/workspaces/" + workspace.id + "/notification-rules")).json();
	expect(rules).toHaveLength(1);
	expect(rules[0].workspaceId).toBe(workspace.id);
	expect(rules[0].projectId).toBeNull();
	await page.goto("/account/notifications");
	const email = page.getByRole("switch", { name: "Email alerts for Alert workspace: 1 failure in 60 seconds", exact: true });
	await expect(email).not.toBeChecked();
	await email.press("Space");
	await expect(email).toBeChecked();
	const preferences = await (await page.request.get("/api/v1/workspaces/" + workspace.id + "/notification-subscriptions")).json();
	expect(preferences[0].smtpEnabled).toBe(true);
});
