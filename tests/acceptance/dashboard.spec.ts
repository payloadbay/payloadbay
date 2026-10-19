import { chooseOption } from "../helpers/select-option.ts";
import { test, expect } from "../helpers/browser-test.ts";
import { browserOrganization } from "../helpers/browser-auth.ts";
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
	await page.clock.install();
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
	await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
	await page.getByLabel("Sign-in code").fill(await code());
	await page.getByRole("button", { name: "Create owner and continue" }).click();
	await expect(page).toHaveURL(/\/$/);
	const me = await page.request.get("/api/v1/me");
	expect(me.status()).toBe(200);
	expect((await me.json()).user.email).toBe("browser@example.test");
	const pool = (await import("../../packages/domain/src/db.ts")).database(process.env.DATABASE_URL!);
	try {
		await pool.query("UPDATE payloadbay.auth_request_window SET window_started_at=clock_timestamp()-interval '31 seconds' WHERE key LIKE 'otp-cooldown:%'");
	} finally {
		await pool.end();
	}

	await page.clock.fastForward(31_000);
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
	const workspaceResponse = await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Browser workspace", slug: "browser-workspace" } });
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
	await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
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
	await chooseOption(page.getByRole("button", { name: new RegExp("Role preset") }), "admin");
	await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	const unchanged = await (await page.request.get("/api/v1/members?scopeType=instance&scopeId=" + me.instanceId)).json();
	expect(unchanged.find((member: { user_id: string }) => member.user_id === memberId).role_preset).toBe("viewer");
	await page.getByRole("button", { name: "Edit permissions for Editable member" }).click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("button", { name: "Edit permissions for Editable member" }).click();
	await chooseOption(page.getByRole("button", { name: new RegExp("Role preset") }), "operator");
	await expect(page.getByRole("checkbox", { name: "Read event payloads", exact: true })).toBeChecked();
	await page.getByText("Read event payloads", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Read event payloads", exact: true })).not.toBeChecked();
	await page.getByText("Read audit history", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Read audit history", exact: true })).toBeChecked();
	await expect(page.getByLabel("Role preset")).toContainText("Custom");
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Delivery workspace", slug: "delivery-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Delivery project", slug: "delivery-project" } })).json();
	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("heading", { name: "Delivery project", exact: true }), "Project detail must be available").toBeVisible();
	await page.getByRole("button", { name: "Add destination", exact: true }).click();
	await page.getByLabel("Name", { exact: true }).fill("Application");
	await page.getByLabel("Destination URL").fill(process.env.PAB_TEST_HTTP_URL + "/delivery");
	await page.getByRole("button", { name: "Create destination", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Destinations", exact: true }).getByRole("row", { name: /Application/ })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Destinations", exact: true })).toContainText("Default");
	await page.getByRole("button", { name: "Add ingress route", exact: true }).click();
	await page.getByLabel("Name", { exact: true }).fill("Stripe");
	await page.getByRole("button", { name: "Create ingress route", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Ingress routes", exact: true }).getByRole("row", { name: /Stripe/ })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Ingress routes", exact: true })).toContainText("Draft");
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Editor workspace", slug: "editor-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Editor project", slug: "editor-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Editable route", slug: "editable" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=code");
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Template workspace", slug: "template-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Template project", slug: "template-project" } })).json();

	const create = async (slug: string) => (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: slug, slug } })).json();

	const first = await create("first");
	const second = await create("second");
	await page.goto("/projects/" + project.id + "/routes/" + first.id + "?section=code");
	await chooseOption(page.getByRole("button", { name: new RegExp("Ingress template") }), "unverified");
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"my custom copy"}); }');
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved / Not published", { exact: true })).toBeVisible();
	const saved = await (await page.request.get("/api/v1/endpoints/" + first.id + "/drafts/ingress")).json();
	expect(saved.body).toContain("my custom copy");
	expect(saved.body).not.toBe(unverifiedHttpTemplate.source);
	await page.goto("/projects/" + project.id + "/routes/" + second.id + "?section=code");
	await chooseOption(page.getByRole("button", { name: new RegExp("Ingress template") }), "unverified");
	await expect(page.getByRole("textbox", { name: "Ingress code", exact: true })).toBeAttached();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved / Not published", { exact: true })).toBeVisible();
	const another = await (await page.request.get("/api/v1/endpoints/" + second.id + "/drafts/ingress")).json();
	expect(another.body.replace(/\s/g, ""), "New template copies must preserve source while applying project formatting").toBe(unverifiedHttpTemplate.source.replace(/\s/g, ""));
});

test("U265 route editor binds an encrypted signing secret version", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Secret workspace", slug: "secret-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Secret project", slug: "secret-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Signed route", slug: "signed" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=code");
	await chooseOption(page.getByRole("button", { name: new RegExp("Ingress template") }), "hmac");
	await page.getByRole("row", { name: "Secrets", exact: true }).click();
	await expect(page.getByRole("button", { name: "Create secret version", exact: true }), "Secret version controls must be available").toBeVisible();
	await page.getByRole("button", { name: "Create secret version", exact: true }).click();
	await expect(page.getByLabel("Secret key")).toHaveValue("");
	await page.getByLabel("Secret key").fill("SIGNING_SECRET");
	await page.getByLabel("Secret value").fill("fixture-private-signing-key");
	await page.getByRole("dialog").getByRole("button", { name: "Create secret version", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Secret status", exact: true })).toContainText("Secret version created");
	await expect(page.getByRole("checkbox", { name: "SIGNING_SECRET v1 available in ingress" })).toBeChecked();
	await expect(page.getByRole("checkbox", { name: "SIGNING_SECRET v1 available in processing" })).toBeChecked();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
	const draft = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	const versions = await (await page.request.get("/api/v1/secrets?scopeType=project&scopeId=" + project.id)).json();
	expect(draft.secret_bindings.SIGNING_SECRET).toBe(versions[0].id);
	expect(JSON.stringify(draft)).not.toContain("fixture-private-signing-key");
	expect(JSON.stringify(versions)).not.toContain("fixture-private-signing-key");
});

