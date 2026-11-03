import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { middlewareOrderInput } from "@contracts/code";
import { reorderMiddlewareBindings } from "@domain/middleware";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => reorderMiddlewareBindings(pool, actor, await readJson(request, middlewareOrderInput)));
}
