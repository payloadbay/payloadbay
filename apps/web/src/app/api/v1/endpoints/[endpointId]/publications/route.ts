import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { endpointFor } from "@domain/endpoints";
import { publish, activatePublication } from "@domain/publication";
import { compileSource } from "@domain/executor-client";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const publishInput = z.object({ expectedVersion: z.number().int().positive(), draftVersions: z.object({ ingress: z.number().int().positive(), processing: z.number().int().positive() }).strict() }).strict();
const rollbackInput = z.object({ publicationId: z.uuid(), expectedVersion: z.number().int().positive() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => publish(pool, actor, { ...(await readJson(request, publishInput)), endpointId: uuid((await params).endpointId), compile: (input) => compileSource(config, input, request.signal) }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => activatePublication(pool, actor, { ...(await readJson(request, rollbackInput)), endpointId: uuid((await params).endpointId) }));
}

export async function GET(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const endpointId = uuid((await params).endpointId);
		await endpointFor(pool, actor, endpointId, "code.read");
		const id = new URL(request.url).searchParams.get("id");
		if (!id) return (await pool.query("SELECT id,created_at,dependency_digest,created_by FROM payloadbay.publication WHERE endpoint_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200", [endpointId])).rows;
		const rows = (await pool.query("SELECT p.id,p.shared_versions,i.body AS ingress_body,i.bundle AS ingress_bundle,s.body AS processing_body,s.bundle AS processing_bundle FROM payloadbay.publication p JOIN payloadbay.stage_revision i ON i.id=p.ingress_revision_id JOIN payloadbay.stage_revision s ON s.id=p.processing_revision_id WHERE p.id=$1 AND p.endpoint_id=$2", [uuid(id), endpointId])).rows;
		if (!rows.length) throw new AppError("not_found", 404, "Publication unavailable");

		return rows[0];
	});
}
