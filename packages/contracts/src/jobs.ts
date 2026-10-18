import { z } from "zod";

export const jobAdministrationSchema = z.object({
	acknowledgmentLatency: z.null(),
	series: z.array(z.object({ hour: z.iso.datetime(), succeeded: z.number().int().nonnegative(), failed: z.number().int().nonnegative() })),
	backlog: z.array(
		z.object({
			priority: z.number().int(),
			dueCount: z.number().int().nonnegative(),
			oldestQueuedSeconds: z.number().int().nonnegative(),
			oldestDueSeconds: z.number().int().nonnegative(),
		}),
	),
	items: z.array(
		z.object({
			id: z.uuid(),
			kind: z.string(),
			state: z.enum(["queued", "running", "succeeded", "failed", "expired"]),
			attemptNumber: z.number().int().nonnegative(),
			maxAttempts: z.number().int().positive(),
			createdAt: z.iso.datetime(),
			dueAt: z.iso.datetime(),
		}),
	),
});

export type JobAdministration = z.infer<typeof jobAdministrationSchema>;
