import { validateProviderResponse } from "../../contracts/src/provider-response.ts";
import { executePipeline } from "./pipeline.ts";
import { appendChange } from "./changes.ts";
import type { Pool } from "pg";
import { createHash } from "node:crypto";
import { transaction } from "./db.ts";
import { scheduleDispatch } from "./execution-lease.ts";
import { resolvePinnedSecrets } from "./secrets.ts";
import { ingressDecision } from "../../contracts/src/lifecycle.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../apps/executor/src/supervisor.ts";

export type IngressInput = {
	key: string;
	body: Uint8Array;
	headers: Record<string, string>;
	method: string;
	url: string;
};

export type IngressOptions = {
	encryptionKey: string;
	bodyLimit?: number;
	headerLimit?: number;
	deadlineMs?: number;
	maxAttempts?: number;
	run: (options: ExecuteOptions) => Promise<ExecutionResult>;
};

export async function receiveIngress(pool: Pool, input: IngressInput, options: IngressOptions) {
	if (input.body.byteLength > (options.bodyLimit ?? 1048576)) throw new AppError("body_too_large", 413, "Request body exceeds the configured limit");
	const headerBytes = Object.entries(input.headers).reduce((sum, [name, value]) => sum + Buffer.byteLength(name) + Buffer.byteLength(value) + 4, 0);
	if (headerBytes > (options.headerLimit ?? 16384)) throw new AppError("headers_too_large", 431, "Request headers exceed the configured limit");
	const headers: Record<string, string> = Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [key.toLowerCase(), value]));
	if (headers.cookie) {
		const retained = headers.cookie
			.split(";")
			.map((part) => part.trim())
			.filter((part) => !/^(__Secure-|__Host-)?better-auth\./.test(part.split("=", 1)[0]));
		if (retained.length) headers.cookie = retained.join("; ");
		else delete headers.cookie;
	}

	if (/^Bearer pb_[A-Za-z0-9_-]{43}$/i.test(headers.authorization ?? "")) delete headers.authorization;
	const route = (await pool.query(`SELECT e.id,e.project_id,e.priority,p.id AS publication_id,p.shared_versions,p.effective_bindings,r.bundle FROM payloadbay.endpoint e JOIN payloadbay.project pr ON pr.id=e.project_id JOIN payloadbay.workspace w ON w.id=pr.workspace_id JOIN payloadbay.publication p ON p.id=e.active_publication_id JOIN payloadbay.stage_revision r ON r.id=p.ingress_revision_id WHERE e.ingress_key=$1 AND pr.archived_at IS NULL AND w.archived_at IS NULL`, [input.key])).rows[0];
	if (!route) throw new AppError("ingress_unavailable", 404, "Ingress route unavailable");
	const secrets = await resolvePinnedSecrets(pool, route.project_id, route.shared_versions.ingress?.secrets ?? {}, options.encryptionKey);
	const execution = await executePipeline({
		bindings: route.effective_bindings ?? [],
		run: options.run,
		resolveSecrets: (refs) => resolvePinnedSecrets(pool, route.project_id, refs, options.encryptionKey),
		stage: "ingress",
		bundle: route.bundle,
		deadlineMs: options.deadlineMs ?? 2000,
		input: {
			endpointId: route.id,
			receivedAt: new Date().toISOString(),
			secrets,
			request: {
				body: input.body,
				headers,
				contentType: headers["content-type"] ?? "application/octet-stream",
				method: input.method,
				url: input.url,
			},
		},
	});
	const parsed = ingressDecision.safeParse(execution.decision);
	if (!parsed.success) throw new AppError("invalid_ingress_outcome", 502, "Ingress handler returned an invalid outcome");
	const decision = parsed.data;
	try {
		validateProviderResponse(decision.response, { bodyBytes: options.bodyLimit ?? 1048576, headerBytes: options.headerLimit ?? 16384 });
	} catch {
		throw new AppError("invalid_ingress_outcome", 502, "Ingress handler returned an invalid HTTP response");
	}

	if (decision.kind !== "accept") return decision.response;
	const accepted = typeof decision.event.body === "string" ? Buffer.from(decision.event.body) : Buffer.from(decision.event.body);
	if (accepted.byteLength > (options.bodyLimit ?? 1048576)) throw new AppError("body_too_large", 413, "Accepted event exceeds the configured limit");
	await transaction(pool, async (db) => {
		const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,headers,content_type,accepted_body,metadata) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [route.id, route.publication_id, Buffer.from(input.body), JSON.stringify(headers), decision.event.contentType, accepted, JSON.stringify(decision.event.metadata ?? {})])).rows[0];
		const responseBody = typeof decision.response.body === "string" ? Buffer.from(decision.response.body) : Buffer.from(decision.response.body);
		const digest = createHash("sha256")
			.update(JSON.stringify({ status: decision.response.status, headers: decision.response.headers ?? {} }))
			.update(responseBody)
			.digest("hex");
		await db.query("INSERT INTO payloadbay.receipt(event_id,ack_response_digest) VALUES($1,$2)", [event.id, digest]);
		const scheduled = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,max_attempts) VALUES($1,$2,$3,$4) RETURNING *", [event.id, route.id, route.publication_id, options.maxAttempts ?? 5])).rows[0];
		await scheduleDispatch(db, scheduled, route.priority);
		await appendChange(db, { scope: { type: "project", id: route.project_id }, kind: "event.accepted", resourceId: event.id });
	});

	return decision.response;
}
