import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid, version } from "@api/parameters";
import { updateNotificationRule, notificationRuleUpdateInput } from "@domain/notification-rules";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => updateNotificationRule(pool, actor, uuid((await params).ruleId), version(request), await readJson(request, notificationRuleUpdateInput)));
}
