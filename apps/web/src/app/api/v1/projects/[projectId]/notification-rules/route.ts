import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { createNotificationRule, listNotificationRules, notificationRuleInput } from "@domain/notification-rules";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => listNotificationRules(pool, actor, uuid((await params).projectId)));
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => createNotificationRule(pool, actor, uuid((await params).projectId), await readJson(request, notificationRuleInput)));
}
