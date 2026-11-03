import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { destinationInput } from "@contracts/destinations";
import { createDestination, listDestinations } from "@domain/destinations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => listDestinations(pool, actor, uuid((await params).projectId)));
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => createDestination(pool, actor, { projectId: uuid((await params).projectId), ...(await readJson(request, destinationInput)) }));
}
