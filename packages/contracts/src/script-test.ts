import { z } from "zod";

export const scriptTestInput = z
	.object({
		stage: z.enum(["ingress", "processing"]),
		body: z.string().max(131072),
		sharedBindings: z
			.record(z.string(), z.uuid())
			.refine((value) => Object.keys(value).length <= 32)
			.default({}),
		fixture: z
			.object({
				body: z.string().refine((value) => Buffer.byteLength(value) <= 1048576),
				contentType: z.string().min(1).max(256).default("application/json"),
				method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("POST"),
				headers: z
					.record(z.string(), z.string())
					.refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 16384)
					.default({}),
				secrets: z
					.record(z.string(), z.string())
					.refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 65536)
					.default({}),
			})
			.strict(),
	})
	.strict();
