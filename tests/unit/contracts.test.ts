import { expect, test } from "bun:test";
import { readConfig } from "../../packages/domain/src/config.ts";

const smtp = {
	SMTP_HOST: "mail.example.test",
	SMTP_PORT: "587",
	SMTP_USER: "sender",
	SMTP_PASSWORD: "fixture-password",
	SMTP_FROM: "Payload Bay <sender@example.test>",
};
test("U1 complete SMTP configuration is accepted", () => {
	expect(readConfig(smtp).smtp).toEqual({
		host: "mail.example.test",
		port: 587,
		secure: false,
		user: "sender",
		password: "fixture-password",
		from: "Payload Bay <sender@example.test>",
	});
});

test("U2 partial SMTP configuration reports a configuration error", () => {
	expect(() => readConfig({ SMTP_HOST: "mail.example.test" })).toThrow("SMTP configuration is incomplete");
});

test("U3 environment values cannot enable database-managed OAuth clients", () => {
	expect(readConfig({ ...smtp, GOOGLE_CLIENT_ID: "ignored-client" }).oauth).toEqual({});
	expect(
		readConfig({
			...smtp,
			GOOGLE_CLIENT_ID: "ignored-client",
			GOOGLE_CLIENT_SECRET: "ignored-secret",
			GITHUB_CLIENT_ID: "ignored-github",
		}).oauth,
	).toEqual({});
});

import { publicError } from "../../packages/contracts/src/errors.ts";

test("U4 public errors omit secrets and SQL internals", () => {
	expect(publicError(new Error("password=fixture-secret SELECT * FROM private_payloads"), "request-1")).toEqual({ error: { code: "internal_error", message: "An unexpected error occurred", correlationId: "request-1" } });
});

import { pageQuery } from "../../packages/contracts/src/api.ts";

test("U5 valid public Zod values retain documented shapes", () => {
	expect(pageQuery.parse({ limit: 200, cursor: "42" })).toEqual({ limit: 200, cursor: "42" });
});

import { compile } from "../../apps/executor/src/compiler.ts";

test("U11 body invokes fixed default lifecycle entrypoint", async () => {
	const result = await compile({ stage: "ingress", body: 'return {kind:"respondOnly",response:{status:200,body:ctx.request.headers["x-challenge"]}};' });
	const module = await import("data:text/javascript;base64," + Buffer.from(result.bundle).toString("base64"));
	expect(await module.default({ request: { headers: { "x-challenge": "challenge-exact" } } })).toEqual({ kind: "respondOnly", response: { status: 200, body: "challenge-exact" } });
});

test("U12 raw wrapper replacement is rejected", async () => {
	await expect(compile({ stage: "ingress", body: 'return {kind:"respondOnly",response:{status:200,body:"ok"}};', module: "export default function ingress2() {}" })).rejects.toThrow("Script compilation failed");
});

test("U13 unregistered imports are rejected at publication", async () => {
	try {
		await compile({ stage: "processing", body: 'const fs = await import("node:fs"); return ctx.complete();' });
		throw Error("Publication should fail");
	} catch (error) {
		expect((error as { diagnostics?: { code: string }[] }).diagnostics?.[0]?.code).toBe("unregistered_import");
	}
});

test("U14 pinned helper binding resolves above wrapper", async () => {
	const result = await compile({ stage: "ingress", body: 'return helper.challenge("exact");', sharedModules: { helper: { revisionId: "helper-revision-1", source: 'export function challenge(body:string){return {kind:"respondOnly" as const,response:{status:200,body}};}' } } });
	const module = await import("data:text/javascript;base64," + Buffer.from(result.bundle).toString("base64"));
	expect(await module.default({})).toEqual({ kind: "respondOnly", response: { status: 200, body: "exact" } });
	expect(result.sharedVersions).toEqual({ helper: "helper-revision-1" });
});

