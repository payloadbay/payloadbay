import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { listResources } from "./resources.ts";
import { requirePermission, actorPermissions } from "./membership.ts";
import { z } from "zod";
import { pageQuery } from "../../contracts/src/api.ts";
import { AppError } from "../../contracts/src/errors.ts";

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() }).strict();

function cursor(value?: string) {
	if (!value) return null;
	try {
		if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error();

		return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
	} catch {
		throw new AppError("invalid_cursor", 400, "List cursor is invalid");
	}
}

export async function listEvents(
	pool: Pool,
	actor: Actor,
	input: {
		view?: "requests" | "attempts";
		projectId?: string;
		workspaceId?: string;
		state?: string;
		states?: string[];
		endpointId?: string;
		publicationId?: string;
		limit?: number;
		cursor?: string;
	},
) {
	if (input.projectId) await requirePermission(pool, actor, { type: "project", id: input.projectId }, "metadata.read");
	const projectIds = input.projectId ? [input.projectId] : (await listResources(pool, actor, "project", input.workspaceId)).map((project) => project.id);
	if (!projectIds.length) return { items: [], nextCursor: null };
	const states = [...new Set(input.states ?? (input.state ? [input.state] : []))];
	const allowedStates = input.view === "attempts" ? ["running", "delivered", "delivery_failed"] : ["queued", "running", "retry_wait", "succeeded", "failed_terminal", "reject", "respondOnly", "error", "accept", "delivered", "delivery_failed"];
	if (states.length > allowedStates.length || states.some((state) => !allowedStates.includes(state))) throw new AppError("invalid_state", 400, "Choose statuses available for this history view");
	const parsed = pageQuery.safeParse({ limit: input.limit, cursor: input.cursor });
	if (!parsed.success) throw new AppError("invalid_pagination", 400, "Choose a list limit from 1 to 200");
	const after = cursor(parsed.data.cursor);
	if (input.view === "attempts") {
		const rows = (
			await pool.query(
				`SELECT a.id,e.id AS event_id,ep.project_id,e.endpoint_id,ep.name AS endpoint_name,a.started_at,a.status_code,a.network_error,a.ended_at,a.execution_id,a.execution_attempt,octet_length(e.original_body) AS body_bytes,e.ingress_outcome,e.request_method,e.response_status,to_char(a.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.event e ON e.id=x.event_id JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE ep.project_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.endpoint_id=$2) AND ($3::timestamptz IS NULL OR (a.started_at,a.id)<($3::timestamptz,$4::uuid)) AND ($6::text[] IS NULL OR CASE WHEN a.ended_at IS NULL THEN 'running' WHEN a.status_code BETWEEN 200 AND 299 THEN 'delivered' ELSE 'delivery_failed' END=ANY($6::text[])) AND ($7::uuid IS NULL OR x.publication_id=$7) ORDER BY a.started_at DESC,a.id DESC LIMIT $5`,
				[projectIds, input.endpointId ?? null, after?.at ?? null, after?.id ?? null, parsed.data.limit + 1, states.length ? states : null, input.publicationId ?? null],
			)
		).rows;
		const selected = rows.slice(0, parsed.data.limit);
		const last = selected.at(-1);

		return {
			items: selected.map((row) => ({
				id: row.id,
				eventId: row.event_id,
				projectId: row.project_id,
				endpointId: row.endpoint_id,
				endpointName: row.endpoint_name,
				receivedAt: row.started_at.toISOString(),
				bodyBytes: row.body_bytes,
				executionId: row.execution_id,
				state: !row.ended_at ? "running" : row.status_code >= 200 && row.status_code < 300 ? "delivered" : "delivery_failed",
				processingAttempts: row.execution_attempt,
				deliveryAttempts: 1,
				ingressOutcome: row.ingress_outcome,
				method: row.request_method,
				responseStatus: row.status_code,
			})),
			nextCursor: rows.length > parsed.data.limit && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString("base64url") : null,
		};
	}

	const rows = (
		await pool.query(
			`SELECT e.id,e.ingress_outcome,e.request_method,e.response_status,ep.project_id,e.endpoint_id,e.publication_id,e.received_at,octet_length(e.original_body) AS body_bytes,ep.name AS endpoint_name,latest.id AS execution_id,latest.state,latest.attempt_number,latest.publication_id AS processing_publication_id,last_delivery.status_code AS delivery_status,last_delivery.ended_at AS delivery_ended_at,last_delivery.id AS delivery_id,(SELECT count(*)::int FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id WHERE x.event_id=e.id) AS delivery_attempts,to_char(e.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id LEFT JOIN LATERAL(SELECT x.id,x.state,x.attempt_number,x.publication_id FROM payloadbay.execution x WHERE x.event_id=e.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)latest ON true LEFT JOIN LATERAL(SELECT a.id,a.status_code,a.ended_at FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id WHERE x.event_id=e.id ORDER BY a.started_at DESC,a.id DESC LIMIT 1)last_delivery ON true WHERE ep.project_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.endpoint_id=$2) AND ($3::timestamptz IS NULL OR (e.received_at,e.id)<($3::timestamptz,$4::uuid)) AND ($6::text[] IS NULL OR COALESCE(latest.state,e.ingress_outcome)=ANY($6::text[]) OR CASE WHEN last_delivery.ended_at IS NULL THEN NULL WHEN last_delivery.status_code BETWEEN 200 AND 299 THEN 'delivered' ELSE 'delivery_failed' END=ANY($6::text[])) AND ($7::uuid IS NULL OR COALESCE(latest.publication_id,e.publication_id)=$7) ORDER BY e.received_at DESC,e.id DESC LIMIT $5`,
			[projectIds, input.endpointId ?? null, after?.at ?? null, after?.id ?? null, parsed.data.limit + 1, states.length ? states : null, input.publicationId ?? null],
		)
	).rows;
	const hasMore = rows.length > parsed.data.limit;
	const selected = rows.slice(0, parsed.data.limit);
	const last = selected.at(-1);

	return {
		items: selected.map((row) => ({
			id: row.id,
			eventId: row.id,
			projectId: row.project_id,
			endpointId: row.endpoint_id,
			endpointName: row.endpoint_name,
			publicationId: row.publication_id,
			processingPublicationId: row.processing_publication_id,
			deliveryState: !row.delivery_id ? null : !row.delivery_ended_at ? "running" : row.delivery_status >= 200 && row.delivery_status < 300 ? "delivered" : "delivery_failed",
			receivedAt: row.received_at.toISOString(),
			bodyBytes: row.body_bytes,
			executionId: row.execution_id,
			state: row.state ?? row.ingress_outcome,
			ingressOutcome: row.ingress_outcome,
			method: row.request_method,
			responseStatus: row.response_status,
			processingAttempts: row.attempt_number,
			deliveryAttempts: row.delivery_attempts,
		})),
		nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: last.id })).toString("base64url") : null,
	};
}

