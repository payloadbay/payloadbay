import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { listNotificationPreferences } from "@domain/notification-subscriptions";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => listNotificationPreferences(pool, actor, { type: "workspace", id: uuid((await params).workspaceId) }));
}
