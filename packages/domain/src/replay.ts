import type { Pool } from "pg";
import { createHash } from "node:crypto";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { scheduleDispatch } from "./execution-lease.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function replayEvent(
	pool: Pool,
	actor: Actor,
	input: {
		eventId: string;
		key: string;
		publicationPolicy?: "original" | "current";
		sourceExecutionId?: string;
	},
) {
	if (!input.key || input.key.length > 128 || /[\x00-\x1f]/.test(input.key)) throw new AppError("invalid_replay_key", 400, "Provide an idempotency key up to 128 characters");
	const policy = input.publicationPolicy ?? "original";
	if (!["original", "current"].includes(policy)) throw new AppError("invalid_replay_policy", 400, "Choose original or current publication");
	const digest = createHash("sha256")
		.update(JSON.stringify({ eventId: input.eventId, publicationPolicy: policy, sourceExecutionId: input.sourceExecutionId ?? null }))
		.digest("hex");

	return transaction(pool, async (db) => {
		const event = (await db.query("SELECT e.*,ep.project_id,ep.active_publication_id,ep.priority FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [input.eventId])).rows[0];
		if (!event) throw new AppError("not_found", 404, "Event unavailable");
		await requirePermission(db, actor, { type: "project", id: event.project_id }, "events.replay");
		if (event.ingress_outcome !== "accept") throw new AppError("request_not_accepted", 409, "Only accepted events can be replayed for delivery");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["replay", actor.userId, input.eventId, input.key])]);
		const prior = (await db.query("SELECT input_digest,execution_id FROM payloadbay.replay_key WHERE actor=$1 AND event_id=$2 AND key=$3", [actor.userId, input.eventId, input.key])).rows[0];
		if (prior) {
			if (prior.input_digest !== digest) throw new AppError("replay_input_changed", 409, "Replay key was reused with different input");

			return { id: prior.execution_id, reused: true };
		}

		const endpoint = (await db.query("SELECT active_publication_id,priority FROM payloadbay.endpoint WHERE id=$1 FOR SHARE", [event.endpoint_id])).rows[0];
		const source = (await db.query("SELECT id,max_attempts FROM payloadbay.execution WHERE event_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY created_at DESC,id DESC LIMIT 1", [event.id, input.sourceExecutionId ?? null])).rows[0];
		if (input.sourceExecutionId && !source) throw new AppError("not_found", 404, "Source execution unavailable");
		const publicationId = policy === "original" ? event.publication_id : endpoint.active_publication_id;
		if (!publicationId) throw new AppError("publication_unavailable", 409, "No current publication is available");
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,replay_of_id,max_attempts) VALUES($1,$2,$3,$4,$5) RETURNING *", [event.id, event.endpoint_id, publicationId, source?.id ?? null, source?.max_attempts ?? 5])).rows[0];
		await scheduleDispatch(db, execution, endpoint.priority);
		await db.query("INSERT INTO payloadbay.replay_key(actor,event_id,key,input_digest,execution_id) VALUES($1,$2,$3,$4,$5)", [actor.userId, event.id, input.key, digest, execution.id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'event.replayed',$3,$4)", [actor.userId, event.project_id, execution.id, JSON.stringify({ eventId: event.id, publicationPolicy: policy, publicationId })]);

		return { id: execution.id, reused: false };
	});
}
