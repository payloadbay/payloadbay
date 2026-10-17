import type { ProviderResponse } from "../../script-sdk/src/lifecycle.ts";

/** Validate native HTTP representability before durable acceptance, not after commit. */
export function validateProviderResponse(response: ProviderResponse, limits: { bodyBytes: number; headerBytes: number }) {
	const body = typeof response.body === "string" ? new TextEncoder().encode(response.body) : response.body;
	if (body.byteLength > limits.bodyBytes) throw Error("response_body_limit");
	const headers = new Headers(response.headers);
	let bytes = 0;
	for (const [name, value] of headers) bytes += new TextEncoder().encode(name).byteLength + new TextEncoder().encode(value).byteLength + 4;
	if (bytes > limits.headerBytes) throw Error("response_header_limit");
	const noBody = [204, 205, 304].includes(response.status);
	if (noBody && body.byteLength !== 0) throw Error("response_status_body");
	new Response(noBody ? null : new Uint8Array(body).buffer, { status: response.status, headers });
}
