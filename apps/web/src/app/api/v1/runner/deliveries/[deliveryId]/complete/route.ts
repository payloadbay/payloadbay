import { runnerRoute } from "@api/runner";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { runnerCompletion } from "@contracts/runner";
import { completeRunnerDelivery } from "@domain/runner";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
	return runnerRoute(request, async ({ pool }, token) => {
		const input = await readJson(request, runnerCompletion, 100000);
		await completeRunnerDelivery(pool, token, uuid((await params).deliveryId), input.leaseToken, input.result);

		return new Response(null, { status: 204 });
	});
}
