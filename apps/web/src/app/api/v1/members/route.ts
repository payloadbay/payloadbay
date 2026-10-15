import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { grantInput, scopeSchema } from "@contracts/resources";
import { setGrant, requirePermission, scopeAncestry } from "@domain/membership";
import { effectivePermissions } from "@domain/authorization";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const q = new URL(request.url).searchParams;
		const parsed = scopeSchema.safeParse({ type: q.get("scopeType"), id: q.get("scopeId") });
		if (!parsed.success) throw new AppError("invalid_input", 400, "Choose a valid member scope");
		await requirePermission(pool, actor, parsed.data, "members.manage");
		const ancestry = await scopeAncestry(pool, parsed.data);
		const parents = ancestry.slice(0, -1);
		const members = (
			await pool.query(
				`
SELECT u.id AS user_id,u.name,u.email,COALESCE(g.role_preset,$4) AS role_preset,
       COALESCE(g.permissions,ARRAY[]::text[]) AS permissions,g.version
FROM payloadbay.admission a JOIN auth."user" u ON u.id=a.user_id
LEFT JOIN payloadbay.grant_record g ON g.user_id=u.id AND g.scope_type=$1 AND g.scope_id=$2
WHERE a.installation_id=$3 AND a.active
  AND ($1='instance' OR EXISTS (
    SELECT 1 FROM payloadbay.grant_record inherited,
      jsonb_to_recordset($5::jsonb) AS parent(type text,id uuid)
    WHERE inherited.user_id=u.id AND inherited.scope_type=parent.type AND inherited.scope_id=parent.id
  ))
ORDER BY u.name,u.id LIMIT 200`,
				[parsed.data.type, parsed.data.id, ancestry[0].id, parsed.data.type === "instance" ? "member" : "inherited", JSON.stringify(ancestry)],
			)
		).rows;

		for (const member of members) {
			const grants = (await pool.query("SELECT scope_type,scope_id,permissions FROM payloadbay.grant_record WHERE user_id=$1", [member.user_id])).rows;
			member.inherited_permissions = [
				...effectivePermissions(
					grants.map((row) => ({ scopeType: row.scope_type, scopeId: row.scope_id, permissions: row.permissions })),
					parents,
				),
			];
		}

		return members;
	});
}

export async function PUT(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const body = await readJson(request, grantInput);
		const match = request.headers.get("if-match");
		if (match && !/^"[1-9][0-9]*"$/.test(match)) throw new AppError("invalid_version", 400, "Use the current membership version");

		return setGrant(pool, actor, { ...body, expectedVersion: match ? Number(match.slice(1, -1)) : null });
	});
}
