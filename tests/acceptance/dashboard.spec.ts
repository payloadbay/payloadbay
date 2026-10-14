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
	await expect(page.getByRole("alertdialog", { name: "Authentication error", exact: true })).toContainText("Check the database and SMTP configuration");
	unavailable = false;
	await page.getByRole("button", { name: "Retry setup check" }).click();
	await expect(page.getByLabel("Your name")).toBeVisible();
	await expect(page.getByLabel("Setup secret")).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Authentication error", exact: true })).toHaveCount(0);
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
	await expect(page).toHaveURL(/\/dashboard$/);
	const me = await page.request.get("/api/v1/me");
	expect(me.status()).toBe(200);
	expect((await me.json()).user.email).toBe("browser@example.test");
	await page.goto("/login");
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
	await page.getByLabel("Email address").fill("browser@example.test");
	await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
	await page.getByLabel("Sign-in code").fill(await code(1));
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
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
	await page.goto("/dashboard");
	await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Visible project" })).toBeVisible();
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
	await expect(page.getByLabel("Ingress fixed signature")).toContainText("async function ingress(ctx: IngressContext)");
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Processing", exact: true }).click();
	await expect(page.getByLabel("Processing fixed signature")).toContainText("async function processEvent(ctx: ProcessingContext)");
	await expect(page.getByRole("textbox", { name: "Processing code", exact: true })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toHaveCount(0);
});

test("U75 copied template remains editable and leaves future copies unchanged", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { unverifiedTemplate } = await import("../../packages/script-sdk/src/templates/unverified.ts");
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
	await page.keyboard.insertText('return ctx.respondOnly({status:200,body:"my custom copy"});');
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Draft saved");
	const saved = await (await page.request.get("/api/v1/endpoints/" + first.id + "/drafts/ingress")).json();
	expect(saved.body).toContain("my custom copy");
	expect(saved.body).not.toBe(unverifiedTemplate.body);
	await page.goto("/projects/" + project.id + "/routes/" + second.id);
	await page.getByLabel("Ingress template").selectOption("unverified");
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Draft saved");
	const another = await (await page.request.get("/api/v1/endpoints/" + second.id + "/drafts/ingress")).json();
	expect(another.body, "New template copies must keep the original editable source").toBe(unverifiedTemplate.body);
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
	await expect(page.getByRole("button", { name: "Create a secret version", exact: true }), "Secret version controls must be available").toBeVisible();
	await page.getByRole("button", { name: "Create a secret version", exact: true }).click();
	await page.getByLabel("Secret name").fill("Signing key");
	await page.getByLabel("Secret value").fill("fixture-private-signing-key");
	await page.getByRole("button", { name: "Create secret version", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Secret status", exact: true })).toContainText("Secret version created");
	await page.getByRole("button", { name: "Bind secret version", exact: true }).click();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Draft saved");
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
	await expect(page.getByRole("table", { name: "Stored events" }), "Event inspection screen must exist").toBeVisible();
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

	await expect(page.getByRole("table", { name: "Stored events" }), "Committed events must appear without manual refresh").toBeVisible({ timeout: 6000 });
	await expect(page.getByRole("button", { name: /Inspect event/ })).toHaveCount(1);
});

test("U276 administrator opens and personally dismisses runtime advice", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.goto("/dashboard");
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
	await expect(page.getByLabel("Middleware fixed signature")).toContainText("ProcessingMiddlewareContext");
	await page.getByRole("button", { name: "Save middleware", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Middleware saved");
	await expect(page.getByRole("heading", { name: "Project policy", exact: true })).toBeVisible();
	const bindings = await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json();
	expect(bindings).toHaveLength(1);
	expect(bindings[0].scope.id).toBe(project.id);
	expect(bindings[0].stage).toBe("processing");
});

test("U83 route editor binds helper version and shows generated imports above body", async ({ page }) => {
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
	await expect(page.getByLabel("Shared helper version"), "Shared helper controls must exist").toBeVisible();
	await page.getByLabel("Shared helper version").selectOption(helper.id);
	await page.getByRole("button", { name: "Bind helper version", exact: true }).click();
	await expect(page.getByLabel("Ingress fixed signature")).toContainText('import * as Helpers from "@shared/Helpers";');
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText("return ctx.respondOnly({status:200,body:Helpers.message()});");
	await page.getByRole("button", { name: "Publish both stages", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Published", { timeout: 20000 });
	const endpoint = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	const response = await page.request.post(endpoint.ingressUrl, { data: "fixture" });
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe("from shared helper");
});

test("U293 project navigation opens scoped code management", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Navigation workspace", slug: "navigation-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Navigation project", slug: "navigation-project" } })).json();
	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("link", { name: "Code and middleware", exact: true }), "Project code navigation must exist").toBeVisible();
	await page.getByRole("link", { name: "Code and middleware", exact: true }).click();
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
	await page.getByRole("link", { name: "Project members", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Project members", exact: true }), "Project member page must exist").toBeVisible();
	await expect(page.getByRole("heading", { name: "Browser owner", exact: true })).toBeVisible();
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
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true }), "Save success must use a toast").toBeVisible();
	await expect(page.locator("main").getByRole("status", { name: "Script status" })).toHaveCount(0);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
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
	await expect(page.getByRole("button", { name: "Test ingress (dry)", exact: true }), "Route editor synthetic test must exist").toBeVisible();
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('return ctx.respondOnly({status:200,body:"synthetic:"+new TextDecoder().decode(ctx.request.body)});');
	await page.getByLabel("Synthetic request body", { exact: true }).fill("hello");
	await page.getByRole("button", { name: "Test ingress (dry)", exact: true }).click();
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("synthetic:hello", { timeout: 20000 });
	await expect(page.locator('[data-slot="toast"]').filter({ hasText: "Synthetic test completed" })).toBeVisible();
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

test("U302 repeated saves show fresh dismissible toast feedback", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const me = await (await page.request.get("/api/v1/me")).json();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: me.instanceId, name: "Repeat workspace", slug: "repeat-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Repeat project", slug: "repeat-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Repeat route", slug: "repeat-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	const toast = page.getByRole("alertdialog", { name: "Script status", exact: true });
	await expect(toast).toContainText("Draft saved");
	await toast.hover();
	await toast.getByRole("button", { name: "Close", exact: true }).click();
	await expect(toast).toHaveCount(0);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(toast, "Repeated saves must show fresh toast feedback").toContainText("Draft saved");
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
	await expect(page.getByRole("link", { name: "Notification rules", exact: true }), "Project notification configuration must be discoverable").toBeVisible();
	await page.getByRole("button", { name: "Project notifications", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Project notifications", exact: true })).toBeVisible();
	await expect(page.getByText("No active notifications.", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("link", { name: "Notification rules", exact: true }).click();
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
