import { z } from "zod";

export const codeScope = z.object({ type: z.enum(["instance", "workspace", "project"]), id: z.uuid() }).strict();

export const middlewareScope = z.object({ type: z.enum(["instance", "workspace", "project", "endpoint"]), id: z.uuid() }).strict();
const bindings = z.record(z.string(), z.uuid()).refine((value) => Object.keys(value).length <= 32);

export const sharedVersionInput = z
	.object({
		scope: codeScope,
		name: z.string().min(1).max(100),
		source: z.string().min(1).max(131072),
		originRevisionId: z.uuid().optional(),
	})
	.strict();

export const sharedCopyInput = z.object({ scope: codeScope, name: z.string().min(1).max(100).optional() }).strict();

export const middlewareBindingInput = z
	.object({
		scope: middlewareScope,
		stage: z.enum(["ingress", "processing"]),
		name: z.string().min(1).max(100),
		body: z.string().max(131072),
		position: z.number().int().min(0).max(10000),
		failurePolicy: z.enum(["required", "optional"]),
		overridePolicy: z.enum(["allowed", "forbidden"]),
		requiredAction: z.enum(["retry", "fail"]).default("retry"),
		originBindingId: z.uuid().optional(),
		sharedBindings: bindings.default({}),
		secretBindings: bindings.default({}),
	})
	.strict();

export const middlewareUpdateInput = middlewareBindingInput
	.omit({
		scope: true,
		stage: true,
		originBindingId: true,
		sharedBindings: true,
		secretBindings: true,
		requiredAction: true,
	})
	.partial()
	.extend({
		requiredAction: z.enum(["retry", "fail"]).optional(),
		sharedBindings: bindings.optional(),
		secretBindings: bindings.optional(),
		enabled: z.boolean().optional(),
	})
	.strict();

export const middlewareOrderInput = z
	.object({
		scope: middlewareScope,
		stage: z.enum(["ingress", "processing"]),
		items: z
			.array(z.object({ id: z.uuid(), version: z.number().int().positive() }).strict())
			.min(1)
			.max(200),
	})
	.strict();
