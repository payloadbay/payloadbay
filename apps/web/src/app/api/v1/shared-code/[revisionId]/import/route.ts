import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { codeScope } from "@contracts/code";
import { prepareHelperImport } from "@domain/shared-code";

const input = z.object({ scope: codeScope, body: z.string().max(131072), exports: z.array(z.string().max(100)).min(1).max(100) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ revisionId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => prepareHelperImport(pool, actor, { ...(await readJson(request, input)), revisionId: uuid((await params).revisionId) }));
}
