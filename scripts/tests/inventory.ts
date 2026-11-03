import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateInventory } from "./policy.ts";

export const registry = JSON.parse(readFileSync(new URL("../../tests/config/inventory.json", import.meta.url), "utf8"));

export function discover(dir = "tests"): string[] {
	return readdirSync(dir, { withFileTypes: true })
		.flatMap((e) => (e.isDirectory() ? discover(join(dir, e.name)) : /\.(test|spec)\.ts$/.test(e.name) ? [join(dir, e.name).replaceAll("\\", "/")] : []))
		.sort();
}

export function inventory() {
	return validateInventory(discover(), registry.owners);
}

if (import.meta.main) console.log(JSON.stringify({ implemented: inventory(), plannedProductSuites: registry.plannedProductSuites }, null, 2));
