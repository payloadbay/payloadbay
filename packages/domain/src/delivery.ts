import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { recordEndpointUsage } from "./usage.ts";
import { transaction } from "./db.ts";
import { assertAuthority, type Authority } from "./execution-lease.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { DestinationTarget, SendInput, SendResult } from "../../script-sdk/src/lifecycle.ts";

function httpTarget(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new AppError("invalid_target", 400, "Provide an HTTP or HTTPS destination");
	}

	if (!["http:", "https:"].includes(url.protocol)) throw new AppError("invalid_target", 400, "Provide an HTTP or HTTPS destination");

	return url.toString();
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
	if (value && typeof value === "object")
		return (
			"{" +
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
				.join(",") +
			"}"
		);

	return JSON.stringify(value);
}

export async function managedSend(pool: Pool, authority: Authority, target: DestinationTarget, input: SendInput, options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<SendResult> {
	if (typeof input.operationId !== "string" || !input.operationId || input.operationId.length > 128) throw new AppError("invalid_operation", 400, "Provide a stable operation identifier");
	if (typeof input.body !== "string" && !(input.body instanceof Uint8Array)) throw new AppError("invalid_body", 400, "Provide a string or binary request body");
	const body = Buffer.from(input.body);
	if (body.byteLength > 1048576) throw new AppError("body_too_large", 413, "Delivery body exceeds 1 MiB");
	const prepared = await transaction(pool, async (db) => {
		const execution = await assertAuthority(db, authority, true);
		const publication = (await db.query("SELECT destination_snapshot FROM payloadbay.publication WHERE id=$1", [execution.publication_id])).rows[0];
		let snapshot: Record<string, unknown>;
		let method: string;
		let url: string;
		let configuredHeaders: Record<string, string> = {};
		if (typeof target === "string") {
			const entries = Object.values(publication.destination_snapshot) as {
				id: string;
				name: string;
				isDefault?: boolean;
				httpConfig: { url: string; method?: string; headers?: Record<string, string> };
			}[];
			const destination = target === "default" ? (entries.find((d) => d.isDefault) ?? entries.find((d) => d.name === "default")) : entries.find((d) => d.id === target || d.name === target);
			if (!destination) throw new AppError("destination_unavailable", 409, "Destination is not in this publication");
			snapshot = destination;
			url = httpTarget(destination.httpConfig.url);
			method = destination.httpConfig.method ?? "POST";
			configuredHeaders = destination.httpConfig.headers ?? {};
		} else {
			if (!target || typeof target.url !== "string") throw new AppError("invalid_target", 400, "Provide an HTTP destination");
			url = httpTarget(target.url);
			method = target.method ?? "POST";
			snapshot = { url, method };
		}

		if (!/^[A-Z]+$/.test(method) || ["CONNECT", "TRACE", "GET", "HEAD"].includes(method)) throw new AppError("invalid_method", 400, "Choose a supported body-bearing HTTP method");
		const headers = new Headers(configuredHeaders);
		for (const [key, value] of Object.entries(input.headers ?? {})) headers.set(key, value);
		const normalized = Object.fromEntries(headers);
		const digest = createHash("sha256")
			.update(canonical({ url, method, headers: normalized }))
			.update(body)
			.digest("hex");
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [execution.id, input.operationId, digest, JSON.stringify(snapshot), authority.generation]);
		const operation = (await db.query("SELECT * FROM payloadbay.managed_operation WHERE execution_id=$1 AND operation_id=$2 FOR UPDATE", [execution.id, input.operationId])).rows[0];
		if (operation.input_digest !== digest) throw new AppError("operation_input_changed", 409, "Operation identifier was reused with different input");
		if (operation.state === "succeeded") return { cached: { ...operation.result, reused: true } as SendResult };
		if (operation.state === "sending" && operation.generation === authority.generation) throw new AppError("operation_busy", 409, "This operation is already being sent");
		const attemptId = randomUUID();
		await db.query("INSERT INTO payloadbay.delivery_attempt(id,execution_id,operation_id,execution_attempt,generation) VALUES($1,$2,$3,$4,$5)", [attemptId, execution.id, input.operationId, execution.attempt_number, authority.generation]);
		await recordEndpointUsage(db, execution.endpoint_id, "delivery.attempt.started", attemptId);
		await db.query("UPDATE payloadbay.managed_operation SET state='sending',generation=$3 WHERE execution_id=$1 AND operation_id=$2", [execution.id, input.operationId, authority.generation]);

		return {
			attemptId,
			url,
			method,
			headers: normalized,
		};
	});
	if (prepared.cached) return prepared.cached;
	const started = performance.now();
	let status: number | undefined;
	let networkError: string | undefined;
	const chunks: Buffer[] = [];
	try {
		const response = await fetch(prepared.url!, {
			method: prepared.method,
			headers: prepared.headers,
			body,
			redirect: "manual",
			signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 10000)]) : AbortSignal.timeout(options.timeoutMs ?? 10000),
		});
		status = response.status;
		let size = 0;
		if (response.body)
			for await (const chunk of response.body) {
				size += chunk.byteLength;
				if (size > 1048576) throw Error("response_limit");
				chunks.push(Buffer.from(chunk));
			}
	} catch {
		networkError = "delivery_network_error";
	}

	const responseBody = Buffer.concat(chunks);
	const result: SendResult = {
		ok: networkError === undefined && status !== undefined && status >= 200 && status < 300,
		attemptId: prepared.attemptId!,
		...(status === undefined ? {} : { status }),
		...(networkError ? { networkError } : {}),
		response: responseBody.subarray(0, 65536).toString("utf8"),
	};
	await transaction(pool, async (db) => {
		await assertAuthority(db, authority, true);
		await db.query("UPDATE payloadbay.delivery_attempt SET ended_at=clock_timestamp(),status_code=$2,network_error=$3,response_digest=$4,response_body=$5,duration_ms=$6 WHERE id=$1 AND generation=$7", [result.attemptId, status ?? null, networkError ?? null, createHash("sha256").update(responseBody).digest("hex"), responseBody.subarray(0, 65536), Math.round(performance.now() - started), authority.generation]);
		await db.query("UPDATE payloadbay.managed_operation SET state=$3,result=$4,successful_attempt_id=$5 WHERE execution_id=$1 AND operation_id=$2 AND generation=$6", [authority.executionId, input.operationId, result.ok ? "succeeded" : "failed", JSON.stringify(result), result.ok ? result.attemptId : null, authority.generation]);
	});

	return result;
}
