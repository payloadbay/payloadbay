import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { replayEvent } from "@domain/replay";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z.object({ publicationPolicy: z.enum(["original", "current", "selected"]).optional(), sourceExecutionId: z.uuid().optional(), publicationId: z.uuid().optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => replayEvent(pool, actor, { eventId: uuid((await params).eventId), key: request.headers.get("idempotency-key") ?? "", ...(await readJson(request, input)) }));
}