test("U15 syntax errors point to editable source line", async () => {
	try {
		await compile({ stage: "ingress", sourceId: "route-ingress", body: 'const fine = 1;\nconst broken = ;\nreturn ctx.reject({status:400,body:"invalid"});' });
		throw Error("Compilation should fail");
	} catch (error) {
		expect((error as { diagnostics?: unknown[] }).diagnostics?.[0]).toMatchObject({ sourceId: "route-ingress", line: 2, severity: "error" });
	}
});

import { validateDecision } from "../../packages/contracts/src/lifecycle.ts";

test("U16 invalid stage outcomes fail typed and runtime validation", async () => {
	await expect(compile({ stage: "processing", body: 'return {kind:"madeUp"};' })).rejects.toThrow("Script compilation failed");
	expect(() => validateDecision("processing", { kind: "madeUp" })).toThrow("Invalid stage outcome");
});

import { AppError } from "../../packages/contracts/src/errors.ts";

test("U182 typed application error preserves safe public code", () => {
	expect(publicError(new AppError("not_found", 404, "Resource unavailable"), "request-2")).toEqual({ error: { code: "not_found", message: "Resource unavailable", correlationId: "request-2" } });
});

test("U183 valid binary protocol outcome remains valid", () => {
	const decision = { kind: "respondOnly" as const, response: { status: 200, headers: { "content-type": "application/octet-stream" }, body: new Uint8Array([0, 255, 42]) } };
	expect(validateDecision("ingress", decision)).toEqual(decision);
});

import { readServerConfig } from "../../packages/domain/src/config.ts";

const serverEnv = {
	...smtp,
	DATABASE_URL: "postgres://fixture:fixture@localhost/fixture",
	BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
	PAYLOADBAY_ENCRYPTION_KEY: "fixture-encryption-key-32-characters",
	PAYLOADBAY_BOOTSTRAP_SECRET: "fixture-bootstrap-key-32-characters",
	PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
	PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
};

test("U204 complete server configuration receives bounded defaults", () => {
	const config = readServerConfig(serverEnv);
	expect({
		body: config.bodyLimit,
		headers: config.headerLimit,
		ingress: config.ingressDeadlineMs,
		processing: config.processingDeadlineMs,
		http: config.httpTimeoutMs,
		attempts: config.maxAttempts,
		mode: config.executorMode,
	}).toEqual({
		body: 1048576,
		headers: 16384,
		ingress: 2000,
		processing: 30000,
		http: 10000,
		attempts: 5,
		mode: "runc",
	});
});

test("U205 invalid limits expose no configuration secrets", () => {
	try {
		readServerConfig({ ...serverEnv, PAYLOADBAY_PROCESSING_DEADLINE_MS: "0" });
		throw Error("Configuration should fail");
	} catch (error) {
		expect(publicError(error, "request-config")).toEqual({ error: { code: "configuration_required", message: "Server configuration requires attention", correlationId: "request-config" } });
	}
});

test("U208 invalid SMTP TLS flag cannot silently downgrade", () => {
	expect(() => readConfig({ ...smtp, SMTP_SECURE: "sometimes" })).toThrow("SMTP TLS configuration is invalid");
});

test("U238 blank SMTP credentials are absent while partial auth fails", async () => {
	const { readConfig } = await import("../../packages/domain/src/config.ts");
	const base = { SMTP_HOST: "smtp.example.test", SMTP_PORT: "25", SMTP_FROM: "sender@example.test" };
	expect(readConfig({ ...base, SMTP_USER: "", SMTP_PASSWORD: "" }).smtp.user).toBeUndefined();
	expect(() => readConfig({ ...base, SMTP_USER: "alice", SMTP_PASSWORD: "" })).toThrow("incomplete");
});

