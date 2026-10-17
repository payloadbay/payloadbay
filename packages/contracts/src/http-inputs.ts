import { z } from "zod";
import { scopeSchema, grantInput } from "./resources.ts";
import { codeScope } from "./code.ts";
import { emailBranding } from "./notification-channels.ts";

export const bootstrapInput = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("request-code"),
			secret: z.string().min(1).max(512),
			email: z.email().max(254),
			name: z.string().trim().min(1).max(100),
		})
		.strict(),
	z.object({ action: z.literal("complete"), secret: z.string().min(1).max(512) }).strict(),
]);

export const emailPreviewInput = z.object({ branding: emailBranding, kind: z.enum(["login", "invitation", "alert"]) }).strict();

export const draftInput = z.object({ body: z.string().max(131072), sharedBindings: z.record(z.string(), z.uuid()).optional(), secretBindings: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,99}$/), z.uuid()).optional() }).strict();

export const publicationInput = z.object({ expectedVersion: z.number().int().positive(), draftVersions: z.object({ ingress: z.number().int().positive(), processing: z.number().int().positive() }).strict() }).strict();

export const activationInput = z.object({ publicationId: z.uuid(), expectedVersion: z.number().int().positive() }).strict();

export const eventReplayInput = z.object({ publicationPolicy: z.enum(["original", "current", "selected"]).optional(), sourceExecutionId: z.uuid().optional(), publicationId: z.uuid().optional() }).strict();

export const bulkReplayInput = z.object({ eventIds: z.array(z.uuid()).min(1).max(1000), publicationPolicy: z.enum(["original", "current", "selected"]), publicationId: z.uuid().optional() }).strict();

export const invitationInput = z
	.object({
		scope: scopeSchema,
		email: z.email().max(254),
		grants: z
			.array(grantInput.omit({ userId: true }))
			.min(1)
			.max(32),
	})
	.strict();

export const onboardingInput = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/) }).strict();

export const endpointInput = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/), priority: z.union([z.literal(0), z.literal(50)]).optional() }).strict();

export const secretInput = z.object({ scope: scopeSchema, name: z.string().min(1).max(100), value: z.string().min(1).max(8192) }).strict();

export const helperImportInput = z.object({ scope: codeScope, body: z.string().max(131072), exports: z.array(z.string().max(100)).min(1).max(100) }).strict();

export const invitationAcceptInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export const tokenRevokeInput = z.object({ scope: scopeSchema, id: z.uuid() }).strict();

export const emptyCommandInput = z.object({}).strict();
