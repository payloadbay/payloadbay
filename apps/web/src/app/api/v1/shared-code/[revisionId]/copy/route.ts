import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { readJson } from "@api/handler";
import { sharedCopyInput } from "@contracts/code";
import { copySharedVersion } from "@domain/shared-code";
import { compileSource } from "@domain/executor-client";

export async function POST(request: Request, { params }: { params: Promise<{ revisionId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => copySharedVersion(pool, actor, { id: uuid((await params).revisionId), ...(await readJson(request, sharedCopyInput)), compile: (input) => compileSource(config, input) }));
}
