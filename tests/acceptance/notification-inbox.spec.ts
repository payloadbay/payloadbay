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
	await initial.getByRole("button", { name: "Close", exact: true }).click();
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
			await dialog.getByRole("button", { name: "Close", exact: true }).click();
			await expect(dialog).toHaveCount(0);
			const remaining = 2 - index;
			await expect(attention).toHaveAccessibleDescription(remaining === 0 ? "No active notifications." : `${remaining} active notification${remaining === 1 ? "" : "s"}. Highest severity: ${index === 0 ? "warning" : "info"}.`);
		}
	} finally {
		await pool.end();
	}
});
