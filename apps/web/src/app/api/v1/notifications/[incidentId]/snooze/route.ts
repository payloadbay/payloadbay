import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { snoozeNotificationInput } from "@contracts/notifications";
import { snoozeNotification } from "@domain/notifications";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ incidentId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const input = await readJson(request, snoozeNotificationInput);

		return snoozeNotification(pool, actor, uuid((await params).incidentId), input.minutes);
	});
}
