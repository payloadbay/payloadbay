import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { createRunnerCredential, revokeRunnerCredential } from "@domain/runner";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => createRunnerCredential(pool, actor, uuid((await params).destinationId)));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => revokeRunnerCredential(pool, actor, uuid((await params).destinationId)));
}
