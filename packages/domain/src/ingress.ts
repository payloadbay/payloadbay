import { checkIngressPolicy, type ProtectionBlock } from "./ingress-policy.ts";
import { assertExecutionDependencies } from "./execution-dependencies.ts";
import { validateProviderResponse } from "../../contracts/src/provider-response.ts";
import { executePipeline } from "./pipeline.ts";
import { mayAcceptIngress } from "./organization-policy.ts";
import { recordEndpointUsage } from "./usage.ts";
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
	const route = (
		await pool.query(
			`SELECT e.id,e.project_id,e.priority,w.organization_id,p.id AS publication_id,p.shared_versions,p.effective_bindings,r.bundle FROM payloadbay.endpoint e JOIN payloadbay.project pr ON pr.id=e.project_id JOIN payloadbay.workspace w ON w.id=pr.workspace_id JOIN payloadbay.organization o ON o.id=w.organization_id AND o.installation_id=w.installation_id JOIN payloadbay.publication p ON p.id=e.active_publication_id JOIN payloadbay.stage_revision r ON r.id=p.ingress_revision_id WHERE e.ingress_key=$1 AND pr.archived_at IS NULL AND w.archived_at IS NULL AND o.archived_at IS NULL`,
			[input.key],
		)
	).rows[0];
	if (!route) throw new AppError("ingress_unavailable", 404, "Ingress route unavailable");
	let decision: ReturnType<typeof ingressDecision.parse>;
	let protectionReason: ProtectionBlock["reason"] | undefined;
	try {
		const protection = await checkIngressPolicy(
			pool,
			route.id,
			{
				headers,
				method: input.method,
				path: new URL(input.url).pathname,
				bodySize: input.body.byteLength,
			},
			options.encryptionKey,
		);
		if (protection) {
			protectionReason = protection.reason;
			decision = { kind: "reject", response: { status: protection.status, body: protection.status === 429 ? "Too many requests" : "Request blocked", headers: { "content-type": "text/plain", ...(protection.retryAfter ? { "retry-after": String(protection.retryAfter) } : {}) } } };
		} else {
			await assertExecutionDependencies(pool, route.project_id, "ingress", route.shared_versions.ingress ?? {}, route.effective_bindings ?? []);
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
			decision = parsed.data;
			if (decision.kind === "accept" && Buffer.from(decision.event.body).byteLength > (options.bodyLimit ?? 1048576)) throw new AppError("body_too_large", 413, "Accepted event exceeds the configured limit");
			try {
				validateProviderResponse(decision.response, { bodyBytes: options.bodyLimit ?? 1048576, headerBytes: options.headerLimit ?? 16384 });
			} catch {
				throw new AppError("invalid_ingress_outcome", 502, "Ingress handler returned an invalid HTTP response");
			}
		}
	} catch (cause) {
		await transaction(pool, async (db) => {
			const recorded = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,headers,content_type,accepted_body,ingress_outcome,request_method,response_status) VALUES($1,$2,$3,$4,$5,$6,'error',$7,$8) RETURNING id", [route.id, route.publication_id, Buffer.from(input.body), JSON.stringify(headers), headers["content-type"] ?? "application/octet-stream", Buffer.alloc(0), input.method, cause instanceof AppError ? cause.status : 500])).rows[0];
			await recordEndpointUsage(db, route.id, "ingress.recorded", recorded.id);
			await appendChange(db, { scope: { type: "project", id: route.project_id }, kind: "event.recorded", resourceId: recorded.id });
		});
		throw cause;
	}

	const accepted = decision.kind === "accept" ? Buffer.from(decision.event.body) : Buffer.alloc(0);
	let admissionRejected = false;
	await transaction(pool, async (db) => {
		if (decision.kind === "accept" && !(await mayAcceptIngress(db, route.organization_id))) {
			admissionRejected = true;
			decision = { kind: "reject", response: { status: 429, body: "Event acceptance is temporarily unavailable for this organization", headers: { "content-type": "text/plain" } } };
		}

		const event = (
			await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,headers,content_type,accepted_body,metadata,ingress_outcome,request_method,response_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id", [
				route.id,
				route.publication_id,
				Buffer.from(input.body),
				JSON.stringify(headers),
				decision.kind === "accept" ? decision.event.contentType : (headers["content-type"] ?? "application/octet-stream"),
				decision.kind === "accept" ? accepted : Buffer.alloc(0),
				JSON.stringify(decision.kind === "accept" ? (decision.event.metadata ?? {}) : admissionRejected ? { platform: { reason: "organization_admission_limit" } } : protectionReason ? { platform: { protection: protectionReason } } : {}),
				decision.kind,
				input.method,
				decision.response.status,
			])
		).rows[0];
		await recordEndpointUsage(db, route.id, "ingress.recorded", event.id);
		if (decision.kind !== "accept") {
			await appendChange(db, { scope: { type: "project", id: route.project_id }, kind: "event.recorded", resourceId: event.id });

			return;
		}

		const responseBody = typeof decision.response.body === "string" ? Buffer.from(decision.response.body) : Buffer.from(decision.response.body);
		const digest = createHash("sha256")
			.update(JSON.stringify({ status: decision.response.status, headers: decision.response.headers ?? {} }))
			.update(responseBody)
			.digest("hex");
		await db.query("INSERT INTO payloadbay.receipt(event_id,ack_response_digest) VALUES($1,$2)", [event.id, digest]);
		const scheduled = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,max_attempts) VALUES($1,$2,$3,$4) RETURNING *", [event.id, route.id, route.publication_id, options.maxAttempts ?? 5])).rows[0];
		await recordEndpointUsage(db, route.id, "ingress.accepted", event.id);
		await recordEndpointUsage(db, route.id, "execution.created", scheduled.id);
		await scheduleDispatch(db, scheduled, route.priority);
		await appendChange(db, { scope: { type: "project", id: route.project_id }, kind: "event.accepted", resourceId: event.id });
	});

	return decision.response;
}
