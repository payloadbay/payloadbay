import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { listResources } from "./resources.ts";
import { requirePermission } from "./membership.ts";
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
		endpointId?: string;
		limit?: number;
		cursor?: string;
	},
) {
	if (input.projectId) await requirePermission(pool, actor, { type: "project", id: input.projectId }, "metadata.read");
	const projectIds = input.projectId ? [input.projectId] : (await listResources(pool, actor, "project", input.workspaceId)).map((project) => project.id);
	if (!projectIds.length) return { items: [], nextCursor: null };
	if (input.state && !["queued", "running", "retry_wait", "succeeded", "failed_terminal", "reject", "respondOnly", "error"].includes(input.state)) throw new AppError("invalid_state", 400, "Choose a valid processing state");
	const parsed = pageQuery.safeParse({ limit: input.limit, cursor: input.cursor });
	if (!parsed.success) throw new AppError("invalid_pagination", 400, "Choose a list limit from 1 to 200");
	const after = cursor(parsed.data.cursor);
	if (input.view === "attempts") {
		const rows = (
			await pool.query(
				`SELECT a.id,e.id AS event_id,ep.project_id,e.endpoint_id,ep.name AS endpoint_name,a.started_at,a.status_code,a.network_error,a.ended_at,a.execution_id,a.execution_attempt,octet_length(e.original_body) AS body_bytes,e.ingress_outcome,e.request_method,e.response_status,to_char(a.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.event e ON e.id=x.event_id JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE ep.project_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.endpoint_id=$2) AND ($3::timestamptz IS NULL OR (a.started_at,a.id)<($3::timestamptz,$4::uuid)) ORDER BY a.started_at DESC,a.id DESC LIMIT $5`,
				[projectIds, input.endpointId ?? null, after?.at ?? null, after?.id ?? null, parsed.data.limit + 1],
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
			`SELECT e.id,e.ingress_outcome,e.request_method,e.response_status,ep.project_id,e.endpoint_id,e.publication_id,e.received_at,octet_length(e.original_body) AS body_bytes,ep.name AS endpoint_name,latest.id AS execution_id,latest.state,latest.attempt_number,(SELECT count(*)::int FROM payloadbay.delivery_attempt a WHERE a.execution_id=latest.id) AS delivery_attempts,to_char(e.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id LEFT JOIN LATERAL(SELECT x.id,x.state,x.attempt_number FROM payloadbay.execution x WHERE x.event_id=e.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)latest ON true WHERE ep.project_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.endpoint_id=$2) AND ($3::timestamptz IS NULL OR (e.received_at,e.id)<($3::timestamptz,$4::uuid)) AND ($6::text IS NULL OR COALESCE(latest.state,e.ingress_outcome)=$6) ORDER BY e.received_at DESC,e.id DESC LIMIT $5`,
			[projectIds, input.endpointId ?? null, after?.at ?? null, after?.id ?? null, parsed.data.limit + 1, input.state ?? null],
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
	const row = (await pool.query("SELECT e.id,e.ingress_outcome,e.request_method,e.response_status,e.endpoint_id,e.publication_id,e.received_at,e.content_type,octet_length(e.original_body) AS body_bytes,ep.project_id,ep.name AS endpoint_name FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Event unavailable");
	await requirePermission(pool, actor, { type: "project", id: row.project_id }, "metadata.read");
	const executions = (await pool.query("SELECT id,publication_id,replay_of_id,state,attempt_number,max_attempts,due_at,created_at FROM payloadbay.execution WHERE event_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200", [id])).rows;
	const attempts = (await pool.query("SELECT a.id,a.execution_id,a.operation_id,a.execution_attempt,a.generation,a.started_at,a.ended_at,a.status_code,a.network_error,a.duration_ms FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id WHERE x.event_id=$1 ORDER BY a.started_at DESC,a.id DESC LIMIT 200", [id])).rows;

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
		attempts,
	};
}
