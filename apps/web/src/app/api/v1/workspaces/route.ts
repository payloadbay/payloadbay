import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { resourceInput } from "@contracts/resources";
import { listResources, createResource } from "@domain/resources";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, ({ pool }, actor) => listResources(pool, actor, "workspace"));
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => createResource(pool, actor, { ...(await readJson(request, resourceInput)), type: "workspace" }));
}
