import { z } from "zod";
import { emailContent } from "./notification-channels.ts";

const bytes = z.custom<string | Uint8Array>((value) => typeof value === "string" || value instanceof Uint8Array);
const response = z
	.object({
		status: z.number().int().min(200).max(599),
		body: bytes,
		headers: z
			.record(
				z
					.string()
					.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)
					.refine((value) => !["set-cookie", "connection", "transfer-encoding", "content-length", "upgrade", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer"].includes(value.toLowerCase())),
				z.string().refine((value) => !/[\r\n\x00]/.test(value)),
			)
			.optional(),
	})
	.strict();
const metadata = z.record(z.string(), z.unknown()).refine((value) => {
	try {
		return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 8192;
	} catch {
		return false;
	}
});

const event = z.object({ body: bytes, contentType: z.string().min(1), metadata: metadata.optional() }).strict();

export const ingressDecision = z.discriminatedUnion("kind", [z.object({ kind: z.literal("accept"), event, response }).strict(), z.object({ kind: z.literal("reject"), response }).strict(), z.object({ kind: z.literal("respondOnly"), response }).strict()]);

export const processingDecision = z.discriminatedUnion("kind", [z.object({ kind: z.literal("complete") }).strict(), z.object({ kind: z.literal("retry"), reason: z.string().max(256), delayMs: z.number().int().min(0).max(3600000).optional() }).strict(), z.object({ kind: z.literal("fail"), reason: z.string().max(256) }).strict()]);

export const notificationDecision = z.union([z.object({ kind: z.literal("email"), message: emailContent }).strict(), processingDecision]);

const middlewareHeaders = z
	.record(
		z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
		z.string().refine((value) => !/[\r\n\x00]/.test(value)),
	)
	.refine((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16384);
const middlewareContentType = z
	.string()
	.min(1)
	.max(256)
	.refine((value) => !/[\r\n\x00]/.test(value));
const boundedPatchBody = bytes.refine((value) => (typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.byteLength) <= 1048576);

export const ingressMiddlewareDecision = z.union([
	z
		.object({
			kind: z.literal("continue"),
			patch: z
				.object({ request: z.object({ headers: middlewareHeaders.optional(), contentType: middlewareContentType.optional() }).strict().optional() })
				.strict()
				.optional(),
		})
		.strict(),
	ingressDecision,
]);

export const processingMiddlewareDecision = z.union([
	z
		.object({
			kind: z.literal("continue"),
			patch: z
				.object({ event: z.object({ body: boundedPatchBody.optional(), contentType: middlewareContentType.optional(), metadata: metadata.optional() }).strict().optional() })
				.strict()
				.optional(),
		})
		.strict(),
	processingDecision,
]);

export function validateDecision(stage: string, value: unknown) {
	const schema = stage === "ingress" ? ingressDecision : stage === "processing" ? processingDecision : stage === "ingress_middleware" ? ingressMiddlewareDecision : stage === "processing_middleware" ? processingMiddlewareDecision : stage === "notification" ? notificationDecision : undefined;
	const parsed = schema?.safeParse(value);
	if (!parsed?.success) throw Error("Invalid stage outcome");

	return parsed.data;
}
