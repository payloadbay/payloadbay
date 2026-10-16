import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { replayEvents } from "@domain/replay";

const input = z.object({ eventIds: z.array(z.uuid()).min(1).max(1000), publicationPolicy: z.enum(["original", "current", "selected"]), publicationId: z.uuid().optional() }).strict();

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => replayEvents(pool, actor, { ...(await readJson(request, input)), key: request.headers.get("idempotency-key") ?? "" }));
}
