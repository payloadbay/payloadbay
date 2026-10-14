import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { actorPermissions, requirePermission } from "@domain/membership";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const id = uuid((await params).projectId);
		await requirePermission(pool, actor, { type: "project", id }, "metadata.read");
		const row = (await pool.query("SELECT id,name,slug,workspace_id FROM payloadbay.project WHERE id=$1", [id])).rows[0];

		return { ...row, permissions: [...(await actorPermissions(pool, actor, { type: "project", id }))] };
	});
}