test("U116 event inspector displays HTML payload as escaped text", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Inspector workspace", slug: "inspector-workspace" } })).json();
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
		const execution = (await pool.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state,final_result) VALUES($1,$2,$3,'succeeded','{\"kind\":\"complete\"}') RETURNING id", [event, route.id, publication.id])).rows[0].id;
		await pool.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'primary','fixture','{}',1)", [execution]);
		await pool.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,started_at,ended_at,status_code,response_body) VALUES($1,'primary',1,1,now()-interval '1 second',now(),503,$2),($1,'primary',2,1,now(),now(),204,''::bytea)", [execution, Buffer.from("Receiver is offline")]);
	} finally {
		await pool.end();
	}

	await page.goto("/events");
	await chooseOption(page.getByRole("button", { name: new RegExp("Event workspace") }), workspace.id);
	await chooseOption(page.getByRole("button", { name: new RegExp("Event project") }), project.id);
	await chooseOption(page.getByRole("button", { name: new RegExp("Event route") }), route.id);
	await page.getByRole("button", { name: /Processing version filter/ }).click();
	await page.getByRole("option", { name: /^v1\b/ }).click();
	await page.getByRole("button", { name: "Refresh events", exact: true }).click();
	await expect(page.getByRole("grid", { name: "Stored events" }), "Event inspection screen must exist").toBeVisible();
	await page.getByRole("button", { name: /Inspect event/ }).click();
	await expect(page.getByLabel("Original request body")).toHaveText(body);
	await expect(page.getByLabel("Accepted event body")).toHaveText(body);
	await expect(page.locator('img[src="x"]')).toHaveCount(0);
	expect(await page.evaluate(() => Boolean((globalThis as typeof globalThis & { PAYLOADBAY_ATTACKED?: boolean }).PAYLOADBAY_ATTACKED))).toBe(false);
	await page.getByRole("tab", { name: "Processing", exact: true }).click();
	await expect(page.getByText("Handler completed", { exact: true }).last()).toBeVisible();
	await page.getByRole("tab", { name: "Outgoing", exact: true }).click();
	await expect(page.getByLabel("Selected delivery attempt")).toContainText("HTTP 204");
	await expect(page.getByRole("button", { name: /Delivery attempt/ })).toContainText("HTTP 204");
	await page.getByRole("button", { name: /Delivery attempt/ }).click();
	await page.getByRole("option", { name: /HTTP 503/ }).click();
	await expect(page.getByLabel("Delivery response body")).toHaveText("Receiver is offline");
	await page.getByRole("tab", { name: "Ingress", exact: true }).click();
	await page.getByRole("tab", { name: "Outgoing", exact: true }).click();
	await expect(page.getByLabel("Selected delivery attempt")).toContainText("HTTP 503");
	await page.getByRole("button", { name: /Delivery attempt/ }).click();
	await page.getByRole("option", { name: /HTTP 204/ }).click();
	await expect(page.getByLabel("Selected delivery attempt")).toContainText("HTTP 204");
	const dialog = page.getByRole("dialog", { name: "Event inspection" });
	const bounds = await dialog.boundingBox();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.width).toBeLessThanOrEqual(390);
	await page.screenshot({ path: test.info().outputPath("attempt-inspector-mobile.png") });
	await dialog.getByRole("button", { name: /close/i }).first().click();
	await expect(page.getByRole("button", { name: "Delivery attempts", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: /History status/ }).click();
	await page.getByRole("option", { name: "Delivery failed", exact: true }).click();
	await page.keyboard.press("Escape");
	// Valid filters with no matching event are an empty result, never a validation error.
	await expect(page.getByText("No matching entries", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: /History status/ }).click();
	await page.getByRole("option", { name: "Delivery failed", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("grid", { name: "Stored events" })).toBeVisible();
	const entry = (await (await page.request.get("/api/v1/projects/" + project.id + "/events")).json()).items[0];
	const originalHistory = await (await page.request.get("/api/v1/events/" + entry.id)).json();
	const before = originalHistory.executions.length;
	const selectVisible = page.getByRole("checkbox", { name: "Select visible replayable events", exact: true });
	await page.locator("label").filter({ has: selectVisible }).click();
	await expect(selectVisible).toBeChecked();
	await page.getByRole("button", { name: "Replay selected events", exact: true }).click();
	const replayDialog = page.getByRole("dialog", { name: "Replay selected events", exact: true });
	await expect(replayDialog).toContainText("1 selected events");
	await chooseOption(replayDialog.getByRole("button", { name: new RegExp("Bulk replay version policy") }), "current");
	await replayDialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(replayDialog).not.toBeVisible();
	expect((await (await page.request.get("/api/v1/events/" + entry.id)).json()).executions).toHaveLength(before);
	await page.getByRole("button", { name: "Replay selected events", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(replayDialog).not.toBeVisible();
	await page.getByRole("button", { name: "Replay selected events", exact: true }).click();
	await replayDialog.getByRole("button", { name: "Queue replay", exact: true }).click();
	await expect(replayDialog).not.toBeVisible();
	await expect.poll(async () => (await (await page.request.get("/api/v1/events/" + entry.id)).json()).executions.length).toBe(before + 1);
	// U158: successful replay creates a separate execution without changing the original.
	const replayedHistory = await (await page.request.get("/api/v1/events/" + entry.id)).json();
	expect(replayedHistory.executions.find((execution: { id: string }) => execution.id === originalHistory.executions[0].id)).toEqual(originalHistory.executions[0]);
	expect(replayedHistory.executions[0].replay_of_id).toBe(originalHistory.executions[0].id);
	expect(replayedHistory.executions[0].state).toBe("queued");
	expect(replayedHistory.attempts).toEqual(originalHistory.attempts);
	await page.getByRole("button", { name: "Inspect event " + entry.id.slice(0, 8), exact: true }).click();
	const replayInspector = page.getByRole("dialog", { name: "Event inspection", exact: true });
	await replayInspector.getByRole("tab", { name: "Processing", exact: true }).click();
	await expect(replayInspector.getByText("Handler completed", { exact: true })).toBeVisible();
	await expect(replayInspector.getByText("Accepted / queued", { exact: true })).toBeVisible();
	await replayInspector.getByRole("button", { name: "Replay event", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/events/" + entry.id)).json()).executions.length).toBe(before + 2);
	await replayInspector.getByRole("button", { name: "Close", exact: true }).click();
	await expect(replayInspector).toHaveCount(0);
	await page.getByRole("button", { name: "Select events", exact: true }).click();
	await page.getByRole("menuitem", { name: "All matching events", exact: true }).click();
	await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Clear selection", exact: true }).click();
	await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select events", exact: true }).click();
	await page.getByRole("menuitem", { name: "Choose status and version…", exact: true }).click();
	const selection = page.getByRole("dialog", { name: "Select events by status and version", exact: true });
	await chooseOption(selection.getByRole("button", { name: new RegExp("Selection status") }), "delivered");
	await selection.getByRole("button", { name: "Select matching events", exact: true }).click();
	await expect(selection).toHaveCount(0);
	await expect(page.getByRole("button", { name: /Inspect event/ })).toHaveCount(1);
	await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
});

test("U275 stored event appears through authenticated live updates", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Live workspace", slug: "live-workspace" } })).json();
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
	await page.getByRole("button", { name: "Scripts use ordinary Docker containment", exact: true }).click();
	await expect(page.getByText(/PAYLOADBAY_EXECUTOR_RUNTIME=runsc/)).toBeVisible();
	await page.getByRole("button", { name: "Dismiss notification Scripts use ordinary Docker containment", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("No active notifications.", { exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("No active notifications.", { exact: true })).toBeVisible();
});

test("U292a shared helpers preserve immutable revisions when edited and copied", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Code workspace", slug: "code-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Code project", slug: "code-project" } })).json();
	await page.goto("/code/project/" + project.id);
	await expect(page.getByRole("heading", { name: "Code and middleware", exact: true }), "Code management page must be available").toBeVisible();
	await page.getByRole("button", { name: "Create helper", exact: true }).click();
	await page.getByLabel("Helper name", { exact: true }).fill("Messages");
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	const code = page.getByRole("textbox", { name: "Shared helper code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate(() => navigator.clipboard.writeText('export function message(){return "shared";}'));
	await page.keyboard.press("ControlOrMeta+V");
	await expect(page.locator(".monaco-editor .view-lines")).toContainText("shared");
	await page.getByRole("button", { name: "Save helper version", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Saved a new immutable helper version");
	await expect(page.getByRole("row").filter({ hasText: "Messages" }).first()).toBeVisible();
	await page.getByRole("button", { name: "Edit as new version", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("button", { name: "Edit as new version", exact: true }).click();
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate(() => navigator.clipboard.writeText('export function message(){return "shared v2";}'));
	await page.keyboard.press("ControlOrMeta+V");
	await expect(page.locator(".monaco-editor .view-lines")).toContainText("shared v2");
	await page.keyboard.press("ControlOrMeta+s");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	const helperVersions = await (await page.request.get("/api/v1/shared-code?scopeType=project&scopeId=" + project.id)).json();
	const newestHelper = await (await page.request.get("/api/v1/shared-code/" + helperVersions[0].id)).json();
	expect(newestHelper.source).toContain("shared v2");
	await page.getByRole("row").filter({ hasText: "Messages" }).first().getByRole("button", { name: "Copy helper Messages", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/shared-code?scopeType=project&scopeId=" + project.id)).json())[0].originRevisionId).toBe(newestHelper.id);
	const copiedHelpers = await (await page.request.get("/api/v1/shared-code?scopeType=project&scopeId=" + project.id)).json();
	const copiedSource = await (await page.request.get("/api/v1/shared-code/" + copiedHelpers[0].id)).json();
	expect(copiedSource.source).toBe(newestHelper.source);
	expect((await (await page.request.get("/api/v1/shared-code/" + newestHelper.id)).json()).source).toBe(newestHelper.source);
});

test("U292b middleware editing and ordering preserve their saved configuration", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Middleware controls", slug: "middleware-controls" } })).json();
	await page.goto("/code/project/" + project.id);

	await page.getByRole("tab", { name: "Middleware", exact: true }).click();
	await page.getByRole("button", { name: "Create middleware", exact: true }).click();
	await page.getByLabel("Middleware name", { exact: true }).fill("Project policy");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware stage") }), "ingress");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware stage") }), "processing");
	await page.getByRole("textbox", { name: /^Position/ }).fill("5");
	await page.getByRole("textbox", { name: /^Position/ }).press("Tab");
	await page.getByRole("textbox", { name: /^Position/ }).fill("0");
	await page.getByRole("textbox", { name: /^Position/ }).press("Tab");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware failure behavior") }), "optional");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware failure behavior") }), "required");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware child overrides") }), "forbidden");
	await chooseOption(page.getByRole("button", { name: new RegExp("Middleware required failure outcome") }), "fail");
	await expect(page.locator(".monaco-editor .view-lines").first()).toContainText("ProcessingMiddlewareContext");
	await page.getByRole("button", { name: "Save middleware", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Code status", exact: true })).toContainText("Middleware saved");
	await expect(page.getByRole("heading", { name: "Project policy", exact: true })).toBeVisible();
	const bindings = await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json();
	expect(bindings).toHaveLength(1);
	expect(bindings[0].scope.id).toBe(project.id);
	expect(bindings[0].stage).toBe("processing");
	expect(bindings[0].overridePolicy).toBe("forbidden");
	expect(bindings[0].requiredAction).toBe("fail");
	await expect(page.getByRole("grid", { name: "Middleware execution order" })).toBeVisible();
	const secondResponse = await page.request.post("/api/v1/middleware", {
		headers,
		data: {
			scope: { type: "project", id: project.id },
			stage: "processing",
			name: "Second policy",
			body: "return ctx.continue();",
			position: 1,
			failurePolicy: "required",
			overridePolicy: "allowed",
		},
	});
	expect(secondResponse.ok()).toBe(true);
	await page.reload();
	await page.getByRole("tab", { name: "Middleware", exact: true }).click();
	await page.getByRole("button", { name: "Move Second policy up", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json())[0].name).toBe("Second policy");
	await page.getByRole("button", { name: "Move Second policy down", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json())[0].name).toBe("Project policy");
	await page.getByRole("button", { name: "Edit middleware Project policy", exact: true }).click();
	await page.getByLabel("Middleware name", { exact: true }).fill("Updated project policy");
	await page.getByRole("button", { name: "Save middleware", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/middleware?scopeType=project&scopeId=" + project.id)).json())[0].name).toBe("Updated project policy");
});

test("U83 route editor binds helper version and supports editable file imports", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Import workspace", slug: "import-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Import project", slug: "import-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Imported route", slug: "imported" } })).json();
	const created = await page.request.post("/api/v1/shared-code", { headers, data: { scope: { type: "project", id: project.id }, name: "Messages", source: 'export function message(){return "from shared helper";}\nexport function unused(){return "not imported";}' } });
	expect(created.status()).toBe(200);
	const helper = await created.json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=code");
	await expect(page.getByRole("row", { name: "Helper imports", exact: true })).toHaveCount(0);
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await page.getByRole("button", { name: "Import helper", exact: true }).click();
	const picker = page.getByRole("dialog", { name: "Import helper", exact: true });
	await picker.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(picker).not.toBeVisible();
	await expect(page.locator(".monaco-editor .view-lines").first()).not.toContainText("@shared/Messages");
	await page.getByRole("button", { name: "Import helper", exact: true }).click();
	await picker.getByRole("button", { name: /Helper revision/ }).click();
	await page.getByRole("option", { name: /Messages/ }).click();
	await picker.getByRole("button", { name: /Helper exports/ }).click();
	await page.getByRole("option", { name: "unused", exact: true }).click();
	await page.keyboard.press("Escape");
	await picker.getByRole("button", { name: "Insert import", exact: true }).click();
	await expect(picker).not.toBeVisible();
	await expect(page.locator(".monaco-editor .view-lines").first()).toContainText('import { message } from "@shared/Messages"');

	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('import { message } from "@shared/');
	await page.keyboard.press("ControlOrMeta+Space");
	await expect(page.getByRole("option", { name: /@shared\/Messages/ }).first()).toBeVisible();
	await page.keyboard.press("Escape");
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('import {  } from "@shared/Messages";');
	await page.keyboard.press("ControlOrMeta+Home");
	for (let index = 0; index < 9; index++) await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ControlOrMeta+Space");
	await expect(page.getByRole("option", { name: /^message\b/ }).first()).toBeVisible();
	await page.keyboard.press("Escape");
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('import { message } from "@shared/Messages";\nexport async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:message()}); }\nexport async function GET(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"ready"}); }');
	await page.getByRole("button", { name: "Publish both stages", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toContainText("Published", { timeout: 20000 });
	const endpoint = await (await page.request.get("/api/v1/endpoints/" + route.id)).json();
	const response = await page.request.post(endpoint.ingressUrl, { data: "fixture" });
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe("from shared helper");
	await expect.poll(async () => (await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json()).shared_bindings.Messages).toBe(helper.id);
	await page.getByRole("row", { name: "Playground", exact: true }).click();
	await chooseOption(page.getByRole("button", { name: new RegExp("HTTP method") }), "GET");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByText("HTTP 200", { exact: true })).toBeVisible();
	await expect(page.getByText("ready", { exact: true })).toBeVisible();
});

test("U293 project navigation opens scoped code management", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Navigation workspace", slug: "navigation-workspace" } })).json();
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Member workspace", slug: "member-workspace" } })).json();
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Toast workspace", slug: "toast-workspace" } })).json();
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
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Test workspace", slug: "test-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Test project", slug: "test-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Test route", slug: "test-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=code");
	const code = page.getByRole("textbox", { name: "Ingress code", exact: true });
	await code.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.insertText('export async function PATCH(ctx: IngressContext): Promise<IngressDecision> { ctx.log.info("Fixture processed"); ctx.log.warn("Review warning"); return ctx.respondOnly({status:200,body:"synthetic:"+new TextDecoder().decode(ctx.request.body)+":"+ctx.request.headers["x-review"]+":"+(ctx.secrets.MODE === "synthetic" ? "configured" : "missing")}); }');
	await page.getByRole("row", { name: "Script test", exact: true }).click();
	await chooseOption(page.getByRole("button", { name: new RegExp("Synthetic HTTP method") }), "PATCH");
	await chooseOption(page.getByRole("button", { name: new RegExp("Body format") }), "plaintext");
	for (const [tab, label, value] of [
		["Body", "Synthetic request body", "hello"],
		["Headers", "Synthetic headers", '{"x-review":"review"}'],
		["Sample secrets", "Synthetic secrets", '{"MODE":"synthetic"}'],
	]) {
		await page.getByRole("tab", { name: tab, exact: true }).click();
		const editor = page.getByRole("textbox", { name: label, exact: true });
		await editor.focus();
		await page.keyboard.press("ControlOrMeta+A");
		await page.evaluate((text) => navigator.clipboard.writeText(text), value);
		await page.keyboard.press("ControlOrMeta+V");
	}

	await page.getByRole("tab", { name: "Checks", exact: true }).click();
	await chooseOption(page.getByRole("button", { name: new RegExp("Expected decision") }), "respondOnly");
	await page.getByRole("combobox", { name: "Expected HTTP status", exact: true }).fill("200");
	await page.getByLabel("Response body contains", { exact: true }).fill("synthetic:hello");
	await page.getByRole("button", { name: "Test ingress (dry)", exact: true }).click();
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("synthetic:hello:review:configured", { timeout: 20000 });
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("3/3 checks passed");
	await expect(page.locator('[data-slot="toast"]').filter({ hasText: "Synthetic test completed" })).toHaveCount(0);
	await chooseOption(page.getByRole("button", { name: new RegExp("Log level") }), "warn");
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("Review warning");
	await expect(page.getByLabel("Synthetic test result", { exact: true })).not.toContainText("Fixture processed");
	await page.getByRole("textbox", { name: "Search execution logs", exact: true }).fill("not-a-matching-message");
	await expect(page.getByText("No logs match these filters.", { exact: true })).toBeVisible();
	await page.getByRole("textbox", { name: "Search execution logs", exact: true }).clear();
	await chooseOption(page.getByRole("button", { name: new RegExp("Script stage") }), "processing");
	await page.getByRole("button", { name: "Test processing (dry)", exact: true }).click();
	await expect(page.getByLabel("Synthetic test result", { exact: true })).toContainText("complete", { timeout: 20000 });
	const saved = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	expect(saved.version).toBe(1);
	expect(saved.body).not.toContain("synthetic:");
	const events = await (await page.request.get("/api/v1/projects/" + project.id + "/events")).json();
	expect(events.items).toHaveLength(0);

	const beforeUnload = page.waitForEvent("dialog");
	const cancelledReload = page.reload({ timeout: 3000 }).then(
		() => null,
		(error: Error) => error,
	);
	const prompt = await beforeUnload;
	expect(prompt.type()).toBe("beforeunload");
	await prompt.dismiss();
	await cancelledReload;
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "/routes/" + route.id));
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Discard unsaved changes?", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Keep editing", exact: true }).click();
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("heading", { name: "Discard unsaved changes?", exact: true })).toHaveCount(0);
	await page.getByRole("link", { name: "Back to project", exact: true }).click();
	await page.getByRole("button", { name: "Discard changes", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Test project", exact: true })).toBeVisible();
	const unchangedDraft = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	expect(unchangedDraft).toEqual(saved);
});

test("U301 code creation follows workspace and project page scope", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Scope workspace", slug: "scope-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Scope project", slug: "scope-project" } })).json();
	await page.goto("/code/project/" + project.id);
	await expect(page.getByLabel("Code scope", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("navigation", { name: "Breadcrumbs", exact: true }).getByRole("link", { name: "Scope project", exact: true })).toBeVisible();
	await expect(page.getByText("Scope: this project", { exact: true })).toHaveCount(0);
	await page.goto("/code/workspace/" + workspace.id);
	await expect(page.getByRole("button", { name: "Create helper", exact: true })).toBeVisible();
	await expect(page.getByLabel("Code scope", { exact: true })).toHaveCount(0);
	await page.goto("/code/project/" + project.id);
	await expect(page.getByRole("button", { name: "Create helper", exact: true })).toBeVisible();
});

test("U302 repeated saves retain a clear saved state without redundant toasts", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Repeat workspace", slug: "repeat-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Repeat project", slug: "repeat-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Repeat route", slug: "repeat-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=code");
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved / Not published", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved / Not published", { exact: true })).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Script status", exact: true })).toHaveCount(0);
});

test("U131 inherited middleware shows provenance and copies a local override", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Policy workspace", slug: "policy-workspace" } })).json();
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
	const inherited = page.getByRole("row").filter({ has: page.getByRole("heading", { name: "Parent policy", exact: true }) });
	await expect(inherited, "Inherited scope must be visible").toContainText("workspace / Policy workspace");
	await expect(inherited).toContainText("Inherited");
	await expect(inherited.getByRole("button", { name: "Edit middleware", exact: true })).toHaveCount(0);
	await expect(
		page
			.getByRole("row")
			.filter({ has: page.getByRole("heading", { name: "Locked policy", exact: true }) })
			.getByRole("button", { name: "Create local override", exact: true }),
	).toHaveCount(0);
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Rules workspace", slug: "rules-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Rules project", slug: "rules-project" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Stripe route", slug: "stripe" } })).json();
	const destinationResponse = await page.request.post("/api/v1/projects/" + project.id + "/destinations", { headers, data: { name: "Rule target", url: process.env.PAB_TEST_HTTP_URL + "/delivery" } });
	expect(destinationResponse.status()).toBe(200);
	const destination = await destinationResponse.json();
	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("row", { name: "Notification rules", exact: true }), "Project notification configuration must be discoverable").toBeVisible();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Dismiss notification Scripts use ordinary Docker containment", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByText("No active notifications.", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("row", { name: "Notification rules", exact: true }).click();
	await expect(page.getByRole("heading", { name: "No failure notification rules", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create notification rule", exact: true }).click();
	const enabled = page.getByRole("switch", { name: "Enable failure notifications", exact: true });
	await expect(enabled).not.toBeChecked();
	await page.getByText("Enable failure notifications", { exact: true }).click();
	await expect(enabled).toBeChecked();
	await chooseOption(page.getByRole("button", { name: new RegExp("Rule ingress route") }), route.id);
	await chooseOption(page.getByRole("button", { name: new RegExp("Rule destination") }), destination.id);
	await page.getByRole("textbox", { name: /^Failure threshold/ }).fill("3");
	await page.getByRole("textbox", { name: /^Window in seconds/ }).fill("120");
	await page.getByRole("textbox", { name: /^Cooldown in seconds/ }).fill("30");
	await chooseOption(page.getByRole("button", { name: new RegExp("Rule severity") }), "critical");
	await chooseOption(page.getByRole("button", { name: new RegExp("Rule recovery policy") }), "manual");
	await page.getByRole("button", { name: "Save notification rule", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Notification rule status", exact: true })).toContainText("Notification rule saved");
	let rules = await (await page.request.get("/api/v1/projects/" + project.id + "/notification-rules")).json();
	expect(rules).toHaveLength(1);
	expect(rules[0].count).toBe(3);
	expect(rules[0].windowSeconds).toBe(120);
	expect(rules[0].cooldownSeconds).toBe(30);
	expect(rules[0].severity).toBe("critical");
	expect(rules[0].recoveryPolicy).toBe("manual");
	expect(rules[0].enabled).toBe(true);
	expect(rules[0].endpointId).toBe(route.id);
	expect(rules[0].destinationId).toBe(destination.id);
	await page.getByRole("button", { name: "Edit rule", exact: true }).click();
	await expect(page.getByRole("textbox", { name: /^Failure threshold/ })).toHaveValue("3");
	await expect(page.getByRole("button", { name: /Rule severity/ })).toContainText("Critical");
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("button", { name: "Edit rule", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Pause workspace", slug: "pause-workspace" } })).json();
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
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Invitation workspace", slug: "invitation-workspace" } })).json();
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
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers: commandHeaders(), data: { parentId: await browserOrganization(page), name: "Alert workspace", slug: "alert-workspace" } })).json();
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
	await page.locator("label").filter({ has: email }).click();
	await expect(email).toBeChecked();
	const preferences = await (await page.request.get("/api/v1/workspaces/" + workspace.id + "/notification-subscriptions")).json();
	expect(preferences[0].smtpEnabled).toBe(true);
});

test("overview and mobile hierarchy preserve context while search opens resources", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = await (await page.request.post("/api/v1/workspaces", { headers, data: { parentId: await browserOrganization(page), name: "Design workspace", slug: "design-workspace" } })).json();
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Design project", slug: "design-project" } })).json();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
	await expect(page.getByRole("img", { name: /24-hour traffic/ })).toBeVisible();
	await expect(page.getByText("Incoming requests", { exact: true })).toBeVisible();
	await page.setViewportSize({ width: 320, height: 740 });
	const tick = page.locator(".line-chart .recharts-cartesian-axis-tick-value").first();
	await expect(tick).toBeVisible();
	await expect(tick).toHaveCSS("font-size", "12px");
	expect((await tick.boundingBox())!.height).toBeGreaterThanOrEqual(10);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	const searchBar = page.getByRole("button", { name: "Search pages and resources", exact: true });
	await expect(searchBar).toBeVisible();
	const searchSurface = await searchBar.evaluate((button) => {
		const parent = button.parentElement!;
		const style = getComputedStyle(parent);

		return { width: button.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), background: getComputedStyle(button).backgroundColor };
	});
	expect(searchSurface.width).toBeGreaterThanOrEqual(searchSurface.available - 2);
	expect(searchSurface.background).not.toBe("rgba(0, 0, 0, 0)");
	await searchBar.click();
	await expect(page.getByRole("dialog", { name: "Search pages and resources" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: test.info().outputPath("overview-mobile.png"), fullPage: true });
	const toggleBeforeScroll = await page.getByRole("button", { name: "Toggle navigation" }).boundingBox();
	await page.evaluate(() => window.scrollTo(0, 350));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
	expect((await page.getByRole("button", { name: "Toggle navigation" }).boundingBox())!.y).toBeCloseTo(toggleBeforeScroll!.y, 0);

	await page.getByRole("button", { name: "Toggle navigation" }).click();
	const drawer = page.getByRole("dialog");
	await expect(drawer).toBeVisible();
	const globalRows = drawer.getByRole("treegrid", { name: "Instance navigation" }).getByRole("row");
	await expect(globalRows.nth(0)).toContainText("Overview");
	await expect(globalRows.nth(1)).toContainText("Organizations");
	await expect(globalRows.nth(2)).toContainText("Workspaces");
	await expect(drawer.getByRole("row", { name: "Event log", exact: true })).toBeVisible();
	await expect(drawer.getByRole("treegrid", { name: "Instance access" }).getByRole("row", { name: "Instance members", exact: true })).toBeVisible();

	await expect(drawer.getByText("Browse hierarchy", { exact: true })).toHaveCount(0);
	await expect(drawer.getByRole("row", { name: "Search pages and resources", exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(drawer).toHaveCount(0);
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await page.getByRole("button", { name: "Search pages and resources", exact: true }).click();
	const command = page.getByRole("dialog", { name: "Search pages and resources" });
	await expect(command).toBeVisible();
	await command.getByPlaceholder("Search pages and resources…").fill("not a real resource");
	await command.getByRole("button", { name: "Clear search", exact: true }).click();
	await expect(command.getByPlaceholder("Search pages and resources…")).toHaveValue("");
	await command.getByPlaceholder("Search pages and resources…").fill("Design project");
	await command.getByRole("menuitem", { name: "Jump to Design project / Project", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "$"));
	const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumbs", exact: true });
	await expect(breadcrumbs.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
	await expect(breadcrumbs).toContainText("Design project");
	expect((await breadcrumbs.boundingBox())!.width).toBeGreaterThan(330);
	const breadcrumbBounds = (await breadcrumbs.boundingBox())!;
	const currentCrumbBounds = (await breadcrumbs.getByText("Design project", { exact: true }).boundingBox())!;
	expect(currentCrumbBounds.x + currentCrumbBounds.width).toBeLessThanOrEqual(breadcrumbBounds.x + breadcrumbBounds.width);
	expect(currentCrumbBounds.height).toBeLessThanOrEqual(24);
	await page.getByRole("button", { name: "Parent pages", exact: true }).click();
	await expect(breadcrumbs.getByRole("link", { name: "Design workspace", exact: true })).toBeVisible();
	await expect(page.getByRole("menu", { name: "Parent pages", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.screenshot({ path: test.info().outputPath("project-mobile.png"), fullPage: true, animations: "disabled" });
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	await expect(drawer.getByRole("treegrid", { name: "Instance navigation" })).toHaveCount(0);
	await expect(drawer.getByRole("row", { name: "Project members", exact: true })).toBeVisible();
	await page.setViewportSize({ width: 390, height: 460 });
	await expect.poll(async () => (await drawer.boundingBox())!.height).toBeLessThanOrEqual(460);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(async () => (await drawer.boundingBox())!.height).toBeGreaterThan(700);
	await page.screenshot({ path: test.info().outputPath("project-navigation-mobile.png") });

	await expect(drawer.getByRole("row", { name: "Notification rules", exact: true })).toBeVisible();
	await drawer.getByRole("button", { name: "Back to workspace", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "$"));
	await expect(drawer.getByRole("row", { name: "Workspace members", exact: true })).toBeVisible();
	await drawer.getByRole("button", { name: "Back to organization", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "$"));
	await expect(drawer.getByRole("row", { name: "Organization members", exact: true })).toBeVisible();
	await drawer.getByRole("button", { name: "Back to instance", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/projects/" + project.id + "$"));
	await expect(drawer.getByRole("row", { name: "Overview", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(searchBar).toBeVisible();
	await page.screenshot({ path: test.info().outputPath("navigation-desktop.png"), animations: "disabled" });
	await searchBar.click();
	await expect(page.getByRole("dialog", { name: "Search pages and resources" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/projects");
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	const create = page.getByRole("dialog", { name: "New workspace", exact: true });
	await expect(create.getByRole("heading", { name: "New workspace" })).toBeVisible();
	const bounds = await create.boundingBox();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.width).toBeLessThanOrEqual(390);
	await create.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(create).toHaveCount(0);
	await page.getByRole("button", { name: "Account menu" }).click();
	await expect(page.getByRole("menuitem", { name: "Instance members" })).toHaveCount(0);
	await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveClass(/text-danger/);
});

test("instance notification modules remain forkable while enterprise customization is hidden", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/admin/notification-channels");
	await expect(page.getByRole("heading", { name: "Notification modules", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "View and fork" }).click();
	await expect(page.getByText("Built-in template", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Fork module", exact: true }).click();
	await page.getByLabel("Module name", { exact: true }).fill("Review email module");
	const previewResponse = page.waitForResponse((response) => response.url().endsWith("/notification-channels/preview") && response.request().method() === "POST");
	await page.getByRole("button", { name: "Preview output" }).click();
	const previewReply = await previewResponse;
	expect(await previewReply.json()).toMatchObject({ decision: { kind: "email" } });
	await expect(page.getByText("Test result: email", { exact: true })).toBeVisible();
	await expect(page.frameLocator('iframe[title="Notification email preview"]').getByRole("heading", { name: "Delivery failure threshold reached" })).toBeVisible();
	await page.getByRole("button", { name: "Publish version", exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/notification-channels\/[0-9a-f-]{36}$/);
	await expect(page.getByRole("button", { name: /Module version/ })).toContainText("v1 / Active / Latest");
	await page.goto("/admin/installation");
	await expect(page.getByRole("link", { name: "Email settings", exact: true })).toHaveCount(0);
	await expect(page.getByRole("link", { name: "Instance customization", exact: true })).toHaveCount(0);
	const settings = await (await page.request.get("/api/v1/email-settings")).json();
	const rejected = await page.request.put("/api/v1/email-settings", { headers: { origin: new URL(page.url()).origin, "x-payloadbay-csrf": "1" }, data: { expectedVersion: settings.version, channelKey: "smtp", branding: { ...settings.branding, name: "Unauthorized white label" } } });
	expect(rejected.status()).toBe(403);
	expect(await rejected.json()).toMatchObject({ error: { code: "feature_unavailable" } });
	const hidden = await page.goto("/admin/email");
	expect(hidden?.status()).toBe(404);
	const channels = await (await page.request.get("/api/v1/notification-channels")).json();
	expect(channels.some((channel: { name: string }) => channel.name === "Review email module")).toBeTruthy();
});

test("project-only preview reviewers cannot navigate into workspace or instance administration", async ({ page }) => {
	const { database } = await import("../../packages/domain/src/db.ts");
	const { readServerConfig } = await import("../../packages/domain/src/config.ts");
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { seedPreviewDemo } = await import("../../packages/domain/src/preview-demo.ts");
	const { signInBrowser } = await import("../helpers/browser-auth.ts");
	const config = readServerConfig(process.env);
	const pool = database(config.databaseUrl);
	const identity = createAuth(pool, config);
	let projectId = "";
	let privateProjectId = "";
	try {
		await seedPreviewDemo(pool, config, identity, { IS_PREVIEW: "true", NODE_ENV: "development" });
		const projects = (await pool.query("SELECT id,slug FROM payloadbay.project")).rows;
		projectId = projects.find((project) => project.slug === "webhook-playground").id;
		privateProjectId = projects.find((project) => project.slug === "admin-only").id;
	} finally {
		await identity.close();
		await pool.end();
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await signInBrowser(page, "project-admin@preview.payloadbay.test");
	await page.goto("/projects");
	await expect(page.getByRole("row", { name: /Demo integrations/ })).toBeVisible();
	await expect(page.getByRole("row", { name: /Admin-only example/ })).toHaveCount(0);
	await page.goto("/projects/" + projectId);
	await page.getByRole("button", { name: "Toggle navigation" }).click();
	const menu = page.getByRole("dialog");
	await expect(menu.getByRole("button", { name: "Back to instance", exact: true })).toBeVisible();
	await expect(menu.getByRole("button", { name: "Back to workspace", exact: true })).toHaveCount(0);
	await menu.getByRole("button", { name: "Back to instance", exact: true }).click();
	await expect(menu.getByText("Instance members", { exact: true })).toHaveCount(0);
	await expect(menu.getByText("Notification modules", { exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	expect((await page.request.get("/api/v1/projects/" + privateProjectId)).status()).toBe(403);
	expect((await page.request.get("/api/v1/email-settings")).status()).toBe(403);
	await signInBrowser(page, "project-viewer@preview.payloadbay.test");
	await page.goto("/projects/" + projectId);
	await expect(page.getByRole("button", { name: "Create ingress route", exact: true })).toHaveCount(0);
	const projects = await (await page.request.get("/api/v1/projects")).json();
	expect(projects.map((project: { id: string }) => project.id)).toEqual([projectId]);
	expect((await page.request.post("/api/v1/projects/" + projectId + "/endpoints", { headers: { origin: new URL(page.url()).origin, "x-payloadbay-csrf": "1" }, data: { name: "Forbidden", slug: "forbidden" } })).status()).toBe(403);
});

test("FT06a organization context owns workspace creation", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.goto("/organizations");
	await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible();
	await page.getByRole("row").filter({ hasText: "My organization" }).getByRole("link").click();
	await expect(page.getByRole("heading", { name: "My organization", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	await page.getByLabel("Name", { exact: true }).fill("Foundation team");
	await page.getByRole("button", { name: "Create workspace", exact: true }).last().click();
	await expect(page.getByRole("row").filter({ hasText: "Foundation team" })).toBeVisible();
});

test("FT06c organization code and members retain their own scope", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const organizationId = await browserOrganization(page);
	await page.goto("/code/organization/" + organizationId);
	await expect(page.getByRole("button", { name: "Create helper", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Back to organization", exact: true }).click();
	await expect(page).toHaveURL(new RegExp("/organizations/" + organizationId + "$"));
	await page.goto("/organizations/" + organizationId + "/members");
	await expect(page.getByRole("heading", { name: "Organization members", exact: true })).toBeVisible();
});

test("FT11b organization usage shows local counts and unlimited self-host defaults", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const organizationId = await browserOrganization(page);
	await page.goto("/organizations/" + organizationId + "/usage");
	await expect(page.getByRole("heading", { name: "Usage and limits", exact: true })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Organization usage" })).toBeVisible();
	const to = new Date();
	const query = new URLSearchParams({ from: new Date(to.getTime() - 86400000).toISOString(), to: to.toISOString() });
	const usage = await (await page.request.get(`/api/v1/organizations/${organizationId}/usage?${query}`)).json();
	await expect(
		page
			.getByRole("row", { name: /Incoming requests/ })
			.getByRole("gridcell")
			.nth(1),
	).toHaveText(BigInt(usage.metrics["ingress.recorded"].lifetime).toLocaleString("en-US"));
	await expect(page.getByText("Unlimited", { exact: true })).toHaveCount(3);
	await chooseOption(page.getByRole("button", { name: new RegExp("Usage window") }), "168");
	await expect(page.getByRole("grid", { name: "Organization usage" })).toBeVisible();
	const invalid = await page.request.get("/api/v1/organizations/" + organizationId + "/usage?from=invalid&to=invalid");
	expect(invalid.status()).toBe(400);
	const policy = await page.request.get("/api/v1/organizations/" + organizationId + "/policy");
	expect(policy.status()).toBe(200);
	expect((await policy.json()).limits).toEqual({ workspaces: null, projects: null, admission: null });
	const workspaces = await (await page.request.get("/api/v1/workspaces")).json();
	const workspace = workspaces.find((item: { organization_id: string }) => item.organization_id === organizationId);
	const created = await page.request.post("/api/v1/projects", { headers: { origin: new URL(page.url()).origin, "x-payloadbay-csrf": "1" }, data: { parentId: workspace.id, name: "API contract", slug: "api-contract" } });
	expect(created.status()).toBe(200);
	const project = await created.json();
	const detail = await page.request.get("/api/v1/projects/" + project.id);
	expect(detail.status()).toBe(200);
	expect((await detail.json()).organization_id).toBe(organizationId);
	await page.screenshot({
		path: "/tmp/payloadbay-org-usage-mobile.png",
		fullPage: true,
		animations: "disabled",
		timeout: 5000,
	});
});

test("R08 bounded dialogs center on desktop and remain inside the mobile viewport", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("/workspaces");
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "New workspace", exact: true });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel("Name", { exact: true }).click();
	const box = await dialog.boundingBox();
	expect(box).toBeTruthy();
	expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThan(40);
	expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(40);
	await page.screenshot({ path: test.info().outputPath("centered-desktop-dialog.png") });
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole("button", { name: "Create workspace", exact: true }).click();
	await expect(dialog).toBeVisible();
	await expect
		.poll(async () => {
			const bounds = await dialog.boundingBox();

			return bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY;
		})
		.toBeLessThanOrEqual(844);
	const mobile = await dialog.boundingBox();
	expect(mobile).toBeTruthy();
	expect(mobile!.x).toBeGreaterThanOrEqual(0);
	expect(mobile!.y).toBeGreaterThanOrEqual(0);
	expect(mobile!.x + mobile!.width).toBeLessThanOrEqual(390);
	expect(mobile!.y + mobile!.height).toBeLessThanOrEqual(844);
	await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
	await page.screenshot({ path: test.info().outputPath("bounded-mobile-dialog.png") });
});

test("U159 job administration exposes safe metadata and denies lower rights", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const pool = database(process.env.DATABASE_URL!);
	try {
		const job = (await pool.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,last_error) VALUES('email',$1,'browser-admin-inspection','synthetic-private-upstream-response') RETURNING id", [Buffer.from("synthetic-private-job-body")])).rows[0];
		const response = await page.request.get("/api/v1/jobs");
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.items.some((item: { id: string }) => item.id === job.id)).toBe(true);
		expect(JSON.stringify(data)).not.toContain("synthetic-private");
		expect(data.acknowledgmentLatency).toBeNull();
		await page.goto("/");
		await page.getByRole("row", { name: "Jobs and queues", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Jobs and queues", exact: true })).toBeVisible();
		await expect(page.getByRole("grid", { name: "Platform jobs" }).getByRole("row").filter({ hasText: job.id })).toContainText("Queued");
		const chart = page.getByRole("img", { name: "Aggregate delivery outcomes over 24 hours" });
		await expect(chart).toBeVisible();
		await chart.hover();
		await page.screenshot({ path: test.info().outputPath("jobs-desktop.png"), fullPage: true });
		await expect(page.getByText("Provider acknowledgement latency is not measured.", { exact: true })).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: test.info().outputPath("jobs-mobile.png"), fullPage: true });
		await pool.query("UPDATE payloadbay.grant_record SET role_preset='custom',permissions=array_remove(permissions,'jobs.read') WHERE user_id=$1", [me.user.id]);
		expect((await page.request.get("/api/v1/jobs")).status()).toBe(403);
		await page.goto("/admin/jobs");
		await expect(page.getByRole("heading", { name: "Job administration is restricted", exact: true })).toBeVisible();
		await expect(page.getByRole("grid", { name: "Platform jobs" })).toHaveCount(0);
		await page.goto("/");
		await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
		await expect(page.getByRole("row", { name: "Jobs and queues", exact: true })).toHaveCount(0);
	} finally {
		await pool.end();
	}
});

test("U160 job screen distinguishes due backlog age and excludes future or paused work", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Queue inspection", slug: "queue-inspection" } })).json();
	const route = await (await page.request.post(`/api/v1/projects/${project.id}/endpoints`, { headers, data: { name: "Critical delivery", slug: "critical", priority: 0 } })).json();
	const published = await page.request.post(`/api/v1/endpoints/${route.id}/publications`, { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } });
	expect(published.status()).toBe(200);
	const publication = await published.json();
	const pool = database(process.env.DATABASE_URL!);
	try {
		const event = (await pool.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,''::bytea,''::bytea,'{}','application/json') RETURNING id", [route.id, publication.id])).rows[0];
		await pool.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,created_at,due_at) VALUES($1,$2,$3,clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '2 minutes'),($1,$2,$3,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour')", [event.id, route.id, publication.id]);
		await page.goto("/admin/jobs");
		const grid = page.getByRole("grid", { name: "Due delivery backlog" });
		await expect(grid.getByRole("row")).toHaveCount(2);
		const cells = grid.getByRole("row").nth(1).getByRole("gridcell");
		await expect(cells.nth(0)).toHaveText("1");
		expect(Number((await cells.nth(1).innerText()).replace(/[^0-9]/g, ""))).toBeGreaterThanOrEqual(600);
		expect(Number((await cells.nth(2).innerText()).replace(/[^0-9]/g, ""))).toBeGreaterThanOrEqual(120);
		expect(Number((await cells.nth(2).innerText()).replace(/[^0-9]/g, ""))).toBeLessThan(180);
		await pool.query("UPDATE payloadbay.endpoint SET paused=true WHERE id=$1", [route.id]);
		await page.getByRole("button", { name: "Refresh", exact: true }).click();
		await expect(grid).toContainText("No executions are waiting for delivery.");
		await expect(page.getByText("Provider acknowledgement latency is not measured.", { exact: true })).toBeVisible();
	} finally {
		await pool.end();
	}
});

test("U157 dashboard multiplexes live events and notifications on one connection", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	const { transaction } = await import("../../packages/domain/src/db.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const { reconcileCondition } = await import("../../packages/domain/src/notifications.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Live project", slug: "live-project" } })).json();
	const route = await (await page.request.post(`/api/v1/projects/${project.id}/endpoints`, { headers, data: { name: "Live route", slug: "live-route" } })).json();
	const published = await page.request.post(`/api/v1/endpoints/${route.id}/publications`, { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } });
	expect(published.status()).toBe(200);
	const publication = await published.json();
	await page.addInitScript(() => {
		const sources: EventSource[] = [];
		Object.defineProperty(window, "__payloadbayStreams", { value: sources });
		const Native = window.EventSource;
		window.EventSource = class extends Native {
			constructor(url: string | URL, options?: EventSourceInit) {
				super(url, options);
				sources.push(this);
			}
		};
	});
	await page.goto(`/projects/${project.id}/events`);
	await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await page.getByRole("button", { name: "Dismiss notification Scripts use ordinary Docker containment", exact: true }).click();
	await page.getByRole("dialog", { name: "Notifications", exact: true }).getByRole("button", { name: "Close notifications", exact: true }).click();
	await expect(page.getByRole("button", { name: "Notifications", exact: true })).toHaveAccessibleDescription("No active notifications.");

	const openStreams = () => page.evaluate(() => (Reflect.get(window, "__payloadbayStreams") as EventSource[]).filter((source) => source.readyState !== EventSource.CLOSED).length);

	await expect.poll(openStreams).toBe(1);
	const pool = database(process.env.DATABASE_URL!);
	try {
		const eventId = await transaction(pool, async (db) => {
			const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,''::bytea,''::bytea,'{}','application/json') RETURNING id", [route.id, publication.id])).rows[0];
			await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3)", [event.id, route.id, publication.id]);
			await appendChange(db, { scope: { type: "project", id: project.id }, kind: "event.accepted", resourceId: event.id });

			return event.id;
		});
		const row = page
			.getByRole("grid", { name: "Stored events" })
			.getByRole("row")
			.filter({ has: page.getByRole("button", { name: "Inspect event " + eventId.slice(0, 8), exact: true }) });
		await expect(row).toContainText("Accepted / queued");
		await transaction(pool, async (db) => {
			const result = await db.query("UPDATE payloadbay.execution SET state='succeeded',final_result='{\"kind\":\"complete\"}' WHERE event_id=$1 RETURNING id", [eventId]);
			await appendChange(db, { scope: { type: "project", id: project.id }, kind: "execution.changed", resourceId: result.rows[0].id });
		});
		await expect(row).toContainText("Handler completed");
		await reconcileCondition(pool, {
			key: "shared-stream-notice",
			revision: "1",
			kind: "delivery.failure-threshold",
			scope: { type: "project", id: project.id },
			subject: "Live notice",
			severity: "warning",
			active: true,
		});
		await expect(page.getByRole("button", { name: "Notifications", exact: true })).toHaveAccessibleDescription("1 active notification. Highest severity: warning.");
		await expect.poll(openStreams).toBe(1);
		await page.getByRole("navigation", { name: "Breadcrumbs", exact: true }).getByRole("link", { name: "Overview", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
		expect(await page.evaluate(() => (Reflect.get(window, "__payloadbayStreams") as EventSource[]).length)).toBe(1);
		await expect.poll(openStreams).toBe(1);
	} finally {
		await pool.end();
	}
});

test("U157b open attempt inspector refreshes when delivery completes", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database, transaction } = await import("../../packages/domain/src/db.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Live inspector", slug: "live-inspector" } })).json();
	const route = await (await page.request.post(`/api/v1/projects/${project.id}/endpoints`, { headers, data: { name: "Inspector completion", slug: "inspector-completion" } })).json();
	const published = await page.request.post(`/api/v1/endpoints/${route.id}/publications`, { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } });
	expect(published.status()).toBe(200);
	const publication = await published.json();
	const pool = database(process.env.DATABASE_URL!);
	try {
		const event = (await pool.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,''::bytea,''::bytea,'{}','application/json') RETURNING id", [route.id, publication.id])).rows[0];
		const execution = (await pool.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state) VALUES($1,$2,$3,'running') RETURNING id", [event.id, route.id, publication.id])).rows[0];
		await pool.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'primary','fixture','{}',1)", [execution.id]);
		const attempt = (await pool.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation) VALUES($1,'primary',1,1) RETURNING id", [execution.id])).rows[0];
		await page.goto(`/projects/${project.id}/events`);
		await page.getByRole("button", { name: "Inspect event " + event.id.slice(0, 8), exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Event inspection", exact: true });
		await dialog.getByRole("tab", { name: "Outgoing", exact: true }).click();
		await expect(dialog.getByRole("button", { name: /Delivery attempt/ })).toContainText("Pending");
		await expect(dialog.getByRole("heading", { name: "Destination response", exact: true })).toBeVisible();
		await transaction(pool, async (db) => {
			await db.query("UPDATE payloadbay.delivery_attempt SET ended_at=clock_timestamp(),status_code=503,response_body=$2 WHERE id=$1", [attempt.id, Buffer.from("Try again later")]);
			await db.query("UPDATE payloadbay.execution SET state='retry_wait',due_at=clock_timestamp()+interval '1 minute' WHERE id=$1", [execution.id]);
			await appendChange(db, { scope: { type: "project", id: project.id }, kind: "attempt.completed", resourceId: attempt.id });
		});
		await expect(dialog.getByRole("button", { name: /Delivery attempt/ })).toContainText("HTTP 503");
		await expect(dialog.getByLabel("Delivery response body", { exact: true })).toHaveText("Try again later");
		await expect(dialog.getByRole("tab", { name: "Outgoing", exact: true })).toHaveAttribute("aria-selected", "true");
	} finally {
		await pool.end();
	}
});

test("AD01 instance audit log paginates safe metadata and enforces current rights", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const created = await page.request.post("/api/v1/secrets", { headers: commandHeaders(), data: { scope: { type: "instance", id: me.instanceId }, name: "AUDIT_SIGNING_KEY", value: "synthetic-private-audit-value" } });
	expect(created.status()).toBe(200);
	const pool = database(process.env.DATABASE_URL!);
	try {
		const row = (await pool.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,redacted_diff) VALUES($1,'instance',$2,'fixture.private-diff',$3) RETURNING id", [me.user.id, me.instanceId, JSON.stringify({ secret: "synthetic-private-audit-value" })])).rows[0];
		const response = await page.request.get("/api/v1/audit?limit=1");
		expect(response.status()).toBe(200);
		const first = await response.json();
		expect(first.items).toHaveLength(1);
		expect(first.items[0].id).toBe(row.id);
		expect(JSON.stringify(first)).not.toContain("synthetic-private-audit-value");
		expect(first.items[0]).not.toHaveProperty("redacted_diff");
		expect(typeof first.nextCursor).toBe("string");
		const second = await (await page.request.get("/api/v1/audit?limit=1&cursor=" + encodeURIComponent(first.nextCursor))).json();
		expect(second.items).toHaveLength(1);
		expect(second.items[0].id).not.toBe(first.items[0].id);
		expect((await page.request.get("/api/v1/audit?limit=0")).status()).toBe(400);
		expect((await page.request.get("/api/v1/audit?cursor=invalid-cursor")).status()).toBe(400);
		await page.goto("/");
		await page.getByRole("row", { name: "Audit log", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Audit log", exact: true })).toBeVisible();
		await expect(page.getByRole("grid", { name: "Audit log" })).toContainText("fixture.private-diff");
		await page.setViewportSize({ width: 390, height: 844 });
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await pool.query("UPDATE payloadbay.grant_record SET role_preset='custom',permissions=array_remove(permissions,'audit.read') WHERE user_id=$1", [me.user.id]);
		expect((await page.request.get("/api/v1/audit")).status()).toBe(403);
		await page.goto("/admin/audit");
		await expect(page.getByRole("heading", { name: "Audit access is restricted", exact: true })).toBeVisible();
		await expect(page.getByRole("grid", { name: "Audit log" })).toHaveCount(0);
	} finally {
		await pool.end();
	}
});

test("AD03 audit pagination retries a failed next page without losing history", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	let nextRequests = 0;

	const item = (id: string, operation: string) => ({
		id,
		operation,
		actor: "fixture-owner",
		actorName: "Fixture actor",
		resourceName: null,
		scopeName: "Instance operations",
		scope: { type: "instance", id: "00000000-0000-4000-8000-000000000001" },
		resourceId: null,
		createdAt: "2026-10-17T01:02:03.123456Z",
	});

	await page.route("**/api/v1/audit?*", async (route) => {
		if (new URL(route.request().url()).searchParams.has("cursor")) {
			nextRequests++;
			if (nextRequests === 1) await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Try again" } } });
			else await route.fulfill({ json: { items: [item("00000000-0000-4000-8000-000000000003", "fixture.older")], nextCursor: null } });
		} else await route.fulfill({ json: { items: [item("00000000-0000-4000-8000-000000000002", "fixture.newer")], nextCursor: "fixture-cursor" } });
	});
	await page.goto("/admin/audit");
	const table = page.getByRole("grid", { name: "Audit log" });
	await expect(table).toContainText("fixture.newer");
	await page.getByRole("button", { name: "Load more", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Audit log could not be loaded" })).toBeVisible();
	await expect(table).toContainText("fixture.newer");
	await page.getByRole("button", { name: "Load more", exact: true }).click();
	await expect(table).toContainText("fixture.older");
	await expect(table).toContainText("fixture.newer");
	await expect(page.getByRole("button", { name: "Load more", exact: true })).toHaveCount(0);
	expect(nextRequests).toBe(2);
});

test("IH01 installation settings and health are factual and instance restricted", async ({ page }) => {
	const { ensureBrowserOwner } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const settingsResponse = await page.request.get("/api/v1/installation/settings");
	expect(settingsResponse.status()).toBe(200);
	const settings = await settingsResponse.json();
	expect(settings.executorMode).toBe("runc");
	expect(settings.smtpConfigured).toBe(true);
	expect(settings.eventRetentionDays).toBe(0);
	expect(settings).not.toHaveProperty("databaseUrl");
	expect(settings).not.toHaveProperty("authSecret");
	expect(settings).not.toHaveProperty("smtp");
	const healthResponse = await page.request.get("/api/v1/health");
	expect(healthResponse.status()).toBe(200);
	const health = await healthResponse.json();
	expect(health.database).toBe("available");
	expect(health.executor.state).toBe("ready");
	expect(health.executor.runtime).toBe("workerd");
	expect(health.executor.hostAttestation).toBe(false);
	expect(["recent", "not_seen"]).toContain(health.worker);
	expect(health.smtp).toBe("ready");
	await page.goto("/admin/installation");
	await expect(page.getByRole("heading", { name: "Installation", exact: true })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Service health" })).toContainText("SMTP connection verified");
	await expect(page.getByText("Keep indefinitely (automatic deletion off)", { exact: true })).toBeVisible();
	await page.screenshot({ path: test.info().outputPath("installation-desktop.png") });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: test.info().outputPath("installation-mobile.png") });
	await page.getByText("Keep indefinitely (automatic deletion off)", { exact: true }).scrollIntoViewIfNeeded();
	await expect(page.getByText("Keep indefinitely (automatic deletion off)", { exact: true })).toBeInViewport();
	await expect(page.getByText("Event retention", { exact: true })).toBeInViewport();
	await page.screenshot({ path: test.info().outputPath("installation-retention-mobile.png") });
	const pool = database(process.env.DATABASE_URL!);
	try {
		await pool.query("UPDATE payloadbay.grant_record SET role_preset='custom',permissions=array_remove(permissions,'settings.manage') WHERE user_id=$1", [me.user.id]);
		expect((await page.request.get("/api/v1/installation/settings")).status()).toBe(403);
		expect((await page.request.get("/api/v1/health")).status()).toBe(403);
		await page.goto("/admin/installation");
		await expect(page.getByRole("heading", { name: "Installation access is restricted", exact: true })).toBeVisible();
	} finally {
		await pool.end();
	}
});

test("RT15 live retention removes expired rows and closes an open inspector without an action-error toast", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	const { readServerConfig } = await import("../../packages/domain/src/config.ts");
	const { encryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Retained history", slug: "retained-history" } })).json();
	const route = await (await page.request.post(`/api/v1/projects/${project.id}/endpoints`, { headers, data: { name: "Expired request", slug: "expired-request" } })).json();
	const publication = await (await page.request.post(`/api/v1/endpoints/${route.id}/publications`, { headers, data: { expectedVersion: 1, draftVersions: { ingress: 1, processing: 1 } } })).json();
	const pool = database(process.env.DATABASE_URL!);
	try {
		const event = (await pool.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain','reject') RETURNING id", [route.id, publication.id, Buffer.from("synthetic expired request")])).rows[0];
		await page.goto(`/projects/${project.id}/events`);
		const inspect = page.getByRole("button", { name: "Inspect event " + event.id.slice(0, 8), exact: true });
		await inspect.click();
		const dialog = page.getByRole("dialog", { name: "Event inspection", exact: true });
		await expect(dialog).toBeVisible();
		const config = { ...readServerConfig(process.env), eventRetentionDays: 30 };
		const job = (await pool.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('event_retention',$1,gen_random_uuid()::text) RETURNING id,generation", [encryptPrivate({}, config.encryptionKey)])).rows[0];
		await platformJobTask(pool, config)({ jobId: job.id, generation: job.generation });
		await expect(inspect).toHaveCount(0);
		await expect(dialog).toHaveCount(0);
		await expect(page.getByRole("alertdialog", { name: "Events error", exact: true })).toHaveCount(0);
	} finally {
		await pool.end();
	}
});

test("UX54 request client sends edited body and headers", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Request client", slug: "request-client" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Echo", slug: "echo" } })).json();
	const draft = await page.request.patch("/api/v1/endpoints/" + route.id + "/drafts/ingress", { headers: { ...headers, "if-match": JSON.stringify("1") }, data: { body: 'export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:new TextDecoder().decode(ctx.request.body)+"|"+ctx.request.headers["x-review"]}); }' } });
	expect(draft.status()).toBe(200);
	const published = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 2, processing: 1 } } });
	expect(published.status()).toBe(200);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=playground");
	const requestBody = page.getByRole("textbox", { name: "Playground request body", exact: true });
	await expect(page.getByText("Loading code editor…", { exact: true })).toHaveCount(0);
	await requestBody.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate(() => navigator.clipboard.writeText('{"review":true}'));
	await page.keyboard.press("ControlOrMeta+V");
	await page.getByRole("tab", { name: "Headers", exact: true }).first().click();
	const requestHeaders = page.getByRole("textbox", { name: "Playground request headers", exact: true });
	await expect(page.getByText("Loading code editor…", { exact: true })).toHaveCount(0);
	await requestHeaders.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate(() => navigator.clipboard.writeText('{"content-type":"application/json","x-review":"editor"}'));
	await page.keyboard.press("ControlOrMeta+V");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByLabel("Response body", { exact: true })).toHaveText('{"review":true}|editor');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("CF10 scoped audit is usable on mobile and platform roles cannot restore customer access", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	await ensureBrowserOwner(page);
	const me = await (await page.request.get("/api/v1/me")).json();
	const created = await page.request.post("/api/v1/workspaces", { headers: commandHeaders(), data: { parentId: await browserOrganization(page), name: "Private department", slug: "private-department" } });
	expect(created.status()).toBe(200);
	const workspace = await created.json();
	const project = await (await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name: "Private business", slug: "private-business" } })).json();
	await page.setViewportSize({ width: 390, height: 844 });
	for (const path of ["/organizations/" + (await browserOrganization(page)), "/workspaces/" + workspace.id, "/projects/" + project.id]) {
		await page.goto(path + "/audit");
		await expect(page.getByRole("grid", { name: "Audit log" })).toContainText("scope.created");
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	}

	await page.goto("/workspaces/" + workspace.id + "/audit");
	expect((await page.request.post("/api/auth/admin/impersonate-user", { headers: commandHeaders(), data: { userId: "customer" } })).status()).toBe(404);
	const pool = database(process.env.DATABASE_URL!);
	try {
		await pool.query("DELETE FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type<>'instance'", [me.user.id]);
		expect((await page.request.get("/api/v1/audit?scopeType=workspace&scopeId=" + workspace.id)).status()).toBe(403);
		expect((await page.request.get("/api/v1/audit?scopeType=project&scopeId=" + project.id)).status()).toBe(403);
		expect(
			(
				await page.request.put("/api/v1/members", {
					headers: commandHeaders(),
					data: {
						scope: { type: "project", id: project.id },
						userId: me.user.id,
						role: "custom",
						permissions: ["metadata.read"],
					},
				})
			).status(),
		).toBe(403);
		const audit = await (await page.request.get("/api/v1/audit")).json();
		expect(audit.items.every((item: { scope: { type: string } }) => item.scope.type === "instance")).toBe(true);
		await page.reload();
		await expect(page.getByRole("heading", { name: "Audit access is restricted" })).toBeVisible();
		await expect(page.getByRole("grid", { name: "Audit log" })).toHaveCount(0);
	} finally {
		await pool.end();
	}
});

test("UX60 destination edits preserve delivery configuration and reject stale saves", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const projectResponse = await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Destination review", slug: "destination-review" } });
	expect(projectResponse.status()).toBe(200);
	const project = await projectResponse.json();
	const created = await page.request.post("/api/v1/projects/" + project.id + "/destinations", {
		headers,
		data: {
			name: "Original receiver",
			url: "https://example.test/original",
			method: "PUT",
			headers: { "x-event-format": "example" },
			concurrency: 7,
		},
	});
	expect(created.status()).toBe(200);
	const destination = await created.json();
	await page.goto("/projects/" + project.id);
	await page.getByRole("button", { name: "Edit destination Original receiver", exact: true }).click();
	let dialog = page.getByRole("dialog", { name: "Edit destination", exact: true });
	await expect(dialog.getByLabel("Destination URL", { exact: true })).toHaveValue("https://example.test/original");
	await dialog.getByLabel("Name", { exact: true }).fill("Updated receiver");
	await dialog.getByLabel("Destination URL", { exact: true }).fill("https://example.test/updated");
	await page.screenshot({ path: test.info().outputPath("destination-edit-mobile.png") });
	await dialog.getByRole("button", { name: "Save destination", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const saved = await (await page.request.get("/api/v1/destinations/" + destination.id)).json();
	expect(saved).toMatchObject({
		name: "Updated receiver",
		version: 2,
		concurrency: 7,
		isDefault: true,
		http: { method: "PUT", url: "https://example.test/updated", headers: { "x-event-format": "example" } },
	});
	await page.getByRole("button", { name: "Edit destination Updated receiver", exact: true }).click();
	dialog = page.getByRole("dialog", { name: "Edit destination", exact: true });
	await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Updated receiver");
	const concurrent = await page.request.put("/api/v1/destinations/" + destination.id, {
		headers: { ...headers, "if-match": JSON.stringify("2") },
		data: {
			name: "Concurrent edit",
			...saved.http,
			concurrency: saved.concurrency,
			isDefault: saved.isDefault,
			secretRefs: saved.secretRefs,
		},
	});
	expect(concurrent.status()).toBe(200);
	await dialog.getByLabel("Name", { exact: true }).fill("Stale local edit");
	await dialog.getByRole("button", { name: "Save destination", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Project error" })).toContainText("Destination changed");
	await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Stale local edit");
	expect((await (await page.request.get("/api/v1/destinations/" + destination.id)).json()).name).toBe("Concurrent edit");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("UX61 route overview owns receiving controls and mobile search closes navigation", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Overview review", slug: "overview-review" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Review route", slug: "review-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id);
	await expect(page.getByLabel("Receiving URL", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Pause delivery", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Open scripts", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Scripts", exact: true })).toBeVisible();
	await expect(page.getByLabel("Receiving URL", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Pause delivery", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await page.getByRole("button", { name: "Search pages and resources", exact: true }).click();
	const search = page.getByRole("dialog", { name: "Search pages and resources", exact: true });
	await expect(search).toBeVisible();
	await expect(page.getByRole("button", { name: "Back to project", exact: true })).not.toBeVisible();
	await page.screenshot({ path: test.info().outputPath("navigation-search-mobile.png") });
	await page.keyboard.press("Escape");
	await expect(search).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Scripts", exact: true })).toBeVisible();
});

test("UX62 one secret inventory manages both stages and imports environment text", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Secrets review", slug: "secrets-review" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Secrets route", slug: "secrets-route" } })).json();
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=secrets");
	await expect(page.getByRole("tablist", { name: "Lifecycle scripts" })).toHaveCount(0);
	await expect(page.getByLabel("Receiving URL", { exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Import .env", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Import environment secrets", exact: true });
	await expect(dialog).toContainText("256 KiB");
	await dialog.getByRole("textbox", { name: "Environment text", exact: true }).fill('FIRST_KEY="synthetic first"\nSECOND_KEY=synthetic-second\n' + Array.from({ length: 40 }, (_, index) => `BULK_${index}=synthetic-${index}`).join("\n"));
	await dialog.getByRole("button", { name: "Import secrets", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const inventory = page.getByRole("grid", { name: "Secret inventory", exact: true });
	await expect(inventory.getByRole("checkbox", { name: "FIRST_KEY v1 available in ingress", exact: true })).toBeChecked();
	await expect(inventory.getByRole("checkbox", { name: "FIRST_KEY v1 available in processing", exact: true })).toBeChecked();
	await page.getByRole("alertdialog", { name: "Secret status", exact: true }).getByRole("button", { name: "Close", exact: true }).press("Enter");
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
	await page.reload();
	await expect(inventory.getByRole("checkbox", { name: "FIRST_KEY v1 available in processing", exact: true })).toBeChecked();
	// Click the visible control rather than the library's visually hidden native input.
	await inventory.getByRole("row").filter({ hasText: "FIRST_KEY" }).locator('[data-slot="checkbox-content"]').nth(1).click();
	await expect(inventory.getByRole("checkbox", { name: "FIRST_KEY v1 available in processing", exact: true })).not.toBeChecked();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
	const ingress = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/ingress")).json();
	const processing = await (await page.request.get("/api/v1/endpoints/" + route.id + "/drafts/processing")).json();
	expect(ingress.secret_bindings.FIRST_KEY).toBeTruthy();
	expect(processing.secret_bindings.FIRST_KEY).toBeUndefined();
	expect(processing.secret_bindings.SECOND_KEY).toBeTruthy();
	const versions = await (await page.request.get("/api/v1/secrets?scopeType=project&scopeId=" + project.id)).json();
	expect(JSON.stringify(versions)).not.toContain("synthetic-second");
	await page.screenshot({ path: test.info().outputPath("secrets-stage-inventory-mobile.png") });
});

test("UX63 request format validation prevents malformed sends and supports XML", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Body formats", slug: "body-formats" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Format route", slug: "format-route" } })).json();
	await page.request.patch("/api/v1/endpoints/" + route.id + "/drafts/ingress", { headers: { ...headers, "if-match": JSON.stringify("1") }, data: { body: 'export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:ctx.request.contentType+"|"+new TextDecoder().decode(ctx.request.body)}); }' } });
	const published = await page.request.post("/api/v1/endpoints/" + route.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 2, processing: 1 } } });
	expect(published.status()).toBe(200);
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=playground");
	let sent = 0;
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/ingress/")) sent++;
	});
	const body = page.getByRole("textbox", { name: "Playground request body", exact: true });
	await body.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate((text) => navigator.clipboard.writeText(text), "{");
	await page.keyboard.press("ControlOrMeta+V");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script configuration error" })).toContainText("Correct the JSON body");
	expect(sent).toBe(0);
	await chooseOption(page.getByRole("button", { name: new RegExp("Body format") }), "xml");
	await body.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate((text) => navigator.clipboard.writeText(text), "<purchase>");
	await page.keyboard.press("ControlOrMeta+V");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByRole("alertdialog", { name: "Script configuration error" })).toContainText("Correct the XML body");
	expect(sent).toBe(0);
	await body.focus();
	await page.keyboard.press("ControlOrMeta+A");
	await page.evaluate((text) => navigator.clipboard.writeText(text), "<purchase />");
	await page.keyboard.press("ControlOrMeta+V");
	await page.getByRole("button", { name: "Send request", exact: true }).click();
	await expect(page.getByLabel("Response body", { exact: true })).toHaveText("application/xml|<purchase />");
	expect(sent).toBe(1);
});

