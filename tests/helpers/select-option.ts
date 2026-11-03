import type { Locator } from "@playwright/test";

/** Exercise the active HeroUI menu, excluding an earlier menu's exit transition. */
export async function chooseOption(control: Locator, choice: string | { label?: string; value?: string }) {
	await control.click();
	const list = control.page().getByRole("listbox").last();
	const label = typeof choice === "object" ? choice.label : undefined;
	if (label) {
		await list.getByRole("option", { name: label, exact: true }).click();

		return;
	}

	const value = typeof choice === "string" ? choice : choice.value;
	await list
		.getByRole("option")
		.and(list.locator("[data-key=" + JSON.stringify(value) + "]"))
		.click();
}
