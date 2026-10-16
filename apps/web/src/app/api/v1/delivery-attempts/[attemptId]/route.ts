import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { deliveryAttemptDetails } from "@domain/events";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => deliveryAttemptDetails(pool, actor, uuid((await params).attemptId)));
}
