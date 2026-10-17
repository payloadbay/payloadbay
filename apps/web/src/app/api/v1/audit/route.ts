import { protectedRoute } from "@api/protected";
import { listAudit } from "@domain/audit";
import { pageQuery } from "@contracts/api";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const parsed = pageQuery.safeParse({ limit: query.get("limit") ?? undefined, cursor: query.get("cursor") ?? undefined });
		if (!parsed.success) throw new AppError("invalid_pagination", 400, "Choose a list limit from 1 to 200");
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];

		return listAudit(pool, actor, installation.id, parsed.data);
	});
}
