import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { savedScriptTestInput } from "@contracts/script-test";
import { listSavedScriptTests, saveScriptTest } from "@domain/saved-script-tests";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => listSavedScriptTests(pool, actor, uuid((await params).endpointId), config.encryptionKey));
}

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => saveScriptTest(pool, actor, uuid((await params).endpointId), undefined, await readJson(request, savedScriptTestInput), config.encryptionKey));
}
