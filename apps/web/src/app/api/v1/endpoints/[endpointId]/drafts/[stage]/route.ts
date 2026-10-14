import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid, version } from "@api/parameters";
import { getDraft } from "@domain/endpoints";
import { saveDraft } from "@domain/publication";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z.object({ body: z.string().max(131072), sharedBindings: z.record(z.string(), z.uuid()).optional(), secretBindings: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,99}$/), z.uuid()).optional() }).strict();

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
	return protectedRoute(request, async ({ pool }, actor) => saveDraft(pool, actor, { ...(await target(params)), ...(await readJson(request, input)), expectedVersion: version(request) }));
}
