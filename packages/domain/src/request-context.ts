import { AppError } from "../../contracts/src/errors.ts";
import type { Principal, RequestContextOptions } from "./request-types.ts";

export async function requestContext(request: Request, options: RequestContextOptions): Promise<{ actor: Principal; correlationId: string }> {
	const actor = await options.authenticate(request);
	if (!actor || !actor.active) throw new AppError("unauthenticated", 401, "Authentication required");
	if (actor?.transport === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && request.headers.get("origin") !== options.origin) throw new AppError("invalid_origin", 403, "Request origin is not allowed");
	if (actor?.transport === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && request.headers.get("x-payloadbay-csrf") !== "1") throw new AppError("csrf_required", 403, "Request protection is required");

	return { actor, correlationId: crypto.randomUUID() };
}

export function expectedVersion(actual: number, expected: number): void {
	if (actual !== expected) throw new AppError("version_conflict", 409, "This resource changed; reload before saving");
}
