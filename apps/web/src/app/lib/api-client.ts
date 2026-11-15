import type { CompilationDiagnostic } from "@contracts/compilation";
import { errorEnvelope } from "@contracts/api";

export class ApiFailure extends Error {
	constructor(
		public readonly code: string,
		public readonly status: number,
		message: string,
		public readonly correlationId?: string,
		public readonly diagnostics?: CompilationDiagnostic[],
	) {
		super(message);
	}
}

export async function api<T>(
	path: string,
	options: {
		method?: string;
		json?: unknown;
		version?: number;
		idempotencyKey?: string;
	} = {},
): Promise<T> {
	if (!path.startsWith("/") || path.startsWith("//")) throw Error("API path must be installation-relative");
	const headers: Record<string, string> = { "x-payloadbay-csrf": "1" };
	if (options.json !== undefined) headers["content-type"] = "application/json";
	if (options.idempotencyKey !== undefined) headers["idempotency-key"] = options.idempotencyKey;
	if (options.version !== undefined) headers["if-match"] = '"' + options.version + '"';
	const response = await fetch("/api/v1" + path, {
		method: options.method ?? "GET",
		credentials: "same-origin",
		headers,
		body: options.json === undefined ? undefined : JSON.stringify(options.json),
	});
	if (!response.ok) {
		const parsed = errorEnvelope.safeParse(await response.json().catch(() => null));
		throw new ApiFailure(parsed.success ? parsed.data.error.code : "request_failed", response.status, parsed.success ? parsed.data.error.message : "Request failed", parsed.success ? parsed.data.error.correlationId : undefined, parsed.success ? parsed.data.error.diagnostics : undefined);
	}

	if (response.status === 204) return undefined as T;

	return response.json() as Promise<T>;
}
