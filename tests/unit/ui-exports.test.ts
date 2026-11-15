import { expect, test } from "bun:test";
import { Tooltip } from "../../apps/web/src/app/components/ui/tooltip.tsx";

test("the shared tooltip preserves public HeroUI trigger and content composition", () => {
	expect(typeof Tooltip).toBe("function");
	expect(Tooltip.Trigger).toBeDefined();
	expect(Tooltip.Content).toBeDefined();
});
