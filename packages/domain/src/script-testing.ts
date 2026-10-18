import { transaction } from "./db.ts";
import { middlewareSnapshot } from "./middleware.ts";
import { executePipeline } from "./pipeline.ts";
import { scriptTestInput } from "../../contracts/src/script-test.ts";

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

	return {
		...result,
		mode: "dry" as const,
		simulatedManagedStatus: 204,
		middlewareCount: middleware.filter((binding) => binding.stage === data.stage).length,
		checks,
	};
}
