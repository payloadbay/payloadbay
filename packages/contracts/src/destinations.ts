import { z } from "zod";

export const destinationInput = z
	.object({
		name: z.string().trim().min(1).max(100),
		url: z.url().max(2048),
		method: z
			.string()
			.regex(/^[A-Z]+$/)
			.max(16)
			.optional(),
		headers: z.record(z.string().max(100), z.string().max(8192)).optional(),
		secretRefs: z
			.array(z.object({ header: z.string().min(1).max(100), secretVersionId: z.uuid() }).strict())
			.max(32)
			.optional(),
		concurrency: z.number().int().min(1).max(64).optional(),
		isDefault: z.boolean().optional(),
	})
	.strict();
