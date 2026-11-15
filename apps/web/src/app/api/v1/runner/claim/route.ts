import { runnerRoute } from "@api/runner";
import { claimRunnerDelivery } from "@domain/runner";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	return runnerRoute(request, async ({ pool, config }, token) => {
		const delivery = await claimRunnerDelivery(pool, token, config.encryptionKey);

		return delivery ? Response.json(delivery) : new Response(null, { status: 204 });
	});
}
