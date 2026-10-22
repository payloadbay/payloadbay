import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { notificationChannelUpdate } from "@contracts/notification-channels";
import { getNotificationChannel, updateNotificationChannel } from "@domain/notification-channels";

type Context = { params: Promise<{ channelId: string }> };

export async function GET(request: Request, { params }: Context) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const value = (await params).channelId;
		const key = value === "smtp" ? value : uuid(value);
		const revision = new URL(request.url).searchParams.get("revisionId");

		return getNotificationChannel(pool, actor, key, revision ? uuid(revision) : undefined);
	});
}

export async function PATCH(request: Request, { params }: Context) {
	return protectedRoute(request, async ({ pool }, actor) => updateNotificationChannel(pool, actor, uuid((await params).channelId), await readJson(request, notificationChannelUpdate)));
}
