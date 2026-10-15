import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { scopeSchema, grantInput } from "@contracts/resources";
import { AppError } from "@contracts/errors";
import { createInvitation, listInvitations } from "@domain/invitations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z
	.object({
		scope: scopeSchema,
		email: z.email().max(254),
		grants: z
			.array(grantInput.omit({ userId: true }))
			.min(1)
			.max(32),
	})
	.strict();

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const scope = scopeSchema.safeParse({ type: query.get("scopeType"), id: query.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_scope", 400, "Choose a member scope");

		return listInvitations(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, identity, config }, actor) => createInvitation(pool, actor, await readJson(request, input), identity, config.encryptionKey, config.publicUrl));
}
