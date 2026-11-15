import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { codeScope, sharedVersionInput } from "@contracts/code";
import { AppError } from "@contracts/errors";
import { listSharedVersions, createSharedVersion } from "@domain/shared-code";
import { compileSource } from "@domain/executor-client";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const scope = codeScope.safeParse({ type: query.get("scopeType"), id: query.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_scope", 400, "Choose a code scope");

		return listSharedVersions(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => createSharedVersion(pool, actor, { ...(await readJson(request, sharedVersionInput)), compile: (input) => compileSource(config, input) }));
}
