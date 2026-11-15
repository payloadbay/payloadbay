import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { getSharedVersion } from "@domain/shared-code";

export async function GET(request: Request, { params }: { params: Promise<{ revisionId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => getSharedVersion(pool, actor, uuid((await params).revisionId)));
}
