import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { middlewareScope, middlewareBindingInput } from "@contracts/code";
import { AppError } from "@contracts/errors";
import { listMiddlewareBindings, createMiddlewareBinding } from "@domain/middleware";
import { compileSource } from "@domain/executor-client";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const scope = middlewareScope.safeParse({ type: query.get("scopeType"), id: query.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_scope", 400, "Choose a middleware scope");

		return listMiddlewareBindings(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => createMiddlewareBinding(pool, actor, { ...(await readJson(request, middlewareBindingInput)), compile: (input) => compileSource(config, input) }));
}
