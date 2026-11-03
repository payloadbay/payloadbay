import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { selectReplayEvents } from "@domain/events";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;

		return selectReplayEvents(pool, actor, {
			...(query.get("projectId") ? { projectId: uuid(query.get("projectId")!) } : {}),
			...(query.get("workspaceId") ? { workspaceId: uuid(query.get("workspaceId")!) } : {}),
			...(query.get("endpointId") ? { endpointId: uuid(query.get("endpointId")!) } : {}),
			...(query.get("publicationId") ? { publicationId: uuid(query.get("publicationId")!) } : {}),
			states: query.getAll("state").filter(Boolean),
		});
	});
}
