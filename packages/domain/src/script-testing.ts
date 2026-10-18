import { transaction } from "./db.ts";
import { middlewareSnapshot } from "./middleware.ts";
import { executePipeline } from "./pipeline.ts";
import { scriptTestContextDeclaration, scriptTestInput } from "../../contracts/src/script-test.ts";

import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { AppError } from "../../contracts/src/errors.ts";
import type { Actor } from "./authorization.ts";
import { endpointFor } from "./endpoints.ts";
import { requirePermission } from "./membership.ts";
import { resolveSharedModules, pinSourceImports } from "./shared-code.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../apps/executor/src/supervisor.ts";

export { scriptTestInput } from "../../contracts/src/script-test.ts";

const assertionRunner = `
const result = JSON.parse(new TextDecoder().decode(ctx.event.body));
let count = 0;
const pending: Promise<void>[] = [];

function equal(actual: unknown, expected: unknown): boolean {
 if (Object.is(actual, expected)) return true;
 if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return false;
 const left = actual as Record<string, unknown>;
 const right = expected as Record<string, unknown>;
 const keys = Object.keys(left);
 return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

const expect = (actual: unknown) => ({
 toBe(expected: unknown) { if (!Object.is(actual, expected)) throw Error("Values differ"); },
 toEqual(expected: unknown) { if (!equal(actual, expected)) throw Error("Values differ"); },
 toContain(expected: string) { if (typeof actual !== "string" || !actual.includes(expected)) throw Error("Text does not contain expected value"); },
 toBeTruthy() { if (!actual) throw Error("Expected a truthy value"); }
});

const test = (name: string, run: () => void | Promise<void>) => {
 if (++count > 32) throw Error("At most 32 checks");
 const check = Promise.resolve().then(run).then(
  () => { ctx.log.info("assertion", { name: String(name).slice(0,100), passed: true }); },
  () => { ctx.log.info("assertion", { name: String(name).slice(0,100), passed: false }); }
 );
 pending.push(check);
 return check;
};

await Assertions.default({ ...result, expect, test });
await Promise.all(pending);
if (count === 0) throw Error("Define at least one test");
return ctx.complete();
`;

export async function requireTestAuthority(pool: Pool, actor: Actor, endpointId: string, effects: boolean) {
	const { endpoint } = await endpointFor(pool, actor, endpointId, "code.read");
	const scope = { type: "project" as const, id: endpoint.project_id };
	await requirePermission(pool, actor, scope, "code.test");
	if (effects) await requirePermission(pool, actor, scope, "code.test.effects");

	return endpoint;
}

