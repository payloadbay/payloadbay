import { eventReplayInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { replayEvent } from "@domain/replay";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => replayEvent(pool, actor, { eventId: uuid((await params).eventId), key: request.headers.get("idempotency-key") ?? "", ...(await readJson(request, eventReplayInput)) }));
}
