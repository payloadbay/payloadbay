import { z } from "zod";

export const installationSettingsSchema = z.object({
	smtpConfigured: z.boolean(),
	oauthProviders: z.array(z.string()),
	executorMode: z.enum(["runc", "runsc"]),
	limits: z.object({ body: z.number().int().positive(), headers: z.number().int().positive() }),
	registrationPolicy: z.enum(["invite_only", "organization"]),
	deadlines: z.object({ ingressMs: z.number().int().positive(), processingMs: z.number().int().positive(), httpMs: z.number().int().positive() }),
});

export const executorHealthSchema = z.object({
	ready: z.boolean(),
	runtime: z.literal("workerd"),
	configuredMode: z.enum(["runc", "runsc"]),
	hostAttestation: z.literal(false),
});

export const installationHealthSchema = z.object({
	checkedAt: z.iso.datetime(),
	database: z.literal("available"),
	executor: z.object({
		state: z.enum(["ready", "not_ready", "unavailable"]),
		runtime: z.literal("workerd").nullable(),
		configuredMode: z.enum(["runc", "runsc"]).nullable(),
		hostAttestation: z.literal(false),
	}),
	worker: z.literal("not_checked"),
	smtp: z.literal("not_checked"),
});

export type InstallationSettings = z.infer<typeof installationSettingsSchema>;

export type InstallationHealth = z.infer<typeof installationHealthSchema>;