test("UX67 desktop resource actions, command shortcut and anchored notifications remain coherent", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 1440, height: 1000 });
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Desktop review", slug: "desktop-review" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Unused route", slug: "unused-route" } })).json();
	const destination = await (await page.request.post("/api/v1/projects/" + project.id + "/destinations", { headers, data: { name: "Unused target", url: "https://example.test/receiver" } })).json();
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto("/workspaces/" + workspace.id);
		for (const name of ["Workspace members", "Shared code and middleware", "Notification rules for Desktop review"]) {
			const action = page.getByRole("link", { name, exact: true });
			await expect(action).toBeVisible();
			const offset = await action.evaluate((element) => {
				const button = element.getBoundingClientRect();
				const icon = element.querySelector("svg")!.getBoundingClientRect();

				return { x: Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2), y: Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2) };
			});
			expect(offset.x).toBeLessThan(2);
			expect(offset.y).toBeLessThan(2);
		}

		if (width === 1440) {
			await page.getByRole("link", { name: "Workspace members", exact: true }).focus();
			await expect(page.getByRole("tooltip", { name: "Workspace members", exact: true })).toBeVisible();
		}

		await page.screenshot({ path: test.info().outputPath(`workspace-actions-${width}.png`) });
		await page.getByRole("link", { name: "Workspace members", exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.id}/members$`));
		await page.goto("/workspaces/" + workspace.id);
		await page.getByRole("link", { name: "Shared code and middleware", exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/code/workspace/${workspace.id}$`));
	}

	await page.goto("/projects/" + project.id);
	await expect(page.getByRole("heading", { name: "Desktop review", exact: true })).toBeVisible();
	await page.keyboard.press("ControlOrMeta+k");
	await expect(page.getByRole("dialog").getByPlaceholder("Search pages and resources…")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("grid", { name: "Destinations", exact: true }).getByRole("row").filter({ hasText: "Unused target" }).click();
	await expect(page.getByRole("dialog", { name: "Edit destination", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Delete destination Unused target", exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
	await expect.poll(async () => (await page.request.get("/api/v1/destinations/" + destination.id)).status()).toBe(404);
	await page.getByRole("button", { name: "Delete route Unused route", exact: true }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
	await expect.poll(async () => (await page.request.get("/api/v1/endpoints/" + route.id)).status()).toBe(404);
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	const notices = page.getByRole("dialog", { name: "Notifications", exact: true });
	await expect(notices).toBeVisible();
	const trigger = await page.getByRole("button", { name: "Notifications", exact: true }).boundingBox();
	const panel = await notices.boundingBox();
	expect(trigger).not.toBeNull();
	expect(panel).not.toBeNull();
	expect(panel!.x + panel!.width).toBeLessThanOrEqual(1440);
	expect(Math.abs(panel!.x + panel!.width - trigger!.x - trigger!.width)).toBeLessThan(40);
	await page.screenshot({ path: test.info().outputPath("desktop-notifications-and-resource-actions.png") });
});

test("UX68 route traffic recovers an outage and live counts stay specific to that route", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { unverifiedHttpTemplate } = await import("../../packages/script-sdk/src/templates/unverified.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Traffic recovery", slug: "traffic-recovery" } })).json();
	const target = await page.request.post("/api/v1/projects/" + project.id + "/destinations", { headers, data: { name: "Traffic receiver", url: process.env.PAB_TEST_HTTP_URL + "/delivery" } });
	expect(target.status()).toBe(200);
	const endpoint = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Traffic route", slug: "traffic-route" } })).json();
	const draft = await page.request.patch("/api/v1/endpoints/" + endpoint.id + "/drafts/ingress", { headers: { ...headers, "if-match": JSON.stringify("1") }, data: { body: unverifiedHttpTemplate.source } });
	expect(draft.status()).toBe(200);
	const publication = await page.request.post("/api/v1/endpoints/" + endpoint.id + "/publications", { headers, data: { expectedVersion: 1, draftVersions: { ingress: 2, processing: 1 } } });
	expect(publication.status()).toBe(200);
	let unavailable = true;
	await page.route(
		(url) => url.pathname === "/api/v1/overview" && url.searchParams.get("endpointId") === endpoint.id,
		(request) => (unavailable ? request.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Temporarily unavailable" } } }) : request.continue()),
	);
	await page.goto("/projects/" + project.id + "/routes/" + endpoint.id);
	const retry = page.getByRole("button", { name: "Retry loading route traffic", exact: true });
	await expect(retry).toBeVisible();
	unavailable = false;
	await retry.click();
	await expect(page.getByRole("img", { name: /^24-hour traffic: 0 incoming requests/ })).toBeVisible();
	const received = await page.request.post("/ingress/" + endpoint.ingress_key, { data: { type: "preview.traffic.updated" } });
	expect(received.status()).toBe(202);
	await expect(page.getByRole("img", { name: /^24-hour traffic: 1 incoming requests, 1 accepted/ })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Route recent executions", exact: true }).getByRole("row")).toHaveCount(2);
});

test("UX78 saved assertion scripts can be restored and run against the current handler", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	await ensureBrowserOwner(page);
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Saved test review", slug: "saved-test-review" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Test route", slug: "test-route" } })).json();
	const draft = await page.request.patch("/api/v1/endpoints/" + route.id + "/drafts/ingress", { headers: { ...headers, "if-match": '"1"' }, data: { body: 'export async function POST(ctx:IngressContext){return ctx.respondOnly({status:200,body:"fixture"});}' } });
	expect(draft.status()).toBe(200);

	const created = await page.request.post("/api/v1/endpoints/" + route.id + "/tests", {
		headers: commandHeaders(),
		data: {
			name: "Saved response",
			version: 0,
			definition: {
				stage: "ingress",
				includeMiddleware: true,
				assertionSource: 'export default async function checks({decision,test,expect}:ScriptTestContext){await test("Returns a decision",()=>expect(decision.kind).toBeTruthy());}',
				fixture: {
					body: '{"type":"synthetic"}',
					contentType: "application/json",
					method: "POST",
					headers: {},
					secrets: {},
				},
				expectations: {},
			},
		},
	});
	expect(created.status()).toBe(200);
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=test");
	await chooseOption(page.getByRole("button", { name: /Saved test/ }), (await created.json()).id);
	await expect(page.getByLabel("Test name", { exact: true })).toHaveValue("Saved response");
	await expect(page.getByRole("region", { name: "TypeScript test assertions" }).locator(".view-lines")).toContainText("Returns a decision");
	await page.getByRole("tab", { name: "Checks", exact: true }).click();
	await page.getByRole("region", { name: "TypeScript test assertions" }).getByText("ScriptTestContext", { exact: true }).hover();
	await expect(page.locator(".monaco-hover").filter({ hasText: "ScriptTestContext" }).last()).toContainText("response");
	await page.mouse.move(0, 0);

	await page.getByLabel("Test name", { exact: true }).fill("Updated response test");
	await page.getByRole("button", { name: "Save test", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/endpoints/" + route.id + "/tests")).json())[0].version).toBe(2);

	const runResponse = page.waitForResponse((response) => response.url().endsWith("/endpoints/" + route.id + "/test") && response.request().method() === "POST");
	await page.getByRole("button", { name: "Test ingress (dry)", exact: true }).click();
	expect((await runResponse).status()).toBe(200);
	await expect(page.getByRole("region", { name: "Synthetic test result" })).toContainText("Returns a decision");
	await expect(page.getByRole("list", { name: "Test checks" })).not.toContainText("undefined");
	await page.screenshot({ path: "/tmp/pab-audit-saved-tests-desktop.png", fullPage: true, animations: "disabled" });
	await page.getByRole("button", { name: "Delete saved test", exact: true }).click();
	await page.getByRole("dialog", { name: "Delete saved test?" }).getByRole("button", { name: "Delete test", exact: true }).click();
	await expect(page.getByLabel("Test name", { exact: true })).toHaveValue("");
	await page.getByLabel("Test name", { exact: true }).fill("New browser-created test");
	await page.getByRole("button", { name: "Save test", exact: true }).click();
	await expect.poll(async () => (await (await page.request.get("/api/v1/endpoints/" + route.id + "/tests")).json())[0]?.name).toBe("New browser-created test");
});

