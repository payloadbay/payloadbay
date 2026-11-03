import { bulkReplayInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { replayEvents } from "@domain/replay";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => replayEvents(pool, actor, { ...(await readJson(request, bulkReplayInput)), key: request.headers.get("idempotency-key") ?? "" }));
}
