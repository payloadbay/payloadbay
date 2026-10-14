import { expect, test } from "bun:test";
import { validateInventory, selectAffected, assertNonemptyRun, checkCoverage } from "../../scripts/tests/policy.ts";

test("inventory rejects an unowned test instead of silently omitting it", () => {
	expect(() => validateInventory(["tests/unit/a.test.ts"], {})).toThrow("Unowned");
});
test("inventory rejects registered files missing from disk", () => {
	expect(() => validateInventory([], { "tests/unit/a.test.ts": "unit" })).toThrow("Missing");
});
test("known dependencies select owning whole files", () => {
	expect(selectAffected(["scripts/tests/policy.ts"], ["a", "b"], { a: ["scripts/tests/policy.ts"], b: ["other.ts"] })).toEqual(["a"]);
});
test("unknown changes broaden to the complete inventory", () => {
	expect(selectAffected(["new-module.ts"], ["a", "b"], { a: ["a.ts"], b: ["b.ts"] })).toEqual(["a", "b"]);
});
test("empty test selections cannot be green", () => {
	expect(() => assertNonemptyRun("bun", "0 pass\n0 fail")).toThrow("No passing");
	expect(() => assertNonemptyRun("node", "# tests 2\n# pass 0\n# skipped 2")).toThrow("No passing");
});
test("passing tests with failed assertions still fail the gate", () => {
	expect(() => assertNonemptyRun("bun", "1 pass\n1 fail")).toThrow("Failures");
});
test("coverage rejects unloaded required source files", () => {
	expect(() => checkCoverage("SF:loaded.ts\nLF:1\nLH:1\nFNF:1\nFNH:1\nend_of_record\n", ["unloaded.ts"], 0.8)).toThrow("Missing coverage");
});
test("coverage rejects below-threshold lines and functions independently", () => {
	expect(() => checkCoverage("SF:a.ts\nLF:10\nLH:7\nFNF:1\nFNH:1\nend_of_record\n", ["a.ts"], 0.8)).toThrow("Line coverage");
	expect(() => checkCoverage("SF:a.ts\nLF:10\nLH:10\nFNF:10\nFNH:7\nend_of_record\n", ["a.ts"], 0.8)).toThrow("Function coverage");
});
test("coverage accepts the exact threshold boundary", () => {
	expect(checkCoverage("SF:a.ts\nLF:10\nLH:8\nFNF:10\nFNH:8\nend_of_record\n", ["a.ts"], 0.8)).toEqual({ lines: 0.8, functions: 0.8 });
});

import { executorRuntime, validateRuntime } from "../../scripts/tests/runtime.ts";

test("executor runtime defaults to ordinary Docker", () => {
	expect(executorRuntime()).toBe("runc");
	expect(executorRuntime("")).toBe("runc");
});
test("explicit gVisor selection is preserved", () => expect(executorRuntime("runsc")).toBe("runsc"));
test("unknown executor runtime setting is rejected", () => expect(() => executorRuntime("docker-ish")).toThrow("runc or runsc"));
test("missing selected gVisor fails without silent fallback", () => expect(() => validateRuntime("runsc", { runc: {} })).toThrow("Set PAYLOADBAY_EXECUTOR_RUNTIME=runc"));
test("ordinary Docker does not require gVisor", () => expect(validateRuntime("runc", { runc: {} })).toBe("runc"));

import assert from "node:assert/strict";

test("U280 migration generation belongs to master CI only", () => {
	const { canGenerateReleaseMigrations, migrationPolicyViolations } = require("../../scripts/database/migration-policy.ts");
	const generated = ["packages/domain/drizzle/0000_initial.sql", "packages/domain/drizzle/meta/0000_snapshot.json", "packages/domain/drizzle/meta/_journal.json"];
	assert.equal(canGenerateReleaseMigrations({}), false, "local migration generation must be denied");
	assert.deepEqual(migrationPolicyViolations([...generated, "packages/domain/src/schema.ts", "packages/domain/sql/runtime.sql", "tests/fixtures/schema-history/0001_foundation.sql"], {}), generated);
	const ci = { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/master", PAYLOADBAY_MIGRATION_WORKFLOW: "true" };
	assert.equal(canGenerateReleaseMigrations(ci), true);
	assert.deepEqual(migrationPolicyViolations(generated, ci), []);
	assert.equal(canGenerateReleaseMigrations({ ...ci, GITHUB_REF: "refs/pull/1/merge" }), false);
});

test("U283 OTP selector matches new recipient mail despite stale index count", () => {
	const { selectVerificationMail } = require("../helpers/mail-selection.ts");
	const owner = { ID: "owner-old", To: [{ Address: "owner@example.test" }], Created: "2026-10-14T09:00:00Z" };
	const viewer = { ID: "viewer-new", To: [{ Address: "viewer@example.test" }], Created: "2026-10-14T09:00:00Z" };
	const previous = new Set(["owner-old"]);
	assert.equal(selectVerificationMail([owner, viewer], "viewer@example.test", previous)?.ID, "viewer-new", "OTP selector must follow intended recipient");
	assert.equal(selectVerificationMail([owner], "viewer@example.test", previous), undefined, "indexed list must contain requested recipient before verification");
	const nextOwner = { ...owner, ID: "owner-new" };
	assert.equal(selectVerificationMail([owner, nextOwner], "owner@example.test", previous)?.ID, "owner-new");
});