export async function testDraftDry(pool: Pool, actor: Actor, endpointId: string, input: unknown, engine: { compile: (input: unknown) => ReturnType<typeof compile>; run: (options: ExecuteOptions & { dryRun: true }) => Promise<ExecutionResult> }) {
	const endpoint = await requireTestAuthority(pool, actor, endpointId, false);
	const parsed = scriptTestInput.safeParse(input);
	if (!parsed.success) throw new AppError("invalid_input", 400, "Provide a bounded synthetic script fixture");
	const data = parsed.data;
	const scope = { type: "project" as const, id: endpoint.project_id };
	const bindings = /^\s*(?:import|export)\s/m.test(data.body) ? await pinSourceImports(pool, actor, scope, data.body, data.sharedBindings) : data.sharedBindings;
	const sharedModules = await resolveSharedModules(pool, actor, scope, bindings);
	const compiled = await engine.compile({
		stage: data.stage,
		body: data.body,
		sourceId: data.stage,
		sharedModules,
	});
	const id = randomUUID();
	const body = new TextEncoder().encode(data.fixture.body);
	await pool.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'code.tested',$3,$4)", [actor.userId, endpoint.project_id, endpointId, JSON.stringify({ mode: "dry", stage: data.stage, bodyDigest: createHash("sha256").update(data.body).digest("hex") })]);
	const context =
		data.stage === "ingress"
			? {
					request: {
						body,
						headers: data.fixture.headers,
						contentType: data.fixture.contentType,
						method: data.fixture.method,
						url: "https://synthetic.invalid/ingress",
					},
					endpointId,
					receivedAt: new Date().toISOString(),
					secrets: data.fixture.secrets,
				}
			: {
					event: {
						id,
						body,
						originalBody: body,
						contentType: data.fixture.contentType,
						metadata: {},
					},
					executionId: id,
					generation: 0,
					attempt: 0,
					secrets: data.fixture.secrets,
				};

	const middleware = data.includeMiddleware ? await transaction(pool, (db) => middlewareSnapshot(db, endpointId)) : [];

	const run: typeof engine.run = (options) =>
		middleware.length
			? executePipeline({
					...options,
					bindings: middleware,
					resolveSecrets: async (bindings) =>
						Object.fromEntries(
							Object.keys(bindings)
								.filter((name) => Object.hasOwn(data.fixture.secrets, name))
								.map((name) => [name, data.fixture.secrets[name]]),
						),
					run: (input) => engine.run({ ...input, dryRun: true, maxFetches: 0 }),
				})
			: engine.run(options);

	const result = await run({
		stage: data.stage,
		bundle: compiled.bundle,
		input: context,
		maxFetches: 0,
		dryRun: true,
		broker: async (_target, input) => {
			const operation = input as { operationId?: unknown };
			if (typeof operation?.operationId !== "string" || !operation.operationId) throw Error("invalid_operation");

			return {
				ok: true,
				status: 204,
				response: "",
				attemptId: "dry-run:" + operation.operationId,
			};
		},
	});
	const outcome = result.decision as { kind: string; response?: { status: number; body?: string | Uint8Array } };
	const responseBody = typeof outcome.response?.body === "string" ? outcome.response.body : outcome.response?.body instanceof Uint8Array ? new TextDecoder().decode(outcome.response.body) : "";
	const checks = [];
	if (data.expectations.decision !== undefined)
		checks.push({
			name: "Decision",
			passed: outcome.kind === data.expectations.decision,
			expected: data.expectations.decision,
			actual: outcome.kind,
		});
	if (data.expectations.status !== undefined)
		checks.push({
			name: "HTTP status",
			passed: outcome.response?.status === data.expectations.status,
			expected: data.expectations.status,
			actual: outcome.response?.status ?? null,
		});
	if (data.expectations.bodyContains !== undefined) checks.push({ name: "Response body contains", passed: responseBody.includes(data.expectations.bodyContains), expected: data.expectations.bodyContains });

	if (data.assertionSource.trim()) {
		const assertionBundle = await engine.compile({
			stage: "processing",
			sourceId: "test-assertions",
			body: assertionRunner,
			sharedModules: { Assertions: { source: scriptTestContextDeclaration + data.assertionSource, revisionId: randomUUID() } },
		});
		const assertions = await engine.run({
			stage: "processing",
			bundle: assertionBundle.bundle,
			input: {
				event: {
					id,
					body: new TextEncoder().encode(JSON.stringify({ decision: { kind: outcome.kind }, response: { status: outcome.response?.status ?? null, body: responseBody } })),
					originalBody: new Uint8Array(),
					contentType: "application/json",
					metadata: {},
				},
				executionId: id,
				generation: 0,
				attempt: 0,
				secrets: {},
			},
			maxFetches: 0,
			dryRun: true,
			deadlineMs: 2000,
		});
		for (const log of assertions.logs) {
			const entry = log.data as { name?: unknown; passed?: unknown } | undefined;
			if (log.message === "assertion" && typeof entry?.name === "string" && typeof entry.passed === "boolean") checks.push({ name: entry.name, passed: entry.passed });
		}
	}

	return {
		...result,
		mode: "dry" as const,
		simulatedManagedStatus: 204,
		middlewareCount: middleware.filter((binding) => binding.stage === data.stage).length,
		checks,
	};
}
