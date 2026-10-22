import { getConfiguredServices } from "@lib/server";
import { authenticateRequest } from "@domain/principal";
import { handle } from "@api/handler";
import { AppError, publicError } from "@contracts/errors";
import type { Principal } from "@domain/request-types";

export async function protectedRoute(request: Request, run: (services: Awaited<ReturnType<typeof getConfiguredServices>>, actor: Principal) => Promise<unknown>) {
	try {
		const services = await getConfiguredServices();

		const headers = new Headers();
		const response = await handle(request, { origin: new URL(services.config.publicUrl).origin, authenticate: (r) => authenticateRequest(services.pool, services.identity, r, headers) }, ({ actor }) => run(services, actor));
		for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);

		return response;
	} catch (error) {
		return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500, headers: { "cache-control": "no-store" } });
	}
}