test("UX88 sign-in cooldown disables resend and survives reload until its deadline", async ({ page }) => {
	await page.clock.install();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/login");
	await page.getByLabel("Email address", { exact: true }).fill("viewer@preview.payloadbay.test");
	await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
	await expect(page.getByLabel("Sign-in code", { exact: true })).toBeVisible();
	const address = page.getByText("viewer@preview.payloadbay.test", { exact: true });
	const lines = await address.evaluate((element) => element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight));
	expect(lines).toBeLessThan(1.1);
	await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
	await page.screenshot({ path: test.info().outputPath("login-resend-cooldown-mobile.png") });
	await page.reload();
	await page.getByLabel("Email address", { exact: true }).fill("viewer@preview.payloadbay.test");
	await expect(page.getByRole("button", { name: /Send code in \d+s/ })).toBeDisabled();
	await page.clock.fastForward(31_000);
	await expect(page.getByRole("button", { name: "Send sign-in code", exact: true })).toBeEnabled();
	const longEmail = "a".repeat(60) + "@" + "b".repeat(60) + ".test";
	await page.getByLabel("Email address", { exact: true }).fill(longEmail);
	await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
	await expect(page.getByText(longEmail, { exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await page.screenshot({ path: test.info().outputPath("login-long-address-mobile.png") });
});

test("UX90 synthetic accepted JSON is readable while its wire payload remains byte-safe", async ({ page }) => {
	const { ensureBrowserOwner, commandHeaders } = await import("../helpers/browser-auth.ts");
	const { unverifiedHttpTemplate } = await import("../../packages/script-sdk/src/templates/unverified.ts");
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	const headers = commandHeaders();
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const project = await (await page.request.post("/api/v1/projects", { headers, data: { parentId: workspace.id, name: "Readable results", slug: "readable-results" } })).json();
	const route = await (await page.request.post("/api/v1/projects/" + project.id + "/endpoints", { headers, data: { name: "Readable route", slug: "readable-route" } })).json();
	const saved = await page.request.patch("/api/v1/endpoints/" + route.id + "/drafts/ingress", { headers: { ...headers, "if-match": '\"1\"' }, data: { body: unverifiedHttpTemplate.source } });
	expect(saved.status()).toBe(200);
	await page.goto("/projects/" + project.id + "/routes/" + route.id + "?section=test");
	const response = page.waitForResponse((result) => result.url().endsWith("/endpoints/" + route.id + "/test") && result.request().method() === "POST");
	await page.getByRole("button", { name: "Test ingress (dry)", exact: true }).click();
	const wire = await response;
	expect(wire.status()).toBe(200);
	const { unpackWire } = await import("../../packages/contracts/src/wire.ts");
	const transported = unpackWire(await wire.json()) as { decision: { event: { body: Uint8Array } } };
	expect(transported.decision.event.body).toBeInstanceOf(Uint8Array);
	const result = page.getByLabel("Handler decision", { exact: true });
	await expect(result).toContainText("purchase.completed", { timeout: 20000 });
	const decision = JSON.parse((await result.textContent())!);
	expect(decision.kind).toBe("accept");
	expect(decision.event.body).toEqual({ type: "purchase.completed", data: { orderId: "demo-001", amount: 4900, currency: "EUR" } });
	await result.scrollIntoViewIfNeeded();
	await page.screenshot({ path: test.info().outputPath("readable-script-result-mobile.png") });
});