test("U244 embedded compiler SDK cannot drift from canonical source", async () => {
	const { readFileSync } = await import("node:fs");
	const { sdkDeclarations } = await import("../../packages/script-sdk/src/declarations.generated.ts");
	expect(sdkDeclarations.replace(/\r\n/g, "\n")).toBe(readFileSync(new URL("../../packages/script-sdk/src/lifecycle.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n"));
});

test("U245 compilation API errors retain body line diagnostics", async () => {
	const { CompilationError } = await import("../../packages/contracts/src/compilation.ts");
	const { publicError } = await import("../../packages/contracts/src/errors.ts");
	const { errorEnvelope } = await import("../../packages/contracts/src/api.ts");
	const diagnostics = [
		{
			sourceId: "ingress",
			line: 2,
			column: 4,
			severity: "error" as const,
			code: "syntax",
			message: "Expected an expression",
		},
	];
	const error = new CompilationError(diagnostics);
	const response = publicError(error, "fixture-correlation");
	expect(response.error.code).toBe("compilation_failed");
	expect(error.status).toBe(422);
	expect(errorEnvelope.parse(response).error.diagnostics).toEqual(diagnostics);
	expect(JSON.stringify(response)).not.toContain("stack");
});

test("U95 ingress response rejects CRLF header injection", () => {
	expect(() => validateDecision("ingress", { kind: "respondOnly", response: { status: 200, body: "ok", headers: { "x-custom": "safe\r\nSet-Cookie: stolen=true" } } })).toThrow("Invalid stage outcome");
});

test("U268 provider response cannot set application cookies or transport headers", () => {
	for (const name of ["Set-Cookie", "connection", "transfer-encoding", "content-length", "upgrade"]) expect(() => validateDecision("ingress", { kind: "respondOnly", response: { status: 200, body: "ok", headers: { [name]: "fixture" } } })).toThrow("Invalid stage outcome");
});

test("U284 middleware continuation accepts only stage appropriate mutable fields", () => {
	const { validateDecision } = require("../../packages/contracts/src/lifecycle.ts");
	let outcome: unknown;
	try {
		outcome = validateDecision("ingress_middleware", { kind: "continue", patch: { request: { headers: { "x-tag": "custom" } } } });
	} catch {}

	expect(outcome, "middleware continuation must be valid").toEqual({ kind: "continue", patch: { request: { headers: { "x-tag": "custom" } } } });
	expect(() => validateDecision("ingress_middleware", { kind: "continue", patch: { request: { body: new Uint8Array([1]) } } })).toThrow("Invalid stage outcome");
	expect(() => validateDecision("ingress_middleware", { kind: "continue", patch: { endpointId: "changed" } })).toThrow("Invalid stage outcome");
	expect(() => validateDecision("processing_middleware", { kind: "continue", patch: { event: { originalBody: new Uint8Array([1]) } } })).toThrow("Invalid stage outcome");
	expect(() => validateDecision("processing_middleware", { kind: "reject", response: { status: 401, body: "bad" } })).toThrow("Invalid stage outcome");
	expect(validateDecision("processing_middleware", { kind: "continue", patch: { event: { body: "modified", metadata: { tag: "custom" } } } }).kind).toBe("continue");
});

test("U291 middleware patch does not invent omitted configuration defaults", () => {
	const { middlewareUpdateInput } = require("../../packages/contracts/src/code.ts");
	const value = middlewareUpdateInput.parse({ body: "return ctx.continue();" });
	expect(value.sharedBindings, "omitted binding maps must stay absent").toBeUndefined();
	expect(value.secretBindings).toBeUndefined();
	expect(value.requiredAction).toBeUndefined();
	expect(middlewareUpdateInput.parse({ secretBindings: {}, requiredAction: "fail" })).toEqual({ secretBindings: {}, requiredAction: "fail" });
});

test("U310 configuration cannot advertise unsupported alpha body or header limits", () => {
	const base = {
		PUBLIC_URL: "http://localhost:3000",
		DATABASE_URL: "postgres://fixture:fixture@localhost/fixture",
		SMTP_HOST: "localhost",
		SMTP_FROM: "fixture@example.test",
		SMTP_PORT: "1025",
		BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
		PAYLOADBAY_ENCRYPTION_KEY: "11".repeat(32),
		PAYLOADBAY_BOOTSTRAP_SECRET: "fixture-setup-secret-32-characters",
		PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
		PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
		EXECUTOR_URL: "http://localhost:8080",
	};
	const { readServerConfig } = require("../../packages/domain/src/config.ts");
	const defaults = readServerConfig(base);
	expect(defaults.bodyLimit).toBe(1048576);
	expect(defaults.headerLimit).toBe(16384);
	expect(() => readServerConfig({ ...base, PAYLOADBAY_BODY_LIMIT: "1048577" })).toThrow("Server configuration requires attention");
	expect(() => readServerConfig({ ...base, PAYLOADBAY_HEADER_LIMIT: "16385" })).toThrow("Server configuration requires attention");
	expect(readServerConfig({ ...base, PAYLOADBAY_BODY_LIMIT: "512" }).bodyLimit).toBe(512);
});

test("U312 accepted metadata stays within the processing metadata budget", () => {
	const accepted = (metadata: Record<string, unknown>) => ({ kind: "accept" as const, event: { body: "event", contentType: "application/json", metadata }, response: { status: 202, body: "stored" } });

	const atLimit = { value: "x".repeat(8180) };
	expect(Buffer.byteLength(JSON.stringify(atLimit))).toBe(8192);
	expect(validateDecision("ingress", accepted(atLimit))).toEqual(accepted(atLimit));
	expect(() => validateDecision("ingress", accepted({ value: "x".repeat(8181) }))).toThrow("Invalid stage outcome");
	expect(() => validateDecision("ingress", accepted({ value: "é".repeat(4091) }))).toThrow("Invalid stage outcome");
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	expect(() => validateDecision("ingress", accepted(cyclic))).toThrow("Invalid stage outcome");
});

test("U319 base URL follows Clipify Coolify runtime precedence", () => {
	const env = {
		...serverEnv,
		PUBLIC_URL: "https://stale.example.test",
		COOLIFY_URL: "http://13.preview.example.test:3000/path,https://other.example.test",
		COOLIFY_RESOURCE_UUID: "preview-resource",
	};
	expect(new URL(readServerConfig(env).publicUrl).origin).toBe("https://13.preview.example.test");
	expect(readServerConfig(env).publicUrl).toBe("https://13.preview.example.test");
	expect(new URL(readServerConfig(serverEnv).publicUrl + "/api/auth/get-session").pathname).toBe("/api/auth/get-session");
	expect(new URL(readServerConfig({ ...env, COOLIFY_RESOURCE_UUID: "", COOLIFY_URL: "" }).publicUrl).origin).toBe("https://stale.example.test");
	expect(new URL(readServerConfig({ ...serverEnv, PUBLIC_URL: "localhost:4000" }).publicUrl).origin).toBe("http://localhost:4000");
	expect(new URL(readServerConfig({ ...serverEnv, PUBLIC_URL: undefined, COOLIFY_URL: "preview.example.test:3000" }).publicUrl).origin).toBe("https://preview.example.test");
});

test("editable ingress dispatches named HTTP methods and reports unsupported methods", async () => {
	const compiled = await compile({
		stage: "ingress",
		body: `export async function GET(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:"ready"}); }
export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"queued"}}); }`,
	});
	const module = await import("data:text/javascript;base64," + Buffer.from(compiled.bundle).toString("base64"));

	const response = (value: unknown) => value;

	expect(await module.default({ request: { method: "GET" }, respondOnly: response })).toEqual({ status: 200, body: "ready" });
	expect(await module.default({ request: { method: "DELETE" }, respondOnly: response })).toEqual({ status: 405, headers: { allow: "GET, POST" }, body: "Method not allowed" });
	expect(await module.default({ request: { method: "POST", body: "event", contentType: "text/plain" }, accept: response })).toEqual({ event: { body: "event", contentType: "text/plain" }, response: { status: 202, body: "queued" } });
});

test("RT01 event retention is opt-in and rejects invalid deletion windows", () => {
	expect(readServerConfig(serverEnv).eventRetentionDays).toBe(0);
	expect(readServerConfig({ ...serverEnv, PAYLOADBAY_EVENT_RETENTION_DAYS: "0" }).eventRetentionDays).toBe(0);
	expect(readServerConfig({ ...serverEnv, PAYLOADBAY_EVENT_RETENTION_DAYS: "30" }).eventRetentionDays).toBe(30);
	for (const value of ["-1", "0.5", "36501", "not-a-number"]) expect(() => readServerConfig({ ...serverEnv, PAYLOADBAY_EVENT_RETENTION_DAYS: value })).toThrow("Server configuration requires attention");
});

test("UX70 documented token creation excludes instance authority and preserves personal/customer scopes", async () => {
	const { tokenCreationInput } = await import("../../packages/contracts/src/resources.ts");
	const { openApiDocument } = await import("../../packages/contracts/src/openapi.ts");
	const input = { name: "Review", permissions: ["metadata.read"], expiresAt: "2030-01-01T00:00:00.000Z" };
	expect(tokenCreationInput.safeParse({ ...input, scope: { type: "instance", id: "11111111-1111-4111-8111-111111111111" } }).success).toBe(false);
	expect(tokenCreationInput.safeParse({ ...input, scope: { type: "personal" } }).success).toBe(true);
	expect(tokenCreationInput.safeParse({ ...input, scope: { type: "project", id: "11111111-1111-4111-8111-111111111111" } }).success).toBe(true);
	expect(JSON.stringify(openApiDocument().paths["/api/v1/tokens"].post.requestBody)).not.toContain('"instance"');
});

test("UX71 helper declarations choose nearest scope and preserve explicit revision pins", async () => {
	const { helperModuleBindings } = await import("../../apps/web/src/app/lib/helper-resolution.ts");
	const helpers = [
		{ id: "instance", name: "Helper", scope: { type: "instance" } },
		{ id: "workspace", name: "Helper", scope: { type: "workspace" } },
		{ id: "organization", name: "Helper", scope: { type: "organization" } },
	];
	expect(helperModuleBindings(helpers).get("Helper")).toBe("workspace");
	expect(helperModuleBindings(helpers.filter((helper) => helper.scope.type !== "workspace")).get("Helper")).toBe("organization");
	expect(helperModuleBindings([...helpers, { id: "project", name: "Helper", scope: { type: "project" } }]).get("Helper")).toBe("project");
	expect(helperModuleBindings(helpers, { Helper: "pinned" }).get("Helper")).toBe("pinned");
});

test("UX82 provider requirements reject incomplete Cognito and unrecognized configuration", async () => {
	const { oauthClients } = await import("../../packages/contracts/src/oauth.ts");
	expect(oauthClients.safeParse({ discord: { clientId: "client", clientSecret: "secret" }, microsoft: { clientId: "client", tenantId: "organizations" }, tiktok: { clientId: "key", clientSecret: "secret" } }).success).toBe(true);
	expect(oauthClients.safeParse({ cognito: { clientId: "client" } }).success).toBe(false);
	expect(
		oauthClients.safeParse({
			cognito: {
				clientId: "client",
				domain: "127.0.0.1",
				region: "us-east-1",
				userPoolId: "us-east-1_Fixture",
			},
		}).success,
	).toBe(false);
	expect(oauthClients.safeParse({ unknown: { clientId: "client" } }).success).toBe(false);
	expect(oauthClients.safeParse({ discord: { clientId: "client", domain: "fixture.auth.us-east-1.amazoncognito.com" } }).success).toBe(false);
});
