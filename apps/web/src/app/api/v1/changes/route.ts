import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { streamChanges } from "@domain/live";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const type = query.get("scopeType");
		if (type !== "project" && type !== "workspace" && type !== "instance" && type !== "accessible") throw new AppError("invalid_scope", 400, "Choose a live update scope");

		return streamChanges(pool, actor, { type, id: uuid(query.get("scopeId") ?? "") }, request.headers.get("last-event-id") ?? query.get("after") ?? "0", request.signal);
	});
}
