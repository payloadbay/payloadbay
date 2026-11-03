import { test, expect } from "bun:test";
import { effectivePermissions, type ScopeRef } from "../../packages/domain/src/authorization.ts";

const ancestry: ScopeRef[] = [
	{ type: "instance", id: "instance" },
	{ type: "workspace", id: "workspace" },
	{ type: "project", id: "project" },
];

test("inherited grants union across instance workspace project", () => {
	expect(
		[
			...effectivePermissions(
				[
					{ scopeType: "instance", scopeId: "instance", permissions: ["metadata.read"] },
					{ scopeType: "workspace", scopeId: "workspace", permissions: ["payload.read"] },
					{ scopeType: "project", scopeId: "project", permissions: ["events.replay"] },
				],
				ancestry,
			),
		].sort(),
	).toEqual(["events.replay", "metadata.read", "payload.read"]);
});

test("U54 project grant cannot access sibling project", () => {
	expect([...effectivePermissions([{ scopeType: "project", scopeId: "sibling", permissions: ["payload.read"] }], ancestry)]).toEqual([]);
});

test("U55 child permissions cannot deny inherited grants", () => {
	expect([
		...effectivePermissions(
			[
				{ scopeType: "workspace", scopeId: "workspace", permissions: ["payload.read"] },
				{ scopeType: "project", scopeId: "project", permissions: [] },
			],
			ancestry,
		),
	]).toEqual(["payload.read"]);
});

test("U56 grantor cannot escalate permissions", async () => {
	const { assertGrantSubset } = await import("../../packages/domain/src/authorization.ts");
	expect(() => assertGrantSubset(new Set(["metadata.read"]), ["code.publish"])).toThrow("You cannot grant permissions");
	expect(() => assertGrantSubset(new Set(["metadata.read"]), ["metadata.read"])).not.toThrow();
});
