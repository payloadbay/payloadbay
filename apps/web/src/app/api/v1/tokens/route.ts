import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { tokenInput, scopeSchema } from "@contracts/resources";
import { createToken, listTokens, revokeToken } from "@domain/tokens";
import { AppError } from "@contracts/errors";
import { z } from "zod";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, ({ pool }, actor) => {
		const q = new URL(request.url).searchParams;
		const scope = scopeSchema.safeParse({ type: q.get("scopeType"), id: q.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_input", 400, "Choose a valid token scope");

		return listTokens(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const body = await readJson(request, tokenInput);

		return createToken(pool, actor, { ...body, expiresAt: new Date(body.expiresAt) });
	});
}

export async function DELETE(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const body = await readJson(request, z.object({ scope: scopeSchema, id: z.uuid() }).strict());
		await revokeToken(pool, actor, body.scope, body.id);

		return new Response(null, { status: 204 });
	});
}
