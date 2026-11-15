import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { dismissNotification } from "@domain/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ incidentId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		await dismissNotification(pool, actor, uuid((await params).incidentId));

		return { dismissed: true };
	});
}
