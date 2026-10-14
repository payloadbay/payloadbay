import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { listEndpoints, createEndpoint } from "@domain/endpoints";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/), priority: z.union([z.literal(0), z.literal(50)]).optional() }).strict();

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => listEndpoints(pool, actor, uuid((await params).projectId)));
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => createEndpoint(pool, actor, { ...(await readJson(request, input)), projectId: uuid((await params).projectId) }));
}
