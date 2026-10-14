import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { listEvents } from "@domain/events";
import { pageQuery } from "@contracts/api";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const parsed = pageQuery.safeParse({ limit: query.get("limit") ?? undefined, cursor: query.get("cursor") ?? undefined });
		if (!parsed.success) throw new AppError("invalid_pagination", 400, "Choose a list limit from 1 to 200");

		return listEvents(pool, actor, { projectId: uuid((await params).projectId), ...parsed.data, ...(query.get("endpointId") ? { endpointId: uuid(query.get("endpointId")!) } : {}) });
	});
}
