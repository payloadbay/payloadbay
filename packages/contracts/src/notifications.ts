import { z } from "zod";
import { channelKey } from "./notification-channels.ts";

export const notificationSubscriptionInput = z.object({ enabled: z.boolean(), channel: channelKey.default("smtp") }).strict();

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

export const notificationPreferenceOutput = notificationRuleOutput.extend({ smtpEnabled: z.boolean(), channels: z.array(channelKey).max(100).default([]) });
