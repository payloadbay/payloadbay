import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { scriptTestInput, testDraftDry } from "@domain/script-testing";
import { compileSource, executeSource } from "@domain/executor-client";
import { packWire } from "@contracts/wire";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => packWire(await testDraftDry(pool, actor, uuid((await params).endpointId), await readJson(request, scriptTestInput), { compile: (input) => compileSource(config, input, request.signal), run: (options) => executeSource(config, { ...options, signal: request.signal }) })));
}
