import type { ServerConfig } from "./config.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { CompilationError } from "../../contracts/src/compilation.ts";
import { compiledStageSchema, diagnosticSchema } from "../../contracts/src/executor.ts";
import { z } from "zod";

export async function compileSource(config: Pick<ServerConfig, "executorUrl" | "executorToken">, input: unknown, signal?: AbortSignal) {
	const response = await fetch(new URL("/compile", config.executorUrl), {
		method: "POST",
		headers: { authorization: "Bearer " + config.executorToken, "content-type": "application/json" },
		body: JSON.stringify(input),
		signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000),
	}).catch(() => {
		throw new AppError("compiler_unavailable", 503, "Script compiler unavailable; retry later");
	});
	let bytes = 0;
	const chunks: Uint8Array[] = [];
	if (response.body)
		for await (const chunk of response.body) {
			bytes += chunk.byteLength;
			if (bytes > 6291456) {
				await response.body.cancel().catch(() => {});
				throw new AppError("compiler_response_invalid", 503, "Script compiler returned an invalid response");
			}

			chunks.push(chunk);
		}

	let value: unknown;
	try {
		value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new AppError("compiler_response_invalid", 503, "Script compiler returned an invalid response");
	}

	if (!response.ok) {
		const failure = z.object({ error: z.object({ code: z.literal("compilation_failed"), diagnostics: z.array(diagnosticSchema).max(20) }) }).safeParse(value);
		if (failure.success) throw new CompilationError(failure.data.error.diagnostics);
		throw new AppError("compiler_unavailable", 503, "Script compiler unavailable; retry later");
	}

	const compiled = compiledStageSchema.safeParse(value);
	if (!compiled.success) throw new AppError("compiler_response_invalid", 503, "Script compiler returned an invalid response");

	return compiled.data;
}

import { packWire, unpackWire } from "../../contracts/src/wire.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../apps/executor/src/supervisor.ts";
import { validateDecision } from "../../contracts/src/lifecycle.ts";

export async function executeSource(config: Pick<ServerConfig, "executorUrl" | "executorToken">, options: Omit<ExecuteOptions, "broker"> & { brokerToken?: string; dryRun?: boolean }): Promise<ExecutionResult> {
	const controller = AbortSignal.timeout((options.deadlineMs ?? (options.stage.startsWith("ingress") ? 2000 : 30000)) + 2000);
	const signal = options.signal ? AbortSignal.any([options.signal, controller]) : controller;
	const response = await fetch(new URL("/execute", config.executorUrl), {
		method: "POST",
		headers: { authorization: "Bearer " + config.executorToken, "content-type": "application/json" },
		body: JSON.stringify({
			wire: 1,
			stage: options.stage,
			bundle: options.bundle,
			input: packWire(options.input),
			deadlineMs: options.deadlineMs,
			brokerToken: options.brokerToken,
			maxFetches: options.maxFetches,
			dryRun: options.dryRun,
		}),
		signal,
	}).catch(() => {
		throw new AppError("executor_unavailable", 503, "Script execution unavailable");
	});
	let bytes = 0;
	const chunks: Uint8Array[] = [];
	try {
		if (response.body)
			for await (const chunk of response.body) {
				bytes += chunk.byteLength;
				if (bytes > 16777216) throw Error("response limit");
				chunks.push(chunk);
			}
	} catch {
		throw new AppError("executor_response_invalid", 502, "Script execution returned an invalid response");
	}

	let raw: unknown;
	try {
		raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new AppError("executor_response_invalid", 502, "Script execution returned an invalid response");
	}

	if (!response.ok) throw new AppError("execution_failed", 502, "Script execution failed");
	try {
		const result = unpackWire(raw) as ExecutionResult;
		validateDecision(options.stage, result.decision);
		if (!Array.isArray(result.logs) || !Number.isFinite(result.durationMs)) throw Error("invalid result");

		return result;
	} catch {
		throw new AppError("executor_response_invalid", 502, "Script execution returned an invalid response");
	}
}
