import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { readOrganizationUsage } from "@domain/usage";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;

		return readOrganizationUsage(pool, actor, uuid((await params).organizationId), { from: query.get("from") ?? "", to: query.get("to") ?? "" });
	});
}
