import type { Pool } from "pg";
import { receiveIngress, type IngressOptions } from "./ingress.ts";
import { AppError, publicError } from "../../contracts/src/errors.ts";

export async function ingressHttp(pool: Pool, request: Request, key: string, options: IngressOptions) {
	const correlationId = crypto.randomUUID();
	const safeHeaders = {
		"cache-control": "no-store",
		"x-content-type-options": "nosniff",
		"content-security-policy": "sandbox; default-src 'none'",
		"x-correlation-id": correlationId,
	};
	try {
		const headers = Object.fromEntries(request.headers);
		const reader = request.body?.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		if (reader)
			try {
				while (true) {
					const part = await reader.read();
					if (part.done) break;
					size += part.value.byteLength;
					if (size > (options.bodyLimit ?? 1048576)) throw new AppError("body_too_large", 413, "Request body exceeds the configured limit");
					chunks.push(part.value);
				}
			} finally {
				await reader.cancel().catch(() => {});
				reader.releaseLock();
			}

		const body = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			body.set(chunk, offset);
			offset += chunk.length;
		}

		const response = await receiveIngress(
			pool,
			{
				key,
				body,
				headers,
				method: request.method,
				url: request.url,
			},
			options,
		);
		const responseHeaders = new Headers(response.headers);
		for (const [name, value] of Object.entries(safeHeaders)) responseHeaders.set(name, value);
		const value = typeof response.body === "string" ? response.body : new Uint8Array(response.body).buffer;
		if ([204, 205, 304].includes(response.status)) {
			if ((typeof response.body === "string" ? Buffer.byteLength(response.body) : response.body.byteLength) !== 0) throw new AppError("invalid_ingress_outcome", 502, "This response status requires an empty body");

			return new Response(null, { status: response.status, headers: responseHeaders });
		}

		return new Response(value, { status: response.status, headers: responseHeaders });
	} catch (error) {
		return Response.json(publicError(error, correlationId), { status: error instanceof AppError ? error.status : 500, headers: safeHeaders });
	}
}
