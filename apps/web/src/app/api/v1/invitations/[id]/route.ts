import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { cancelInvitation } from "@domain/invitations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => cancelInvitation(pool, actor, uuid((await params).id)));
}
