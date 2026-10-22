import { z } from "zod";

const httpUrl = z
	.url()
	.max(2048)
	.refine((value) => {
		const url = new URL(value);

		return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
	}, "Use an HTTP or HTTPS URL without embedded credentials");

export const emailContent = z
	.object({
		subject: z
			.string()
			.min(1)
			.max(200)
			.refine((value) => !/[\r\n]/.test(value)),
		title: z.string().min(1).max(200),
		preview: z.string().max(300).optional(),
		paragraphs: z.array(z.string().max(8192)).max(20).default([]),
		code: z.string().max(100).optional(),
		action: z
			.object({ label: z.string().min(1).max(100), url: httpUrl })
			.strict()
			.optional(),
		html: z.string().max(131072).optional(),
		text: z.string().max(65536).optional(),
	})
	.strict();

export const emailBranding = z
	.object({
		name: z.string().min(1).max(80).default("Payload Bay"),
		accent: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.default("#156FDE"),
		footer: z.string().max(500).default("Sent by your Payload Bay installation."),
		logoUrl: httpUrl.nullable().default(null),
	})
	.strict();

export const channelKey = z.union([z.literal("smtp"), z.uuid()]).transform((value) => value.toLowerCase());
const bindings = z.record(z.string().regex(/^[A-Za-z_$][\w$]{0,99}$/), z.uuid()).refine((value) => Object.keys(value).length <= 32);

export const notificationChannelInput = z
	.object({
		id: z.uuid().optional(),
		expectedVersion: z.number().int().positive().optional(),
		name: z.string().trim().min(1).max(100),
		kind: z.enum(["email", "webhook"]),
		source: z.string().min(1).max(131072),
		originKey: channelKey.optional(),
		sharedBindings: bindings.default({}),
		secretBindings: bindings.default({}),
	})
	.strict();

export const notificationChannelUpdate = z
	.object({
		expectedVersion: z.number().int().positive(),
		enabled: z.boolean().optional(),
		activeRevisionId: z.uuid().optional(),
	})
	.strict();

export const emailSettingsInput = z
	.object({
		expectedVersion: z.number().int().nonnegative(),
		channelKey: z.literal("smtp").default("smtp"),
		branding: emailBranding,
	})
	.strict();

export type EmailContent = z.infer<typeof emailContent>;

export type EmailBranding = z.infer<typeof emailBranding>;

export const notificationChannelPreview = notificationChannelInput.omit({ id: true, expectedVersion: true, originKey: true }).extend({ branding: emailBranding });
