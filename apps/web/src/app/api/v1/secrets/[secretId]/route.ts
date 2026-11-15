import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { revokeSecret } from "@domain/secrets";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ secretId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		await revokeSecret(pool, actor, uuid((await params).secretId));

		return new Response(null, { status: 204 });
	});
}
