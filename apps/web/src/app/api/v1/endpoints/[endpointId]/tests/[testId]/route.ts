import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { savedScriptTestInput } from "@contracts/script-test";
import { saveScriptTest, deleteScriptTest } from "@domain/saved-script-tests";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ endpointId: string; testId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const ids = await params;

		return saveScriptTest(pool, actor, uuid(ids.endpointId), uuid(ids.testId), await readJson(request, savedScriptTestInput), config.encryptionKey);
	});
}

export async function DELETE(request: Request, { params }: { params: Promise<{ endpointId: string; testId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const ids = await params;

		return deleteScriptTest(pool, actor, uuid(ids.endpointId), uuid(ids.testId));
	});
}
