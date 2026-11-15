import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { emailSettingsInput } from "@contracts/notification-channels";
import { getEmailSettings, saveEmailSettings } from "@domain/email-settings";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => getEmailSettings(pool, actor, config.publicUrl));
}

export async function PUT(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => saveEmailSettings(pool, actor, await readJson(request, emailSettingsInput)));
}
