import type { Pool } from "pg";
import { z } from "zod";
import type { Actor, ScopeRef } from "./authorization.ts";
import { requirePermission } from "./membership.ts";
import { transaction } from "./db.ts";
import { pageQuery } from "../../contracts/src/api.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { auditPageSchema } from "../../contracts/src/audit.ts";

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() }).strict();

export async function listAudit(pool: Pool, actor: Actor, target: string | ScopeRef, input: z.input<typeof pageQuery>) {
	return transaction(pool, async (db) => {
		const scope: ScopeRef = typeof target === "string" ? { type: "instance", id: target } : target;
		await requirePermission(db, actor, scope, "audit.read");
		const page = pageQuery.parse(input);
		let cursor: z.infer<typeof cursorSchema> | null = null;
		if (page.cursor) {
			try {
				if (!/^[A-Za-z0-9_-]+$/.test(page.cursor)) throw Error();
				cursor = cursorSchema.parse(JSON.parse(Buffer.from(page.cursor, "base64url").toString("utf8")));
			} catch {
				throw new AppError("invalid_cursor", 400, "List cursor is invalid");
			}
		}

		const rows = (
			await db.query(
				`SELECT a.id,a.actor,a.operation,a.scope_type,a.scope_id,a.resource_id,a.redacted_diff->>'resourceName' AS recorded_resource_name,
 to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
 FROM payloadbay.audit a WHERE (
 (a.scope_type=$5 AND a.scope_id=$1)
 OR ($5='organization' AND a.scope_type='workspace' AND EXISTS(SELECT 1 FROM payloadbay.workspace w WHERE w.id=a.scope_id AND w.organization_id=$1))
 OR ($5 IN ('organization','workspace') AND a.scope_type='project' AND EXISTS(SELECT 1 FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id=a.scope_id AND (($5='workspace' AND w.id=$1) OR ($5='organization' AND w.organization_id=$1))))
 OR ($5 IN ('organization','workspace','project') AND a.scope_type='endpoint' AND EXISTS(SELECT 1 FROM payloadbay.endpoint ep JOIN payloadbay.project p ON p.id=ep.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE ep.id=a.scope_id AND (($5='project' AND p.id=$1) OR ($5='workspace' AND w.id=$1) OR ($5='organization' AND w.organization_id=$1))))
 ) AND ($2::timestamptz IS NULL OR (a.created_at,a.id)<($2::timestamptz,$3::uuid))
 ORDER BY a.created_at DESC,a.id DESC LIMIT $4`,
				[scope.id, cursor?.at ?? null, cursor?.id ?? null, page.limit + 1, scope.type],
			)
		).rows;
		const users = (await db.query('SELECT id,name FROM auth."user" WHERE id=ANY($1::text[])', [[...new Set(rows.map((row) => row.actor))]])).rows;
		const userNames = new Map(users.map((user) => [user.id, user.name]));
		const selected = rows.slice(0, page.limit);
		const resolved = (
			await db.query(
				`
 WITH requested AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(scope_type text,scope_id text,resource_id text))
 SELECT requested.*,scoped.name AS scope_name,resource.name AS resource_name
 FROM requested
 LEFT JOIN LATERAL (
  SELECT name FROM payloadbay.organization WHERE requested.scope_type='organization' AND id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.workspace WHERE requested.scope_type='workspace' AND id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.project WHERE requested.scope_type='project' AND id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.endpoint WHERE requested.scope_type='endpoint' AND id::text=requested.scope_id
  UNION ALL SELECT 'Instance operations' WHERE requested.scope_type='instance'
 ) scoped ON true
 LEFT JOIN LATERAL (
  SELECT name FROM payloadbay.organization WHERE requested.scope_type='organization' AND id::text=requested.scope_id AND id::text=requested.resource_id
  UNION ALL SELECT name FROM payloadbay.workspace WHERE id::text=requested.resource_id AND ((requested.scope_type='workspace' AND id::text=requested.scope_id) OR (requested.scope_type='organization' AND organization_id::text=requested.scope_id))
  UNION ALL SELECT p.name FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id::text=requested.resource_id AND ((requested.scope_type='project' AND p.id::text=requested.scope_id) OR (requested.scope_type='workspace' AND w.id::text=requested.scope_id) OR (requested.scope_type='organization' AND w.organization_id::text=requested.scope_id))
  UNION ALL SELECT name FROM payloadbay.endpoint WHERE id::text=requested.resource_id AND ((requested.scope_type='project' AND project_id::text=requested.scope_id) OR (requested.scope_type='endpoint' AND id::text=requested.scope_id))
  UNION ALL SELECT name FROM payloadbay.destination WHERE id::text=requested.resource_id AND requested.scope_type='project' AND project_id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.shared_module_revision WHERE id::text=requested.resource_id AND scope_type=requested.scope_type AND scope_id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.secret_version WHERE id::text=requested.resource_id AND scope_type=requested.scope_type AND scope_id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.api_token WHERE id::text=requested.resource_id AND scope_type=requested.scope_type AND scope_id::text=requested.scope_id AND NOT personal
  UNION ALL SELECT m.name FROM payloadbay.middleware_binding m LEFT JOIN payloadbay.endpoint e ON m.scope_type='endpoint' AND e.id=m.scope_id WHERE m.id::text=requested.resource_id AND ((m.scope_type=requested.scope_type AND m.scope_id::text=requested.scope_id) OR (requested.scope_type='project' AND e.project_id::text=requested.scope_id))
  UNION ALL SELECT e.name || ' publication' FROM payloadbay.publication p JOIN payloadbay.endpoint e ON e.id=p.endpoint_id WHERE p.id::text=requested.resource_id AND requested.scope_type='project' AND e.project_id::text=requested.scope_id
  UNION ALL SELECT e.name || ' event' FROM payloadbay.event v JOIN payloadbay.endpoint e ON e.id=v.endpoint_id WHERE v.id::text=requested.resource_id AND requested.scope_type='project' AND e.project_id::text=requested.scope_id
  UNION ALL SELECT e.name || ' execution' FROM payloadbay.execution x JOIN payloadbay.event v ON v.id=x.event_id JOIN payloadbay.endpoint e ON e.id=v.endpoint_id WHERE x.id::text=requested.resource_id AND requested.scope_type='project' AND e.project_id::text=requested.scope_id
  UNION ALL SELECT name FROM payloadbay.notification_channel WHERE id::text=requested.resource_id AND requested.scope_type='instance' AND installation_id::text=requested.scope_id
  UNION ALL SELECT 'Invitation' FROM payloadbay.invitation WHERE id::text=requested.resource_id AND scope_type=requested.scope_type AND scope_id::text=requested.scope_id
  LIMIT 1
 ) resource ON true`,
				[JSON.stringify(selected.map((row) => ({ scope_type: row.scope_type, scope_id: row.scope_id, resource_id: row.resource_id })))],
			)
		).rows;
		const names = new Map(resolved.map((row) => [row.scope_type + ":" + row.scope_id + ":" + (row.resource_id ?? ""), row]));

		const items = rows.slice(0, page.limit).map((row) => ({
			id: row.id,
			actor: row.actor,
			actorName: userNames.get(row.actor) ?? null,
			operation: row.operation,
			scope: { type: row.scope_type, id: row.scope_id },
			resourceId: row.resource_id,
			resourceName: row.recorded_resource_name ?? names.get(row.scope_type + ":" + row.scope_id + ":" + (row.resource_id ?? ""))?.resource_name ?? null,
			scopeName: names.get(row.scope_type + ":" + row.scope_id + ":" + (row.resource_id ?? ""))?.scope_name ?? null,
			createdAt: row.created_at,
		}));
		const last = items.at(-1);

		return auditPageSchema.parse({ items, nextCursor: rows.length > page.limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt, id: last.id })).toString("base64url") : null });
	});
}