export async function eventPayload(pool: Pool, actor: Actor, id: string) {
	const scope = (await pool.query("SELECT ep.project_id FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [id])).rows[0];
	if (!scope) throw new AppError("not_found", 404, "Event unavailable");
	await requirePermission(pool, actor, { type: "project", id: scope.project_id }, "payload.read");
	const row = (await pool.query("SELECT original_body,accepted_body,headers,metadata,content_type FROM payloadbay.event WHERE id=$1", [id])).rows[0];

	return {
		originalBody: row.original_body.toString("base64"),
		acceptedBody: row.accepted_body.toString("base64"),
		headers: row.headers,
		metadata: row.metadata,
		contentType: row.content_type,
		encoding: "base64",
	};
}

export async function eventDetails(pool: Pool, actor: Actor, id: string) {
	const row = (await pool.query("SELECT e.id,e.metadata->'platform'->'protection' AS protection,e.ingress_outcome,e.request_method,e.response_status,e.endpoint_id,e.publication_id,e.received_at,e.content_type,octet_length(e.original_body) AS body_bytes,ep.project_id,ep.name AS endpoint_name FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Event unavailable");
	const held = await requirePermission(pool, actor, { type: "project", id: row.project_id }, "metadata.read");
	const executions = (await pool.query("SELECT id,publication_id,replay_of_id,state,attempt_number,max_attempts,due_at,created_at FROM payloadbay.execution WHERE event_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200", [id])).rows;
	const attempts = (await pool.query("SELECT a.id,a.execution_id,a.operation_id,a.execution_attempt,a.generation,a.started_at,a.ended_at,a.status_code,a.network_error,a.duration_ms FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id WHERE x.event_id=$1 ORDER BY a.started_at DESC,a.id DESC LIMIT 200", [id])).rows;

	const processingAttempts = (await pool.query("SELECT a.execution_id,a.attempt_number,a.state,a.started_at,a.ended_at,CASE WHEN $2 THEN a.result ELSE NULL END AS result FROM payloadbay.processing_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id WHERE x.event_id=$1 ORDER BY a.started_at DESC,a.execution_id DESC,a.attempt_number DESC LIMIT 200", [id, held.has("payload.read")])).rows;

	return {
		id: row.id,
		projectId: row.project_id,
		endpointId: row.endpoint_id,
		endpointName: row.endpoint_name,
		publicationId: row.publication_id,
		receivedAt: row.received_at.toISOString(),
		contentType: row.content_type,
		bodyBytes: row.body_bytes,
		ingressOutcome: row.ingress_outcome,
		method: row.request_method,
		responseStatus: row.response_status,
		executions,
		processingAttempts,
		protection: row.ingress_outcome === "reject" ? (row.protection ?? null) : null,
		attempts,
	};
}

/** Response bytes require payload permission, independently of attempt metadata. */
export async function deliveryAttemptDetails(pool: Pool, actor: Actor, id: string) {
	const row = (await pool.query(`SELECT a.*,x.event_id,ep.project_id FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.endpoint ep ON ep.id=x.endpoint_id WHERE a.id=$1`, [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Delivery attempt unavailable");
	const held = await requirePermission(pool, actor, { type: "project", id: row.project_id }, "metadata.read");

	return {
		id: row.id,
		eventId: row.event_id,
		operationId: row.operation_id,
		status: row.status_code,
		networkError: row.network_error,
		durationMs: row.duration_ms,
		startedAt: row.started_at.toISOString(),
		endedAt: row.ended_at?.toISOString() ?? null,
		...(held.has("payload.read") ? { responseBody: row.response_body?.toString("base64") ?? null, encoding: "base64" } : {}),
	};
}

/** Freeze the replayable IDs selected by the current filters, independent of pagination. */
export async function selectReplayEvents(pool: Pool, actor: Actor, input: Omit<Parameters<typeof listEvents>[2], "view" | "limit" | "cursor">) {
	const ids: string[] = [];
	const allowed = new Map<string, boolean>();
	let after: string | undefined;
	let scanned = 0;
	do {
		const page = await listEvents(pool, actor, {
			...input,
			view: "requests",
			limit: 200,
			cursor: after,
		});
		scanned += page.items.length;
		if (scanned > 10_000) throw new AppError("selection_too_large", 413, "Narrow the filters before selecting across more than 10000 events");
		for (const event of page.items) {
			if (event.ingressOutcome !== "accept") continue;
			if (!allowed.has(event.projectId)) allowed.set(event.projectId, (await actorPermissions(pool, actor, { type: "project", id: event.projectId })).has("events.replay"));
			if (!allowed.get(event.projectId)) continue;
			ids.push(event.id);
			if (ids.length > 1000) throw new AppError("selection_too_large", 413, "Narrow the filters to at most 1000 replayable events per operation");
		}

		after = page.nextCursor ?? undefined;
	} while (after);

	return { ids, count: ids.length };
}
