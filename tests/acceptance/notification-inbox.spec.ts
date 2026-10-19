import { test, expect } from "../helpers/browser-test.ts";
import { ensureBrowserOwner, commandHeaders } from "../helpers/browser-auth.ts";
import { resetBrowserData } from "../helpers/browser-data.ts";
import { database } from "../../packages/domain/src/db.ts";
import { reconcileCondition } from "../../packages/domain/src/notifications.ts";

test.beforeEach(resetBrowserData);

test("U180 U181 notification attention describes severity and follows real scoped producer changes", async ({ page }) => {
	await ensureBrowserOwner(page);
	const workspace = (await (await page.request.get("/api/v1/workspaces")).json())[0];
	const created = await page.request.post("/api/v1/projects", { headers: commandHeaders(), data: { parentId: workspace.id, name: "Notification attention", slug: "notification-attention" } });
	expect(created.status()).toBe(200);
	const project = await created.json();
	await page.goto(`/projects/${project.id}`);
	const attention = page.getByRole("button", { name: "Notifications", exact: true });
	await attention.click();
	const initial = page.getByRole("dialog", { name: "Notifications", exact: true });
	await initial.getByRole("button", { name: "Dismiss notification Scripts use ordinary Docker containment", exact: true }).click();
	await initial.getByRole("button", { name: "Close notifications", exact: true }).click();
	await expect(attention).toHaveAccessibleDescription("No active notifications.");
	const pool = database(process.env.DATABASE_URL!);
	try {
		for (const [index, severity] of (["info", "warning", "critical"] as const).entries()) {
			await reconcileCondition(pool, {
				key: `fixture-${severity}`,
				revision: "1",
				kind: "delivery.failure-threshold",
				scope: { type: "project", id: project.id },
				subject: `Fixture ${severity} condition`,
				severity,
				active: true,
			});
			await expect(attention).toHaveAccessibleDescription(`${index + 1} active notification${index === 0 ? "" : "s"}. Highest severity: ${severity}.`);
			await expect(attention.getByLabel("Active notification count")).toHaveText(String(index + 1));
		}

		for (const [index, severity] of (["critical", "warning", "info"] as const).entries()) {
			await attention.click();
			const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
			await dialog.getByRole("button", { name: `Dismiss notification Fixture ${severity} condition`, exact: true }).click();
			await expect(dialog.getByRole("heading", { name: `Fixture ${severity} condition`, exact: true })).toHaveCount(0);
			await dialog.getByRole("button", { name: "Close notifications", exact: true }).click();
			await expect(dialog).toHaveCount(0);
			const remaining = 2 - index;
			await expect(attention).toHaveAccessibleDescription(remaining === 0 ? "No active notifications." : `${remaining} active notification${remaining === 1 ? "" : "s"}. Highest severity: ${index === 0 ? "warning" : "info"}.`);
		}
	} finally {
		await pool.end();
	}
});

test("UX72 notification snooze persists after navigation and returns after expiry", async ({ page }) => {
	await ensureBrowserOwner(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
	const subject = "Scripts use ordinary Docker containment";
	await expect(dialog.getByRole("button", { name: subject, exact: true })).toBeVisible();
	const snooze = dialog.getByRole("button", { name: "Snooze notification " + subject });
	const buttonBox = await snooze.boundingBox();
	const iconBox = await snooze.locator("svg").boundingBox();
	expect(Math.abs(buttonBox!.x + buttonBox!.width / 2 - (iconBox!.x + iconBox!.width / 2))).toBeLessThan(2);
	await page.screenshot({ path: "/tmp/pab-mobile-review-notifications.png", animations: "disabled" });
	await dialog.getByRole("button", { name: subject, exact: true }).click();
	await expect(dialog).toContainText("Configured mode:");
	await snooze.click();
	await page.screenshot({ path: "/tmp/pab-mobile-review-snooze.png", animations: "disabled" });
	await page
		.getByRole("menu", { name: "Snooze notification " + subject })
		.getByRole("menuitem", { name: "One hour", exact: true })
		.click();
	await expect(dialog.getByRole("button", { name: subject, exact: true })).toHaveCount(0);
	await page.reload();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toContainText("No active notifications.");
	const pool = database(process.env.DATABASE_URL!);
	try {
		await pool.query("UPDATE payloadbay.notification_recipient_state SET snoozed_until=clock_timestamp()-interval '1 second' WHERE snoozed_until IS NOT NULL");
	} finally {
		await pool.end();
	}

	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.reload();
	await page.getByRole("button", { name: "Notifications", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Notifications", exact: true }).getByRole("button", { name: subject, exact: true })).toBeVisible();
});
