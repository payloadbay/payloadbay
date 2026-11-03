import { z } from "zod";

export const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), cursor: z.string().max(512).optional() });

export const errorEnvelope = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		correlationId: z.string(),
		diagnostics: z
			.array(
				z.object({
					sourceId: z.string(),
					line: z.number().int().min(1),
					column: z.number().int().min(1),
					severity: z.literal("error"),
					code: z.string(),
					message: z.string(),
				}),
			)
			.max(20)
			.optional(),
		fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
	}),
});
