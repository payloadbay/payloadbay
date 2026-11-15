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
		if (typeof target !== "string") throw new AppError("invalid_target", 400, "Choose a configured destination");

		const entries = Object.values(publication.destination_snapshot) as {
			id: string;
			name: string;
			isDefault?: boolean;
			concurrency?: number;
			httpConfig: { url: string; method?: string; headers?: Record<string, string> };
		}[];
		const destination = target === "default" ? (entries.find((d) => d.isDefault) ?? entries.find((d) => d.name === "default")) : entries.find((d) => d.id === target || d.name === target);
		if (!destination) throw new AppError("destination_unavailable", 409, "Destination is not in this publication");
		const snapshot = destination;
		const destinationId = destination.id;
		let capacityLimit = destination.concurrency ?? 4;
		const url = httpTarget(destination.httpConfig.url);
		const method = input.method ?? destination.httpConfig.method ?? "POST";
		const configuredHeaders = destination.httpConfig.headers ?? {};
		if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) throw new AppError("invalid_method", 400, "Choose a supported HTTP method");
		if (["GET", "HEAD"].includes(method) && body.byteLength) throw new AppError("invalid_body", 400, "GET and HEAD requests cannot have a body");

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
		const projectId = (await db.query("SELECT project_id FROM payloadbay.endpoint WHERE id=$1", [execution.endpoint_id])).rows[0].project_id as string;
		const current = (await db.query("SELECT concurrency FROM payloadbay.destination WHERE id::text=$1 AND project_id=$2", [destinationId, projectId])).rows[0];
		if (current) capacityLimit = current.concurrency;

		if (!Number.isInteger(capacityLimit) || capacityLimit < 1 || capacityLimit > 128) throw new AppError("destination_unavailable", 409, "Destination capacity requires operator attention");
		const capacityKey =
			projectId +
			":" +
			createHash("sha256")
				.update("configured:" + destinationId)
				.digest("hex");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["destination-capacity:" + capacityKey]);
		const occupied = (
			await db.query(
				`SELECT count(*)::int AS n FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id
 WHERE a.capacity_key=$1 AND a.ended_at IS NULL AND x.state='running'
 AND x.dispatch_generation=a.generation AND x.lease_expiry>clock_timestamp()`,
				[capacityKey],
			)
		).rows[0].n;
		if (occupied >= capacityLimit) throw new AppError("destination_capacity", 429, "Destination is at capacity; retry this operation later");
		const attemptId = randomUUID();
		await db.query("INSERT INTO payloadbay.delivery_attempt(id,execution_id,operation_id,execution_attempt,generation,capacity_key) VALUES($1,$2,$3,$4,$5,$6)", [attemptId, execution.id, input.operationId, execution.attempt_number, authority.generation, capacityKey]);
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
			body: ["GET", "HEAD"].includes(prepared.method!) ? undefined : body,
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
