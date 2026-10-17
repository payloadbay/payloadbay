import { protectedRoute } from "@api/protected";
import { dashboardOverview } from "@domain/overview";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => dashboardOverview(pool, actor));
}
