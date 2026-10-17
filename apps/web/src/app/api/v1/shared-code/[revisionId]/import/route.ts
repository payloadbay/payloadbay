import { helperImportInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { prepareHelperImport } from "@domain/shared-code";

export async function POST(request: Request, { params }: { params: Promise<{ revisionId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => prepareHelperImport(pool, actor, { ...(await readJson(request, helperImportInput)), revisionId: uuid((await params).revisionId) }));
}
