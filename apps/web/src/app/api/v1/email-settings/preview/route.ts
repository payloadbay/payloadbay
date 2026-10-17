import { emailPreviewInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { notificationInstance } from "@domain/notification-channels";
import { requirePermission } from "@domain/membership";
import { renderEmailMessage } from "@domain/email-renderer";
import { sampleNotification } from "@domain/notification-testing";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		await requirePermission(pool, actor, await notificationInstance(pool), "settings.manage");
		const data = await readJson(request, emailPreviewInput);

		return renderEmailMessage(sampleNotification(data.kind, config.publicUrl), data.branding);
	});
}
