import { requestContext } from "@domain/request-context";
import type { RequestContextOptions, Principal } from "@domain/request-types";
import { AppError, publicError } from "@contracts/errors";

export async function handle(request: Request, options: RequestContextOptions, command: (context: { actor: Principal; correlationId: string }) => Promise<unknown>): Promise<Response> {
	let correlationId: string = crypto.randomUUID();
	try {
		const context = await requestContext(request, options);
		correlationId = context.correlationId;
		const result = await command(context);
		if (result instanceof Response) return result;

		return Response.json(result, { headers: { "x-correlation-id": correlationId, "cache-control": "no-store" } });
	} catch (error) {
		return Response.json(publicError(error, correlationId), { status: error instanceof AppError ? error.status : 500, headers: { "x-correlation-id": correlationId, "cache-control": "no-store" } });
	}
}

type PublicSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } };

export async function readJson<T>(request: Request, schema: PublicSchema<T>, limit = 1048576): Promise<T> {
	if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new AppError("unsupported_media_type", 415, "JSON content type is required");
	const reader = request.body?.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	if (reader)
		try {
			while (true) {
				const piece = await reader.read();
				if (piece.done) break;
				length += piece.value.byteLength;
				if (length > limit) throw new AppError("body_too_large", 413, "Request body is too large");
				chunks.push(piece.value);
			}
		} finally {
			await reader.cancel().catch(() => {});
			reader.releaseLock();
		}

	const combined = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}

	let value: unknown;
	try {
		value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined));
	} catch {
		throw new AppError("invalid_json", 400, "Request body must contain valid JSON");
	}

	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new AppError("invalid_input", 400, "Check the submitted values");

	return parsed.data;
}
