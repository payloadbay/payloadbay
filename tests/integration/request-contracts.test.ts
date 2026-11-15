import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { scriptTestInput } from "../../packages/contracts/src/script-test.ts";
import { tokenInput } from "../../packages/contracts/src/resources.ts";

test("SC01 Node script-test requests enforce UTF-8 byte budgets, strict fields and supported HTTP methods", () => {
	const input = { stage: "ingress", body: "return ctx.respondOnly({status:200});", fixture: { body: "synthetic webhook" } };
	const defaults = scriptTestInput.parse(input);
	assert.equal(defaults.fixture.method, "POST");
	assert.equal(defaults.fixture.contentType, "application/json");
	assert.deepEqual(defaults.fixture.headers, {});
	assert.deepEqual(defaults.fixture.secrets, {});
	assert.deepEqual(defaults.sharedBindings, {});
	for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) assert.equal(scriptTestInput.parse({ ...input, fixture: { ...input.fixture, method } }).fixture.method, method);
	assert.equal(scriptTestInput.safeParse({ ...input, fixture: { body: "é".repeat(524288) } }).success, true);
	assert.equal(scriptTestInput.safeParse({ ...input, fixture: { body: "é".repeat(524289) } }).success, false);
	for (const fixture of [
		{ ...input.fixture, headers: { synthetic: "é".repeat(8192) } },
		{ ...input.fixture, secrets: { synthetic: "é".repeat(32768) } },
		{ ...input.fixture, method: "TRACE" },
		{ ...input.fixture, unknownField: true },
	])
		assert.equal(scriptTestInput.safeParse({ ...input, fixture }).success, false);
	const sharedBindings = Object.fromEntries(Array.from({ length: 32 }, (_, index) => ["helper" + index, randomUUID()]));
	assert.equal(scriptTestInput.safeParse({ ...input, sharedBindings }).success, true);
	assert.equal(scriptTestInput.safeParse({ ...input, sharedBindings: { ...sharedBindings, extra: randomUUID() } }).success, false);
	assert.equal(scriptTestInput.safeParse({ ...input, unexpected: true }).success, false);
});

test("SC02 token request contracts restrict workspace selectors to organization scope", () => {
	const id = randomUUID();
	const token = {
		name: "Synthetic review token",
		permissions: ["metadata.read"],
		expiresAt: "2030-01-01T00:00:00.000Z",
		scope: { type: "organization", id },
	};
	assert.equal(tokenInput.safeParse(token).success, true);
	assert.equal(tokenInput.safeParse({ ...token, workspaceIds: [randomUUID()] }).success, true);
	for (const type of ["instance", "workspace", "project"]) assert.equal(tokenInput.safeParse({ ...token, scope: { type, id }, workspaceIds: [randomUUID()] }).success, false);
	assert.equal(tokenInput.safeParse({ ...token, workspaceIds: [] }).success, false);
	assert.equal(tokenInput.safeParse({ ...token, permissions: ["unknown.permission"] }).success, false);
	assert.equal(tokenInput.safeParse({ ...token, unexpected: true }).success, false);
});

test("SC03 account inbox and personal key queries remain documented with complete scope validation", async () => {
	const { apiQuerySchemas } = await import("../../packages/contracts/src/api-query-schemas.ts");
	const { openApiDocument } = await import("../../packages/contracts/src/openapi.ts");
	const inbox = apiQuerySchemas["/api/v1/notifications"];
	assert.equal(inbox.safeParse({ account: "true" }).success, true);
	assert.equal(inbox.safeParse({ scopeType: "project", scopeId: randomUUID() }).success, true);
	assert.equal(inbox.safeParse({ scopeType: "project" }).success, false);
	assert.equal(inbox.safeParse({ account: "true", scopeType: "project", scopeId: randomUUID() }).success, false);
	const keys = apiQuerySchemas["/api/v1/tokens"];
	assert.equal(keys.safeParse({ scopeType: "personal" }).success, true);
	assert.equal(keys.safeParse({ scopeType: "workspace" }).success, false);
	const document = openApiDocument();
	assert.ok(document.paths["/api/v1/notifications"].get.parameters.some((parameter) => parameter.name === "account"));
	assert.ok(document.paths["/api/v1/tokens"].get.parameters.some((parameter) => parameter.name === "scopeType"));
});

test("SC04 documented audit queries require both scope fields or neither", async () => {
	const { apiQuerySchemas } = await import("../../packages/contracts/src/api-query-schemas.ts");
	const audit = apiQuerySchemas["/api/v1/audit"];
	assert.equal(audit.safeParse({}).success, true);
	assert.equal(audit.safeParse({ scopeType: "organization", scopeId: randomUUID() }).success, true);
	for (const query of [{ scopeType: "organization" }, { scopeId: randomUUID() }, { scopeType: "organization", scopeId: "not-an-id" }]) assert.equal(audit.safeParse(query).success, false);
});

test("UX89 result inspection renders bytes as JSON, text or lossless base64 without mutating them", async () => {
	const { formatJsonResult } = await import("../../apps/web/src/app/lib/format-json-result.ts");
	const body = new TextEncoder().encode('{"type":"purchase.completed","data":{"amount":4900}}');
	const original = body.slice();
	const decision = { kind: "accept", event: { body, contentType: "application/json" } };
	assert.deepEqual(JSON.parse(formatJsonResult(decision)!), { kind: "accept", event: { body: { type: "purchase.completed", data: { amount: 4900 } }, contentType: "application/json" } });
	assert.deepEqual(body, original);
	assert.equal(JSON.parse(formatJsonResult({ body: new TextEncoder().encode("{broken-json"), contentType: "application/json" })!).body, "{broken-json");
	assert.equal(JSON.parse(formatJsonResult({ body: new TextEncoder().encode("123"), contentType: "text/plain" })!).body, "123");
	assert.deepEqual(JSON.parse(formatJsonResult({ body: new TextEncoder().encode("Hello \u{1f44b}") })!), { body: "Hello \u{1f44b}" });
	assert.deepEqual(JSON.parse(formatJsonResult({ body: new Uint8Array([0, 255, 128]) })!).body, { encoding: "base64", data: "AP+A" });
	assert.deepEqual(JSON.parse(formatJsonResult({ body: { 0: 123, 1: 34 } })!).body, { 0: 123, 1: 34 });
});
