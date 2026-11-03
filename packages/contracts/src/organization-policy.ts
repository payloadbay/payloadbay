import { z } from "zod";

export const admissionLimit = z
	.object({ limit: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), from: z.iso.datetime(), to: z.iso.datetime() })
	.strict()
	.refine((value) => Date.parse(value.from) < Date.parse(value.to), "Window end must follow its start");

export const organizationLimits = z.object({ workspaces: z.number().int().min(0).max(1000000).nullable(), projects: z.number().int().min(0).max(1000000).nullable(), admission: admissionLimit.nullable() }).strict();

export type OrganizationLimits = z.infer<typeof organizationLimits>;

export type OrganizationPolicy = {
	organizationId: string;
	deploymentMode: "self_hosted" | "hosted";
	version: number;
	limits: OrganizationLimits;
	processingConcurrency: number;
};

export const organizationPolicyInput = z
	.object({
		organizationId: z.uuid(),
		expectedVersion: z.number().int().min(0),
		limits: organizationLimits,
		processingConcurrency: z.number().int().min(0).max(128),
	})
	.strict();

export const organizationSecurityInput = z.object({ version: z.number().int().min(0), requirePasskey: z.boolean() }).strict();
