import { z } from "zod";

export const ingressRule = z
	.object({
		id: z.uuid(),
		name: z.string().trim().min(1).max(100),
		enabled: z.boolean(),
		header: z
			.string()
			.min(1)
			.max(100)
			.regex(/^[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/)
			.transform((value) => value.toLowerCase()),
		operator: z.enum(["equals", "contains", "present", "missing"]),
		value: z.string().max(1024),
		action: z.enum(["block", "skip"]),
	})
	.strict();

export const ingressPolicy = z
	.object({
		enabled: z.boolean().default(false),
		defaultAction: z.enum(["allow", "block"]).default("allow"),
		rules: z.array(ingressRule).max(100).default([]),
		rateLimit: z
			.object({ enabled: z.boolean(), requests: z.number().int().min(1).max(1000000), windowSeconds: z.number().int().min(1).max(86400) })
			.strict()
			.default({ enabled: false, requests: 100, windowSeconds: 60 }),
	})
	.strict()
	.refine((policy) => new Set(policy.rules.map((rule) => rule.id)).size === policy.rules.length, "Rule IDs must be unique");

export const ingressPolicyUpdate = z.object({ expectedVersion: z.number().int().min(0), policy: ingressPolicy }).strict();

export type IngressPolicy = z.infer<typeof ingressPolicy>;

/** Rules are ordered: the first match either blocks or skips the remaining header rules. */
export function ingressRuleOutcome(policy: IngressPolicy, headers: Record<string, string>): "allow" | "block" {
	if (!policy.enabled) return "allow";
	for (const rule of policy.rules) {
		if (!rule.enabled) continue;
		const value = headers[rule.header];
		const matches = rule.operator === "present" ? value !== undefined : rule.operator === "missing" ? value === undefined : value !== undefined && (rule.operator === "equals" ? value === rule.value : value.toLowerCase().includes(rule.value.toLowerCase()));
		if (matches) return rule.action === "block" ? "block" : "allow";
	}

	return policy.defaultAction;
}

export function browserBlockingRules(): IngressPolicy["rules"] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Browser navigation",
			enabled: true,
			header: "sec-fetch-mode",
			operator: "equals",
			value: "navigate",
			action: "block",
		},
		{
			id: crypto.randomUUID(),
			name: "Browser user agent",
			enabled: true,
			header: "user-agent",
			operator: "contains",
			value: "Mozilla/",
			action: "block",
		},
	];
}
