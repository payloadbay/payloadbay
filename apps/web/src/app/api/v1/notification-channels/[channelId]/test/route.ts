import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { queueChannelTest } from "@domain/notification-testing";

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const value = (await params).channelId;

		return queueChannelTest(pool, actor, value === "smtp" ? value : uuid(value), config);
	});
}
