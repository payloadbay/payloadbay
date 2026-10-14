import { z } from "zod";
import { getServices } from "@lib/server";
import { readJson } from "@api/handler";
import { requestOwnerCode, completeOwnerSetup } from "@domain/setup";
import { AppError, publicError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("request-code"),
			secret: z.string().min(1).max(512),
			email: z.email().max(254),
			name: z.string().trim().min(1).max(100),
		})
		.strict(),
	z.object({ action: z.literal("complete"), secret: z.string().min(1).max(512) }).strict(),
]);

function failure(error: unknown) {
	return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500, headers: { "cache-control": "no-store" } });
}

export async function GET() {
	try {
		const { pool } = getServices();
		const installed = (await pool.query("SELECT bootstrap_state='complete' AS configured FROM payloadbay.installation WHERE singleton")).rows[0];

		return Response.json({ configured: Boolean(installed?.configured) }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return failure(error);
	}
}

export async function POST(request: Request) {
	try {
		const { pool, identity, config } = getServices();
		if (request.headers.get("origin") !== new URL(config.publicUrl).origin || request.headers.get("x-payloadbay-csrf") !== "1") throw new AppError("invalid_origin", 403, "Request protection is required");
		const body = await readJson(request, input, 16384);
		const result = body.action === "request-code" ? await requestOwnerCode(pool, identity, config, { secret: body.secret, email: body.email, name: body.name }) : await completeOwnerSetup(pool, identity, config, request, body.secret);

		return Response.json(result, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return failure(error);
	}
}
