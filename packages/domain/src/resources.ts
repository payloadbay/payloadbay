import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { actorPermissions, requirePermission } from "./membership.ts";
import { rolePermissions, type Actor, type ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function listResources(pool: Pool, actor: Actor, type: "workspace" | "project", workspaceId?: string) {
	const project = type === "project";

	const matches = (alias: string) => `(${alias}.scope_type='instance' AND ${alias}.scope_id=w.installation_id) OR (${alias}.scope_type='workspace' AND ${alias}.scope_id=w.id)${project ? ` OR (${alias}.scope_type='project' AND ${alias}.scope_id=p.id)` : ""}`;

	const query = `SELECT ${project ? "p.id,p.name,p.slug,p.workspace_id" : "w.id,w.name,w.slug,w.installation_id"} FROM ${project ? "payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id" : "payloadbay.workspace w"} JOIN payloadbay.installation i ON i.id=w.installation_id WHERE w.archived_at IS NULL AND i.bootstrap_state='complete' ${project ? "AND p.archived_at IS NULL AND ($3::uuid IS NULL OR p.workspace_id=$3)" : ""} AND EXISTS(SELECT 1 FROM payloadbay.admission a WHERE a.installation_id=w.installation_id AND a.user_id=$1 AND a.active) AND EXISTS(SELECT 1 FROM payloadbay.grant_record g WHERE g.user_id=$1 AND 'metadata.read'=ANY(g.permissions) AND (${matches("g")})) AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM payloadbay.api_token t WHERE t.id=$2 AND t.user_id=$1 AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp() AND 'metadata.read'=ANY(t.permissions) AND (${matches("t")}))) ORDER BY ${project ? "p.name,p.id" : "w.name,w.id"} LIMIT 200`;
	const rows = (await pool.query(query, project ? [actor.userId, actor.token?.id ?? null, workspaceId ?? null] : [actor.userId, actor.token?.id ?? null])).rows;
	const visible = [];
	for (const row of rows) {
		try {
			const held = await actorPermissions(pool, actor, { type, id: row.id });
			if (held.has("metadata.read")) visible.push({ ...row, permissions: [...held] });
		} catch (error) {
			if (!(error instanceof AppError && [401, 404].includes(error.status))) throw error;
		}
	}

	return visible;
}

export async function createResource(
	pool: Pool,
	actor: Actor,
	input: {
		type: "workspace" | "project";
		parentId: string;
		name: string;
		slug: string;
	},
) {
	if (!input.name.trim() || input.name.length > 100 || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.slug)) throw new AppError("invalid_input", 400, "Provide a name and lowercase slug");

	return transaction(pool, async (db) => {
		const parent: ScopeRef = { type: input.type === "workspace" ? "instance" : "workspace", id: input.parentId };
		await requirePermission(db, actor, parent, input.type === "workspace" ? "workspaces.create" : "projects.create");
		// Creating a new explicitly owned scope assigns full owner rights. Require that authority.
		await requirePermission(db, actor, parent, "ownership.transfer");
		const row = (await db.query(`INSERT INTO payloadbay.${input.type}(${input.type === "workspace" ? "installation_id" : "workspace_id"},name,slug,owner_user_id) VALUES($1,$2,$3,$4) RETURNING id,name,slug`, [input.parentId, input.name.trim(), input.slug, actor.userId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,$2,$3,'owner',$4)", [actor.userId, input.type, row.id, rolePermissions.owner]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3::uuid,'scope.created',$3::text)", [actor.userId, input.type, row.id]);

		return row;
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("slug_conflict", 409, "This slug is already in use");
		throw error;
	});
}
