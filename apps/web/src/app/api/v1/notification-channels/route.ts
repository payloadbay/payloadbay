import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { notificationChannelInput } from "@contracts/notification-channels";
import { listNotificationChannels, publishNotificationChannel } from "@domain/notification-channels";
import { compileSource } from "@domain/executor-client";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => listNotificationChannels(pool, actor));
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => publishNotificationChannel(pool, actor, { ...(await readJson(request, notificationChannelInput)), compile: (input) => compileSource(config, input) }));
}
