import { z } from "zod";
import { oauthClients, oauthClient, oauthProvider } from "./oauth.ts";
import { executorCompatibility } from "./compatibility.ts";

export const installationSettingsSchema = z.object({
	smtpConfigured: z.boolean(),
	oauthProviders: z.array(z.string()),
	executorMode: z.enum(["runc", "runsc"]),
	limits: z.object({ body: z.number().int().positive(), headers: z.number().int().positive() }),
	registrationPolicy: z.enum(["invite_only", "organization"]),
	eventRetentionDays: z.number().int().min(0).max(36500),
	deadlines: z.object({ ingressMs: z.number().int().positive(), processingMs: z.number().int().positive(), httpMs: z.number().int().positive() }),
});

export const executorHealthSchema = z.object({
	protocolVersion: z.literal(executorCompatibility.protocolVersion),
	sdkVersion: z.literal(executorCompatibility.sdkVersion),
	compatibilityDate: z.literal(executorCompatibility.compatibilityDate),
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
	worker: z.enum(["recent", "not_seen"]),
	smtp: z.enum(["ready", "unavailable"]),
});

export type InstallationSettings = z.infer<typeof installationSettingsSchema>;

export type InstallationHealth = z.infer<typeof installationHealthSchema>;

/** Operator-editable policy, bounded by executor and transport safety ceilings. */
export const installationPolicyInput = z
	.object({
		bodyLimit: z.number().int().min(1).max(1048576),
		headerLimit: z.number().int().min(1).max(16384),
		ingressDeadlineMs: z.number().int().min(100).max(10000),
		processingDeadlineMs: z.number().int().min(100).max(60000),
		httpTimeoutMs: z.number().int().min(100).max(30000),
		maxAttempts: z.number().int().min(1).max(20),
		otpRequestLimit: z.number().int().min(1).max(100),
		registrationPolicy: z.enum(["invite_only", "organization"]),
		eventRetentionDays: z.number().int().min(0).max(36500),
	})
	.strict();

export const installationPolicySettings = installationPolicyInput.extend({
	bodyLimit: installationPolicyInput.shape.bodyLimit.default(1048576),
	headerLimit: installationPolicyInput.shape.headerLimit.default(16384),
	ingressDeadlineMs: installationPolicyInput.shape.ingressDeadlineMs.default(2000),
	processingDeadlineMs: installationPolicyInput.shape.processingDeadlineMs.default(30000),
	httpTimeoutMs: installationPolicyInput.shape.httpTimeoutMs.default(10000),
	maxAttempts: installationPolicyInput.shape.maxAttempts.default(5),
	otpRequestLimit: installationPolicyInput.shape.otpRequestLimit.default(5),
	registrationPolicy: installationPolicyInput.shape.registrationPolicy.default("invite_only"),
	eventRetentionDays: installationPolicyInput.shape.eventRetentionDays.default(0),
});

export type InstallationPolicy = z.infer<typeof installationPolicySettings>;

export const editableInstallationSettings = installationPolicySettings.extend({ oauth: oauthClients.default({}) });

export const installationUpdateInput = z
	.object({
		version: z.number().int().min(0),
		settings: installationPolicyInput
			.extend({ oauth: oauthClients })
			.partial()
			.refine((value) => Object.keys(value).length > 0, "Choose settings to update"),
	})
	.strict();

export type EditableInstallationSettings = z.infer<typeof editableInstallationSettings>;

export const installationConfigurationView = z.object({ version: z.number().int().min(0), settings: installationPolicySettings.extend({ oauth: z.partialRecord(oauthProvider, oauthClient.omit({ clientSecret: true }).extend({ secretConfigured: z.boolean() })) }), locked: z.array(z.string()) });

export const configuredInstallationSettingsSchema = installationSettingsSchema.extend({ configuration: installationConfigurationView });

export type ConfiguredInstallationSettings = z.infer<typeof configuredInstallationSettingsSchema>;

export type InstallationConfigurationView = z.infer<typeof installationConfigurationView>;
