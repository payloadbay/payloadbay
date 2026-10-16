import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { emailBranding } from "@contracts/notification-channels";
import { notificationInstance } from "@domain/notification-channels";
import { requirePermission } from "@domain/membership";
import { renderEmailMessage } from "@domain/email-renderer";
import { sampleNotification } from "@domain/notification-testing";

const input = z.object({ branding: emailBranding, kind: z.enum(["login", "invitation", "alert"]) }).strict();

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		await requirePermission(pool, actor, await notificationInstance(pool), "settings.manage");
		const data = await readJson(request, input);

		return renderEmailMessage(sampleNotification(data.kind, config.publicUrl), data.branding);
	});
}
