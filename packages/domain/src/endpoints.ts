import { scheduleDispatch } from "./execution-lease.ts";
import { deliveryTemplate } from "../../script-sdk/src/templates/delivery.ts";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function endpointFor(pool: Pool, actor: Actor, id: string, permission: "metadata.read" | "code.read" | "code.edit" | "code.publish" | "endpoints.configure" = "metadata.read") {
	const endpoint = (await pool.query("SELECT * FROM payloadbay.endpoint WHERE id=$1", [id])).rows[0];
	if (!endpoint) throw new AppError("not_found", 404, "Ingress route unavailable");
	const held = await requirePermission(pool, actor, { type: "project", id: endpoint.project_id }, permission);

	return { endpoint, permissions: [...held] };
}

export async function listEndpoints(pool: Pool, actor: Actor, projectId: string) {
	await requirePermission(pool, actor, { type: "project", id: projectId }, "metadata.read");

	return (await pool.query("SELECT id,name,slug,active_publication_id,paused,priority,config_version FROM payloadbay.endpoint WHERE project_id=$1 ORDER BY name,id LIMIT 200", [projectId])).rows;
}

export async function createEndpoint(
	pool: Pool,
	actor: Actor,
	input: {
		projectId: string;
		name: string;
		slug: string;
		priority?: 0 | 50;
	},
) {
	if (!input.name.trim() || input.name.length > 100 || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.slug)) throw new AppError("invalid_input", 400, "Provide a name and lowercase URL name");

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "project", id: input.projectId }, "endpoints.configure");
		const endpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key,priority) VALUES($1,$2,$3,$4,$5) RETURNING id,name,slug,config_version,ingress_key", [input.projectId, input.name.trim(), input.slug, randomBytes(24).toString("base64url"), input.priority ?? 0])).rows[0];
		await db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [endpoint.id, 'export async function POST(ctx: IngressContext): Promise<IngressDecision> {\n\treturn ctx.reject({ status: 503, body: "Configure and publish your ingress handler first." });\n}\n', deliveryTemplate.body]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'endpoint.created',$3)", [actor.userId, input.projectId, endpoint.id]);

		return endpoint;
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("slug_conflict", 409, "This URL name is already used in the project");
		throw error;
	});
}

export async function getDraft(pool: Pool, actor: Actor, endpointId: string, stage: "ingress" | "processing") {
	await endpointFor(pool, actor, endpointId, "code.read");
	const row = (await pool.query("SELECT * FROM payloadbay.draft WHERE endpoint_id=$1 AND stage=$2", [endpointId, stage])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Draft unavailable");

	return row;
}

export async function setEndpointPaused(pool: Pool, actor: Actor, input: { id: string; paused: boolean; expectedVersion: number }) {
	return transaction(pool, async (db) => {
		const endpoint = (await db.query("SELECT * FROM payloadbay.endpoint WHERE id=$1", [input.id])).rows[0];
		if (!endpoint) throw new AppError("not_found", 404, "Ingress route unavailable");
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "endpoints.pause");
		const locked = (await db.query("SELECT * FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
		if (locked.config_version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Ingress route changed; reload before changing delivery state");
		const row = (await db.query("UPDATE payloadbay.endpoint SET paused=$2,config_version=config_version+1 WHERE id=$1 RETURNING id,paused,config_version", [input.id, input.paused])).rows[0];
		if (locked.paused && !input.paused) {
			const waiting = (await db.query("SELECT * FROM payloadbay.execution WHERE endpoint_id=$1 AND state IN ('queued','retry_wait') AND due_at<=clock_timestamp() AND attempt_number<max_attempts ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 100", [input.id])).rows;
			for (const execution of waiting) {
				const fresh = (await db.query("UPDATE payloadbay.execution SET dispatch_generation=dispatch_generation+1 WHERE id=$1 RETURNING *", [execution.id])).rows[0];
				await scheduleDispatch(db, fresh, locked.priority);
			}

			await db.query("UPDATE payloadbay.dispatch d SET claim_deadline_at=clock_timestamp() FROM payloadbay.execution e WHERE d.execution_id=e.id AND d.generation=e.dispatch_generation AND e.endpoint_id=$1 AND e.state IN ('queued','retry_wait') AND e.due_at<=clock_timestamp() AND NOT(e.id=ANY($2::uuid[]))", [input.id, waiting.map((execution) => execution.id)]);
		}

		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'endpoint.delivery_state',$3,$4)", [actor.userId, endpoint.project_id, input.id, JSON.stringify({ paused: input.paused })]);

		return { id: row.id, paused: row.paused, version: row.config_version };
	});
}
