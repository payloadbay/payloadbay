import { z } from "zod";
import { channelKey } from "./notification-channels.ts";

export const notificationSubscriptionInput = z.object({ enabled: z.boolean(), channel: channelKey.default("smtp"), revisionId: z.uuid().optional() }).strict();

export const notificationRuleOutput = z
	.object({
		id: z.uuid(),
		projectId: z.uuid().nullable(),
		workspaceId: z.uuid().nullable().default(null),
		endpointId: z.uuid().nullable(),
		destinationId: z.uuid().nullable(),
		enabled: z.boolean(),
		signal: z.enum(["failed_operation", "terminal_execution"]),
		count: z.number().int().positive(),
		windowSeconds: z.number().int().positive(),
		severity: z.enum(["info", "warning", "critical"]),
		recoveryPolicy: z.enum(["manual", "window"]),
		cooldownSeconds: z.number().int().nonnegative(),
		version: z.number().int().positive(),
	})
	.strict();

export const notificationPreferenceOutput = notificationRuleOutput.extend({ smtpEnabled: z.boolean(), channels: z.array(channelKey).max(100).default([]), channelVersions: z.record(z.string(), z.number().int().positive()).default({}) });

export const notificationRuleInput = z
	.object({
		endpointId: z.uuid().nullable().optional(),
		destinationId: z.uuid().nullable().optional(),
		enabled: z.boolean().default(false),
		signal: z.literal("failed_operation").default("failed_operation"),
		count: z.number().int().min(1).max(1000000),
		windowSeconds: z.number().int().min(1).max(2678400),
		severity: z.enum(["info", "warning", "critical"]).default("warning"),
		recoveryPolicy: z.enum(["manual", "window"]).default("manual"),
		cooldownSeconds: z.number().int().min(0).max(86400).default(0),
	})
	.strict();

export const notificationRuleUpdateInput = notificationRuleInput
	.omit({
		enabled: true,
		signal: true,
		severity: true,
		recoveryPolicy: true,
		cooldownSeconds: true,
	})
	.partial()
	.extend({
		enabled: z.boolean().optional(),
		signal: z.literal("failed_operation").optional(),
		severity: z.enum(["info", "warning", "critical"]).optional(),
		recoveryPolicy: z.enum(["manual", "window"]).optional(),
		cooldownSeconds: z.number().int().min(0).max(86400).optional(),
	})
	.strict();

export const snoozeNotificationInput = z.object({ minutes: z.union([z.literal(15), z.literal(60), z.literal(1440)]) }).strict();
