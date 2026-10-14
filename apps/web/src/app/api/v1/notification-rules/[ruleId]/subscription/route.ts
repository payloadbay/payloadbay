import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { notificationSubscriptionInput } from "@contracts/notifications";
import { setNotificationSubscription } from "@domain/notification-subscriptions";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => setNotificationSubscription(pool, actor, uuid((await params).ruleId), await readJson(request, notificationSubscriptionInput)));
}
