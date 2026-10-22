import { tokenRevokeInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { tokenInput, scopeSchema } from "@contracts/resources";
import { createToken, listTokens, revokeToken, createPersonalToken, listPersonalTokens, revokePersonalToken } from "@domain/tokens";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, ({ pool }, actor) => {
		const q = new URL(request.url).searchParams;
		if (q.get("scopeType") === "personal") return listPersonalTokens(pool, actor);
		const scope = scopeSchema.safeParse({ type: q.get("scopeType"), id: q.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_input", 400, "Choose a valid token scope");

		return listTokens(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const body = await readJson(request, tokenInput);

		if (body.scope.type === "personal") return createPersonalToken(pool, actor, { name: body.name, permissions: body.permissions, expiresAt: new Date(body.expiresAt) });
		if (body.scope.type === "instance") throw new AppError("invalid_input", 400, "Use a personal key for your account or create a key inside a customer resource");

		return createToken(pool, actor, { ...body, scope: body.scope, expiresAt: new Date(body.expiresAt) });
	});
}

export async function DELETE(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const body = await readJson(request, tokenRevokeInput);
		if (body.scope.type === "personal") await revokePersonalToken(pool, actor, body.id);
		else await revokeToken(pool, actor, body.scope, body.id);

		return new Response(null, { status: 204 });
	});
}
