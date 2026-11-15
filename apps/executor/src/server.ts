import { executorCompatibility } from "../../../packages/contracts/src/compatibility.ts";
import { packWire, unpackWire } from "../../../packages/contracts/src/wire.ts";
import { compileIsolated } from "./compile-rpc.ts";
import { CompilationError } from "../../../packages/contracts/src/compilation.ts";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createExecutor, execute, ExecutionError } from "./supervisor.ts";

const token = process.env.PAYLOADBAY_EXECUTOR_TOKEN;
if (!token || token.length < 32) throw Error("PAYLOADBAY_EXECUTOR_TOKEN must contain at least 32 characters");
const executor = createExecutor({ ingressConcurrency: 2, processingConcurrency: 2 });
let ready = false;
await execute({
	stage: "processing",
	bundle: 'export default async function(){return {kind:"complete"};}',
	input: {},
	deadlineMs: 2000,
});
ready = true;
const server = createServer(async (request, response) => {
	try {
		if (request.url === "/health" && request.method === "GET") {
			response.writeHead(ready ? 200 : 503, { "content-type": "application/json" }).end(
				JSON.stringify({
					...executorCompatibility,
					ready,
					runtime: "workerd",
					configuredMode: process.env.PAYLOADBAY_EXECUTOR_RUNTIME || "runc",
					hostAttestation: false,
				}),
			);

			return;
		}

		const supplied = Buffer.from(request.headers.authorization ?? "");
		const expected = Buffer.from("Bearer " + token);
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
			response.writeHead(401).end();

			return;
		}

		if (!["/execute", "/compile"].includes(request.url ?? "") || request.method !== "POST") {
			response.writeHead(404).end();

			return;
		}

		const parts: Buffer[] = [];
		let bytes = 0;
		for await (const part of request) {
			bytes += part.length;
			if (bytes > (request.url === "/compile" ? 3145728 : 8388608)) {
				response.writeHead(413).end();

				return;
			}

			parts.push(part);
		}

		const payload = JSON.parse(Buffer.concat(parts).toString("utf8"));
		const controller = new AbortController();
		response.on("close", () => {
			if (!response.writableFinished) controller.abort();
		});
		if (request.url === "/compile") {
			const result = await compileIsolated(payload, controller.signal);
			response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));

			return;
		}

		if (payload.maxFetches !== undefined && (!Number.isInteger(payload.maxFetches) || payload.maxFetches < 0 || payload.maxFetches > 8)) {
			response.writeHead(400).end();

			return;
		}

		if (payload.wire === 1) payload.input = unpackWire(payload.input);
		if (!["ingress", "processing", "ingress_middleware", "processing_middleware", "notification"].includes(payload.stage) || typeof payload.bundle !== "string" || Buffer.byteLength(payload.bundle) > 1048576 || !payload.input || typeof payload.input !== "object") {
			response.writeHead(400).end();

			return;
		}

		const broker =
			payload.dryRun === true
				? async (_target: unknown, input: unknown) => {
						const operation = input as { operationId?: unknown };
						if (typeof operation?.operationId !== "string" || !operation.operationId || operation.operationId.length > 128) throw new ExecutionError("invalid_operation");

						return {
							ok: true,
							status: 204,
							response: "",
							attemptId: "dry-run:" + operation.operationId,
						};
					}
				: process.env.PAYLOADBAY_BROKER_URL && payload.brokerToken
					? async (target: unknown, input: unknown) => {
							const reply = await fetch(process.env.PAYLOADBAY_BROKER_URL!, {
								method: "POST",
								headers: { authorization: "Bearer " + payload.brokerToken, "content-type": "application/json" },
								body: JSON.stringify(packWire({ target, input })),
								signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
							});
							if (!reply.ok) throw new ExecutionError("broker_rejected");

							return unpackWire(await reply.json());
						}
					: undefined;
		const result = await executor.run({
			bundle: payload.bundle,
			stage: payload.stage,
			input: payload.input,
			deadlineMs: typeof payload.deadlineMs === "number" && payload.deadlineMs >= 100 && payload.deadlineMs <= 60000 ? payload.deadlineMs : undefined,
			signal: controller.signal,
			broker,
			maxFetches: payload.dryRun === true ? 0 : payload.maxFetches === undefined ? undefined : payload.maxFetches,
		});
		response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload.wire === 1 ? packWire(result) : result));
	} catch (error) {
		if (error instanceof CompilationError) {
			if (!response.writableEnded) response.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: "compilation_failed", diagnostics: error.diagnostics } }));

			return;
		}

		if (!response.writableEnded) response.writeHead(error instanceof ExecutionError ? 422 : 400, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: error instanceof ExecutionError ? error.code : "invalid_execution_request" } }));
	}
});
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
process.on("SIGTERM", () => {
	ready = false;
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 5000).unref();
});
