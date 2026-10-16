import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { actorPermissions, requirePermission } from "@domain/membership";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const id = uuid((await params).projectId);
		await requirePermission(pool, actor, { type: "project", id }, "metadata.read");
		const row = (await pool.query("SELECT p.id,p.name,p.slug,p.workspace_id,w.organization_id FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id=$1", [id])).rows[0];

		return { ...row, permissions: [...(await actorPermissions(pool, actor, { type: "project", id }))] };
	});
}
