import { validateDecision } from "../../contracts/src/lifecycle.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../apps/executor/src/supervisor.ts";

export type PinnedMiddleware = {
	id: string;
	scopeType: "instance" | "workspace" | "project" | "endpoint";
	scopeId: string;
	stage: "ingress" | "processing";
	position: number;
	revisionId: string;
	bundle: string;
	failurePolicy: "required" | "optional";
	requiredAction?: "retry" | "fail";
	version: number;
	originBindingId?: string | null;
	secretBindings?: Record<string, string>;
};

const rank = {
	instance: 0,
	workspace: 1,
	project: 2,
	endpoint: 3,
};

/** Every call receives a fresh context clone. Only validated patches are merged into later stages. */
export async function executePipeline(options: ExecuteOptions & { bindings: readonly PinnedMiddleware[]; run: (options: ExecuteOptions) => Promise<ExecutionResult>; resolveSecrets?: (bindings: Record<string, string>) => Promise<Record<string, string>> }): Promise<ExecutionResult> {
	const started = performance.now();
	const deadline = options.deadlineMs ?? (options.stage === "ingress" ? 2000 : 30000);
	let input = structuredClone(options.input);
	const logs: ExecutionResult["logs"] = [];
	let peak = 0;

	const call = async (stage: string, bundle: string, secrets?: Record<string, string>) => {
		const remaining = deadline - (performance.now() - started);
		if (remaining < 100) throw Error("pipeline_deadline");
		const result = await options.run({
			...options,
			stage,
			bundle,
			input: structuredClone(secrets === undefined ? input : { ...input, secrets }),
			deadlineMs: Math.max(1, Math.floor(remaining)),
		});
		peak = Math.max(peak, result.peakRssBytes);
		if (Buffer.byteLength(JSON.stringify([...logs, ...result.logs])) > 16384) throw Error("pipeline_log_limit");
		logs.push(...result.logs);

		return validateDecision(stage, result.decision);
	};

	const bindings = options.bindings.filter((binding) => binding.stage === options.stage).sort((a, b) => rank[a.scopeType] - rank[b.scopeType] || a.position - b.position || a.id.localeCompare(b.id));
	if (bindings.length > 32) throw Error("middleware_limit");
	for (const binding of bindings) {
		const secrets = options.resolveSecrets ? await options.resolveSecrets(binding.secretBindings ?? {}) : {};
		if (!options.resolveSecrets && Object.keys(binding.secretBindings ?? {}).length) throw Error("middleware_secret_resolver_unavailable");
		try {
			const result = await call(options.stage + "_middleware", binding.bundle, secrets);
			if (result.kind !== "continue")
				return {
					decision: result,
					logs,
					peakRssBytes: peak,
					durationMs: performance.now() - started,
				};
			if (result.patch) {
				if ("request" in result.patch && result.patch.request) {
					const current = input.request as { headers: Record<string, string>; contentType: string };
					const next = { ...current, ...result.patch.request, headers: { ...current.headers, ...result.patch.request.headers } };
					validateDecision("ingress_middleware", { kind: "continue", patch: { request: { headers: next.headers, contentType: next.contentType } } });
					input = { ...input, request: next };
				}

				if ("event" in result.patch && result.patch.event) {
					const current = input.event as { metadata: Record<string, unknown> };
					const next = { ...current, ...result.patch.event, metadata: { ...current.metadata, ...result.patch.event.metadata } };
					validateDecision("processing_middleware", { kind: "continue", patch: { event: { metadata: next.metadata } } });
					input = { ...input, event: next };
				}
			}
		} catch (error) {
			if (error instanceof Error && ["pipeline_log_limit", "pipeline_deadline"].includes(error.message)) throw error;
			const failure = { level: "error", message: binding.failurePolicy === "optional" ? "Optional middleware failed" : "Required middleware failed", data: { bindingId: binding.id } };
			if (Buffer.byteLength(JSON.stringify([...logs, failure])) > 16384) throw Error("pipeline_log_limit");
			logs.push(failure);
			if (binding.failurePolicy === "required")
				return {
					decision: options.stage === "ingress" ? { kind: "reject", response: { status: 503, body: "Ingress middleware failed", headers: { "content-type": "text/plain" } } } : { kind: binding.requiredAction ?? "retry", reason: "required_middleware_failed" },
					logs,
					peakRssBytes: peak,
					durationMs: performance.now() - started,
				};
		}
	}

	return {
		decision: await call(options.stage, options.bundle),
		logs,
		peakRssBytes: peak,
		durationMs: performance.now() - started,
	};
}
