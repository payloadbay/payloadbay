import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid, version } from "@api/parameters";
import { destinationInput } from "@contracts/destinations";
import { getDestination, updateDestination, deleteDestination } from "@domain/destinations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => getDestination(pool, actor, uuid((await params).destinationId)));
}

export async function PUT(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const id = uuid((await params).destinationId);
		const existing = await getDestination(pool, actor, id);

		return updateDestination(pool, actor, {
			id,
			projectId: existing.projectId,
			...(await readJson(request, destinationInput)),
			expectedVersion: version(request),
		});
	});
}

export async function DELETE(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => deleteDestination(pool, actor, uuid((await params).destinationId), version(request)));
}
