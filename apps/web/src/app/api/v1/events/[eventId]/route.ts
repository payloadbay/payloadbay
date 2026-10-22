import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { eventDetails } from "@domain/events";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => eventDetails(pool, actor, uuid((await params).eventId)));
}
