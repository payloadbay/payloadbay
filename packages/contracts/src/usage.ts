import { z } from "zod";

/** Operational counters, not a pricing or billable-event definition. */
export const usageMetrics = ["ingress.recorded", "ingress.accepted", "execution.created", "execution.replayed", "processing.attempt.started", "delivery.attempt.started", "execution.succeeded", "execution.failed"] as const;

export type UsageMetric = (typeof usageMetrics)[number];

export const usageFactInput = z
	.object({
		organizationId: z.uuid(),
		workspaceId: z.uuid().optional(),
		projectId: z.uuid().optional(),
		metric: z.enum(usageMetrics),
		sourceKey: z.string().min(1).max(256),
	})
	.strict();

export const usageWindowInput = z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).strict();

export type UsageReport = {
	organizationId: string;
	from: string;
	to: string;
	metrics: Record<UsageMetric, { lifetime: string; window: string }>;
};
