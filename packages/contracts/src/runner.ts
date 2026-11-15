import { z } from "zod";

export const runnerCompletion = z
	.object({
		leaseToken: z.string().regex(/^[a-f0-9]{64}$/),
		result: z.union([
			z
				.object({
					status: z.number().int().min(100).max(599),
					bodyBase64: z
						.string()
						.max(87384)
						.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
						.refine((value) => Buffer.from(value, "base64").length <= 65536),
					contentType: z.string().max(1024),
				})
				.strict(),
			z.object({ networkError: z.literal("local_delivery_failed") }).strict(),
		]),
	})
	.strict();
