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
		const members = (await pool.query('SELECT g.user_id,g.role_preset,g.permissions,g.version,u.name,u.email FROM payloadbay.grant_record g JOIN auth."user" u ON u.id=g.user_id WHERE scope_type=$1 AND scope_id=$2 ORDER BY u.name LIMIT 200', [parsed.data.type, parsed.data.id])).rows;
		const parents = (await scopeAncestry(pool, parsed.data)).slice(0, -1);
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
