import { endpointInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { listEndpoints, createEndpoint } from "@domain/endpoints";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => listEndpoints(pool, actor, uuid((await params).projectId)));
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => createEndpoint(pool, actor, { ...(await readJson(request, endpointInput)), projectId: uuid((await params).projectId) }));
}
