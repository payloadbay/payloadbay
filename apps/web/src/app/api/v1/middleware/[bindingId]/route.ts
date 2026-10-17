import { protectedRoute } from "@api/protected";
import { uuid, version } from "@api/parameters";
import { readJson } from "@api/handler";
import { middlewareUpdateInput } from "@contracts/code";
import { getMiddlewareBinding, updateMiddlewareBinding } from "@domain/middleware";
import { compileSource } from "@domain/executor-client";

export async function GET(request: Request, { params }: { params: Promise<{ bindingId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => getMiddlewareBinding(pool, actor, uuid((await params).bindingId)));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ bindingId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) =>
		updateMiddlewareBinding(pool, actor, {
			id: uuid((await params).bindingId),
			expectedVersion: version(request),
			...(await readJson(request, middlewareUpdateInput)),
			compile: (input) => compileSource(config, input),
		}),
	);
}
