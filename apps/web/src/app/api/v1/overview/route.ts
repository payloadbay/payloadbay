import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { dashboardOverview } from "@domain/overview";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => dashboardOverview(pool, actor, new URL(request.url).searchParams.has("endpointId") ? uuid(new URL(request.url).searchParams.get("endpointId")!) : undefined));
}
