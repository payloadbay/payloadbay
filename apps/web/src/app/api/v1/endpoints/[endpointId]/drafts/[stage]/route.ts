import { draftInput } from "@contracts/http-inputs";
import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid, version } from "@api/parameters";
import { getDraft } from "@domain/endpoints";
import { saveDraft } from "@domain/publication";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

async function target(params: Promise<{ endpointId: string; stage: string }>) {
	const p = await params;
	const stage = z.enum(["ingress", "processing"]).safeParse(p.stage);
	if (!stage.success) throw new AppError("invalid_input", 400, "Choose Ingress or Processing");

	return { endpointId: uuid(p.endpointId), stage: stage.data };
}

export async function GET(request: Request, { params }: { params: Promise<{ endpointId: string; stage: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const p = await target(params);

		return getDraft(pool, actor, p.endpointId, p.stage);
	});
}

export async function PATCH(request: Request, { params }: { params: Promise<{ endpointId: string; stage: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => saveDraft(pool, actor, { ...(await target(params)), ...(await readJson(request, draftInput)), expectedVersion: version(request) }));
}
