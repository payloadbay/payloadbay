import { emptyCommandInput } from "@contracts/http-inputs";
import { protectedRoute } from "@lib/api/protected";
import { readJson } from "@lib/api/handler";
import { uuid, version } from "@lib/api/parameters";
import { setEndpointPaused } from "@domain/endpoints";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		await readJson(request, emptyCommandInput);

		return setEndpointPaused(pool, actor, { id: uuid((await params).endpointId), expectedVersion: version(request), paused: false });
	});
}
