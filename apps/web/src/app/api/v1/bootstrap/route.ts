import { bootstrapInput } from "@contracts/http-inputs";
import { getConfiguredServices } from "@lib/server";
import { readJson } from "@api/handler";
import { requestOwnerCode, completeOwnerSetup } from "@domain/setup";
import { AppError, publicError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
	return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500, headers: { "cache-control": "no-store" } });
}

export async function GET() {
	try {
		const { pool } = await getConfiguredServices();
		const installed = (await pool.query("SELECT bootstrap_state='complete' AS configured FROM payloadbay.installation WHERE singleton")).rows[0];

		return Response.json({ configured: Boolean(installed?.configured) }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return failure(error);
	}
}

export async function POST(request: Request) {
	try {
		const { pool, identity, config } = await getConfiguredServices();
		if (request.headers.get("origin") !== new URL(config.publicUrl).origin || request.headers.get("x-payloadbay-csrf") !== "1") throw new AppError("invalid_origin", 403, "Request protection is required");
		const body = await readJson(request, bootstrapInput, 16384);
		const result = body.action === "request-code" ? await requestOwnerCode(pool, identity, config, { secret: body.secret, email: body.email, name: body.name }) : await completeOwnerSetup(pool, identity, config, request, body.secret);

		return Response.json(result, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		return failure(error);
	}
}
