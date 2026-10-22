import { saveInstallationConfiguration } from "../../packages/domain/src/installation-configuration.ts";
import { test, expect } from "../helpers/browser-test.ts";
import { nextFixture } from "../helpers/next-fixture.ts";
import { identity, setupSecret, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";
import { runOnce } from "../../apps/worker/node_modules/graphile-worker/dist/index.js";
import { platformJobTask } from "../../apps/worker/src/tasks/platform-job.ts";

test("FT06b a verified new customer creates an organization through the mobile setup flow", async ({ page }) => {
	await nextFixture(async (f) => {
		try {
			await identity(f.db, "operator");
			await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
			const installation = (await f.db.query("SELECT id FROM payloadbay.installation WHERE singleton")).rows[0];
			await saveInstallationConfiguration(f.pool, { userId: "operator" }, installation.id, fixtureConfig(f), { version: 0, settings: { registrationPolicy: "organization" } });
			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(f.url + "/login");
			await expect(page.getByRole("heading", { name: "Welcome to Payload Bay" })).toBeVisible();
			await page.getByLabel("Email address").fill("customer-browser@example.test");
			await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
			await expect(page.getByLabel("Sign-in code")).toBeVisible();
			await runOnce({
				pgPool: f.pool,
				noHandleSignals: true,
				concurrency: 1,
				taskList: { platform_job: platformJobTask(f.pool, fixtureConfig(f)) },
			});
			const messages = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
			const message = await (await fetch(f.mailUrl + "/api/v1/message/" + messages.messages[0].ID)).json();
			const otp = message.Text.match(/\b\d{6}\b/)?.[0];
			expect(otp).toBeTruthy();
			await page.getByLabel("Sign-in code").fill(otp!);
			await page.getByRole("button", { name: "Sign in", exact: true }).click();
			await expect(page).toHaveURL(f.url + "/onboarding");
			let onboardingUnavailable = true;
			await page.route("**/api/v1/onboarding", async (route) => {
				if (onboardingUnavailable && route.request().method() === "GET") await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Temporary setup outage" } } });
				else await route.continue();
			});
			await page.reload();
			await expect(page.getByRole("heading", { name: "Organization setup unavailable", exact: true })).toBeVisible();
			onboardingUnavailable = false;
			await page.getByRole("button", { name: "Retry setup", exact: true }).click();
			await page.getByLabel("Organization name").fill("Customer company");
			await page.getByRole("button", { name: "Create organization and continue", exact: true }).click();
			await expect(page).toHaveURL(/\/workspaces\/[0-9a-f-]+$/);
			await expect(page.getByRole("heading", { name: "Default workspace", exact: true })).toBeVisible();
			const me = await (await page.request.get(f.url + "/api/v1/me")).json();
			expect(me.permissions).toEqual([]);
			const organizations = await (await page.request.get(f.url + "/api/v1/organizations")).json();
			expect(organizations.map((organization: { name: string }) => organization.name)).toEqual(["Customer company"]);
			await expect(page.getByRole("button", { name: "Create project", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Create project", exact: true }).click();
			await page.getByLabel("Project name", { exact: true }).fill("First project");
			await page.getByRole("button", { name: "Create project", exact: true }).last().click();
			await expect(page.getByRole("heading", { name: "First project", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Add ingress route", exact: true }).click();
			await page.getByLabel("Name", { exact: true }).fill("First webhook");
			await page.getByRole("button", { name: "Create ingress route", exact: true }).click();
			await expect(page.getByRole("row").filter({ hasText: "First webhook" })).toBeVisible();
			await page.screenshot({
				path: test.info().outputPath("customer-workspace-mobile.png"),
				fullPage: true,
				animations: "disabled",
				timeout: 5000,
			});
		} finally {
			await page.goto("about:blank");
		}
	}, {});
});
