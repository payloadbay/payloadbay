import { getConfiguredServices } from "@lib/server";
import { AppError, publicError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

async function authRoute(request: Request) {
	try {
		return await (await getConfiguredServices()).identity.handler(request);
	} catch (error) {
		return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500, headers: { "cache-control": "no-store" } });
	}
}

export const GET = authRoute;

export const POST = authRoute;
