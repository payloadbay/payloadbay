import { z } from "zod";

export const compiledStageSchema = z
	.object({
		stage: z.enum(["ingress", "processing", "ingress_middleware", "processing_middleware", "notification"]),
		body: z.string(),
		sourceId: z.string(),
		generated: z.string(),
		bundle: z.string().max(1048576),
		sourceMap: z.record(z.string(), z.unknown()),
		bodyLineOffset: z.number().int().min(0),
		bundleDigest: z.string().regex(/^[a-f0-9]{64}$/),
		bodyDigest: z.string().regex(/^[a-f0-9]{64}$/),
		sdkVersion: z.literal("1"),
		sharedVersions: z.record(z.string(), z.string()),
		compatibilityDate: z.literal("2026-07-01"),
		compatibilityFlags: z.array(z.string()).max(0),
	})
	.strict();

export const diagnosticSchema = z.object({
	sourceId: z.string(),
	line: z.number().int().min(1),
	column: z.number().int().min(1),
	severity: z.literal("error"),
	code: z.string(),
	message: z.string(),
});

export const executionReference = z.object({ executionId: z.uuid(), endpointId: z.uuid(), generation: z.number().int().positive() }).strict();
