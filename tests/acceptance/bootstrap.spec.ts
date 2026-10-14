import { test, expect } from "@playwright/test";

test("local branded shell opens the HeroUI Pro setup sheet", async ({ page }) => {
	const remote: string[] = [];
	page.on("request", (r) => {
		if (!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) remote.push(r.url());
	});
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Payload Bay", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "View setup status" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByText("The application shell is ready. Backend setup follows.")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).not.toBeVisible();
	expect(remote).toEqual([]);
});
