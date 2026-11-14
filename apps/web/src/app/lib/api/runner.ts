import { getConfiguredServices } from "@lib/server";
import { AppError, publicError } from "@contracts/errors";

export async function runnerRoute(request: Request, run: (services: Awaited<ReturnType<typeof getConfiguredServices>>, token: string) => Promise<Response>) {
	try {
		const match = /^Bearer (pabr_[a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "");
		if (!match) throw new AppError("unauthenticated", 401, "Runner authentication required");
		const response = await run(await getConfiguredServices(), match[1]);
		response.headers.set("cache-control", "no-store");

		return response;
	} catch (error) {
		return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500, headers: { "cache-control": "no-store" } });
	}
}
