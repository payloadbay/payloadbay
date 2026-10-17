import type { Pool } from "pg";
import { z } from "zod";
import type { Actor } from "./authorization.ts";
import { requirePermission } from "./membership.ts";
import { transaction } from "./db.ts";
import { pageQuery } from "../../contracts/src/api.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { auditPageSchema } from "../../contracts/src/audit.ts";

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() }).strict();

export async function listAudit(pool: Pool, actor: Actor, installationId: string, input: z.input<typeof pageQuery>) {
	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "instance", id: installationId }, "audit.read");
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
				`SELECT a.id,a.actor,a.operation,a.scope_type,a.scope_id,a.resource_id,
 to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
 FROM payloadbay.audit a WHERE (
 (a.scope_type='instance' AND a.scope_id=$1)
 OR (a.scope_type='organization' AND EXISTS(SELECT 1 FROM payloadbay.organization o WHERE o.id=a.scope_id AND o.installation_id=$1))
 OR (a.scope_type='workspace' AND EXISTS(SELECT 1 FROM payloadbay.workspace w WHERE w.id=a.scope_id AND w.installation_id=$1))
 OR (a.scope_type='project' AND EXISTS(SELECT 1 FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id=a.scope_id AND w.installation_id=$1))
 OR (a.scope_type='endpoint' AND EXISTS(SELECT 1 FROM payloadbay.endpoint ep JOIN payloadbay.project p ON p.id=ep.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE ep.id=a.scope_id AND w.installation_id=$1))
 ) AND ($2::timestamptz IS NULL OR (a.created_at,a.id)<($2::timestamptz,$3::uuid))
 ORDER BY a.created_at DESC,a.id DESC LIMIT $4`,
				[installationId, cursor?.at ?? null, cursor?.id ?? null, page.limit + 1],
			)
		).rows;
		const items = rows.slice(0, page.limit).map((row) => ({
			id: row.id,
			actor: row.actor,
			operation: row.operation,
			scope: { type: row.scope_type, id: row.scope_id },
			resourceId: row.resource_id,
			createdAt: row.created_at,
		}));
		const last = items.at(-1);

		return auditPageSchema.parse({ items, nextCursor: rows.length > page.limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt, id: last.id })).toString("base64url") : null });
	});
}
