import { invitationInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { scopeSchema } from "@contracts/resources";
import { AppError } from "@contracts/errors";
import { createInvitation, listInvitations } from "@domain/invitations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const scope = scopeSchema.safeParse({ type: query.get("scopeType"), id: query.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_scope", 400, "Choose a member scope");

		return listInvitations(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, identity, config }, actor) => createInvitation(pool, actor, await readJson(request, invitationInput), identity, config.encryptionKey, config.publicUrl));
}
