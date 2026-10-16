import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { actorPermissions, requirePermission, scopeAncestry } from "./membership.ts";
import { rolePermissions, type Actor, type ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function listResources(pool: Pool, actor: Actor, type: "organization" | "workspace" | "project", workspaceId?: string) {
	if (type === "organization") {
		const rows = (
			await pool.query(
				"SELECT o.id,o.name,o.slug,o.installation_id FROM payloadbay.organization o JOIN payloadbay.installation i ON i.id=o.installation_id WHERE o.archived_at IS NULL AND i.bootstrap_state='complete' AND EXISTS(SELECT 1 FROM payloadbay.admission a WHERE a.installation_id=o.installation_id AND a.user_id=$1 AND a.active) AND EXISTS(SELECT 1 FROM payloadbay.grant_record g WHERE g.user_id=$1 AND 'metadata.read'=ANY(g.permissions) AND ((g.scope_type='instance' AND g.scope_id=o.installation_id) OR (g.scope_type='organization' AND g.scope_id=o.id))) AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM payloadbay.api_token t WHERE t.id=$2 AND t.user_id=$1 AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp() AND 'metadata.read'=ANY(t.permissions) AND ((t.scope_type='instance' AND t.scope_id=o.installation_id) OR (t.scope_type='organization' AND t.scope_id=o.id)))) ORDER BY o.name,o.id LIMIT 200",
				[actor.userId, actor.token?.id ?? null],
			)
		).rows;
		const visible = [];
		for (const row of rows) {
			const held = await actorPermissions(pool, actor, { type, id: row.id });
			if (held.has("metadata.read")) visible.push({ ...row, permissions: [...held] });
		}

		return visible;
	}

	const project = type === "project";

	const matches = (alias: string) => `(${alias}.scope_type='instance' AND ${alias}.scope_id=w.installation_id) OR (${alias}.scope_type='organization' AND ${alias}.scope_id=w.organization_id) OR (${alias}.scope_type='workspace' AND ${alias}.scope_id=w.id)${project ? ` OR (${alias}.scope_type='project' AND ${alias}.scope_id=p.id)` : ""}`;

	const query = `SELECT ${project ? "p.id,p.name,p.slug,p.workspace_id,w.organization_id" : "w.id,w.name,w.slug,w.installation_id,w.organization_id"} FROM ${project ? "payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id" : "payloadbay.workspace w"} JOIN payloadbay.organization o ON o.id=w.organization_id AND o.installation_id=w.installation_id JOIN payloadbay.installation i ON i.id=w.installation_id WHERE o.archived_at IS NULL AND w.archived_at IS NULL AND i.bootstrap_state='complete' ${project ? "AND p.archived_at IS NULL AND ($3::uuid IS NULL OR p.workspace_id=$3)" : ""} AND EXISTS(SELECT 1 FROM payloadbay.admission a WHERE a.installation_id=w.installation_id AND a.user_id=$1 AND a.active) AND EXISTS(SELECT 1 FROM payloadbay.grant_record g WHERE g.user_id=$1 AND 'metadata.read'=ANY(g.permissions) AND (${matches("g")})) AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM payloadbay.api_token t WHERE t.id=$2 AND t.user_id=$1 AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp() AND 'metadata.read'=ANY(t.permissions) AND (${matches("t")}))) ORDER BY ${project ? "p.name,p.id" : "w.name,w.id"} LIMIT 200`;
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
		type: "organization" | "workspace" | "project";
		parentId: string;
		name: string;
		slug: string;
	},
) {
	if (!input.name.trim() || input.name.length > 100 || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.slug)) throw new AppError("invalid_input", 400, "Provide a name and lowercase slug");

	return transaction(pool, async (db) => {
		const parent: ScopeRef = { type: input.type === "organization" ? "instance" : input.type === "workspace" ? "organization" : "workspace", id: input.parentId };
		await requirePermission(db, actor, parent, input.type === "organization" ? "organizations.create" : input.type === "workspace" ? "workspaces.create" : "projects.create");
		// Creating a new explicitly owned scope assigns full owner rights. Require that authority.
		await requirePermission(db, actor, parent, "ownership.transfer");
		const row =
			input.type === "organization"
				? (await db.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,$2,$3,$4) RETURNING id,name,slug,installation_id", [input.parentId, input.name.trim(), input.slug, actor.userId])).rows[0]
				: input.type === "workspace"
					? (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,$3,$4,$5) RETURNING id,name,slug,organization_id", [(await scopeAncestry(db, parent))[0].id, input.parentId, input.name.trim(), input.slug, actor.userId])).rows[0]
					: (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,$2,$3,$4) RETURNING id,name,slug,workspace_id", [input.parentId, input.name.trim(), input.slug, actor.userId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,$2,$3,'owner',$4)", [actor.userId, input.type, row.id, rolePermissions.owner]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3::uuid,'scope.created',$3::text)", [actor.userId, input.type, row.id]);

		return row;
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("slug_conflict", 409, "This slug is already in use");
		throw error;
	});
}
