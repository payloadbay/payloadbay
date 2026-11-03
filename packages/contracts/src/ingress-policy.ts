import { z } from "zod";
import { RE2JS } from "re2js";
import { AppError } from "./errors.ts";

export const protectionScope = z.object({ type: z.enum(["organization", "workspace", "project", "endpoint"]), id: z.uuid() }).strict();

export type ProtectionScope = z.infer<typeof protectionScope>;

export const conditionFields = ["header", "method", "path", "content_type", "body_size"] as const;

export const stringOperators = ["equals", "not_equals", "contains", "not_contains", "starts_with", "not_starts_with", "ends_with", "not_ends_with", "wildcard", "not_wildcard", "regex", "not_regex", "in", "not_in"] as const;

export const numericOperators = ["equals", "not_equals", "gt", "gte", "lt", "lte"] as const;

export type ConditionField = (typeof conditionFields)[number];

export type ConditionOperator = (typeof stringOperators)[number] | (typeof numericOperators)[number] | "present" | "missing";

export type RequestCondition =
	| {
			id: string;
			kind: "condition";
			field: ConditionField;
			header?: string;
			operator: ConditionOperator;
			value?: string | number | string[];
			ignoreCase: boolean;
	  }
	| {
			id: string;
			kind: "group";
			join: "all" | "any";
			negate: boolean;
			children: RequestCondition[];
	  };

export type ProtectionRequest = {
	method: string;
	path: string;
	headers: Record<string, string>;
	bodySize: number;
};

const headerName = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/, "Use a valid header name")
	.transform((value) => value.toLowerCase());
const patterns = new Map<string, RE2JS>();

function pattern(source: string, ignoreCase: boolean) {
	const key = JSON.stringify([source, ignoreCase]);
	let compiled = patterns.get(key);
	if (!compiled) {
		compiled = RE2JS.compile(source, ignoreCase ? RE2JS.CASE_INSENSITIVE : 0);
		if (compiled.programSize() > 4096) throw Error("pattern_too_complex");
		if (patterns.size >= 128) patterns.delete(patterns.keys().next().value!);
		patterns.set(key, compiled);
	}

	return compiled;
}

export function operatorsFor(field: ConditionField): ConditionOperator[] {
	return field === "body_size" ? [...numericOperators] : field === "header" || field === "content_type" ? [...stringOperators, "present", "missing"] : [...stringOperators];
}

const comparison = z
	.object({
		id: z.uuid(),
		kind: z.literal("condition"),
		field: z.enum(conditionFields),
		header: headerName.optional(),
		operator: z.enum([...stringOperators, "gt", "gte", "lt", "lte", "present", "missing"]),
		value: z.union([z.string().max(1024), z.number().int().min(0).max(1000000000), z.array(z.string().min(1).max(256)).min(1).max(50)]).optional(),
		ignoreCase: z.boolean().default(false),
	})
	.strict()
	.superRefine((node, ctx) => {
		if (!operatorsFor(node.field).includes(node.operator)) ctx.addIssue({ code: "custom", path: ["operator"], message: "Choose an operator supported by this field" });
		if (node.field === "header" && !node.header) ctx.addIssue({ code: "custom", path: ["header"], message: "Enter a header name" });
		if (node.operator === "present" || node.operator === "missing") return;
		if (node.field === "body_size") {
			if (typeof node.value !== "number") ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a size in bytes" });
		} else if (node.operator === "in" || node.operator === "not_in") {
			if (!Array.isArray(node.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter one value per line" });
		} else if (typeof node.value !== "string" || !node.value.length) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a comparison value" });
		if ((node.operator === "regex" || node.operator === "not_regex" || node.operator === "wildcard" || node.operator === "not_wildcard") && typeof node.value === "string") {
			if (node.value.length > 256) ctx.addIssue({ code: "custom", path: ["value"], message: "Patterns must be at most 256 characters" });
			else
				try {
					pattern(node.operator.endsWith("wildcard") ? wildcardSource(node.value) : node.value, node.ignoreCase);
				} catch {
					ctx.addIssue({ code: "custom", path: ["value"], message: "Invalid, unsupported or overly complex pattern" });
				}
		}
	});

function conditionAt(depth: number): z.ZodType<RequestCondition> {
	return z.discriminatedUnion("kind", [
		comparison,
		z
			.object({
				id: z.uuid(),
				kind: z.literal("group"),
				join: z.enum(["all", "any"]),
				negate: z.boolean().default(false),
				children: z
					.array(depth ? conditionAt(depth - 1) : z.never())
					.min(1)
					.max(16),
			})
			.strict(),
	]);
}

export function conditionNodes(condition: RequestCondition): RequestCondition[] {
	return condition.kind === "group" ? [condition, ...condition.children.flatMap(conditionNodes)] : [condition];
}

export const requestCondition = conditionAt(4).superRefine((condition, ctx) => {
	const nodes = conditionNodes(condition);
	if (nodes.length > 64) ctx.addIssue({ code: "custom", message: "Use at most 64 conditions and groups per rule" });
	if (new Set(nodes.map((node) => node.id)).size !== nodes.length) ctx.addIssue({ code: "custom", message: "Condition IDs must be unique" });
});

export const ingressRule = z
	.object({
		id: z.uuid(),
		name: z.string().trim().min(1).max(100),
		enabled: z.boolean(),
		condition: requestCondition,
		action: z.enum(["block", "skip"]),
	})
	.strict();

export const ingressRateRule = z
	.object({
		id: z.uuid(),
		name: z.string().trim().min(1).max(100),
		enabled: z.boolean(),
		condition: requestCondition.nullable().default(null),
		algorithm: z.enum(["token_bucket", "rolling", "fixed"]),
		requests: z.number().int().min(1).max(1000000),
		windowSeconds: z.number().int().min(1).max(86400),
		burst: z.number().int().min(1).max(1000000).default(20),
		groupBy: z.enum(["scope", "route"]).default("scope"),
	})
	.strict()
	.superRefine((rule, ctx) => {
		if (rule.algorithm === "rolling" && rule.requests > 10000) ctx.addIssue({ code: "custom", path: ["requests"], message: "Rolling windows support up to 10000 requests; use a token bucket for higher rates" });
	});

export const ingressPolicy = z
	.object({
		enabled: z.boolean().default(false),
		defaultAction: z.enum(["allow", "block"]).default("allow"),
		rules: z.array(ingressRule).max(100).default([]),
		rateLimits: z.array(ingressRateRule).max(10).default([]),
	})
	.strict()
	.superRefine((policy, ctx) => {
		const rules = [...policy.rules, ...policy.rateLimits];
		if (new Set(rules.map((rule) => rule.id)).size !== rules.length) ctx.addIssue({ code: "custom", message: "Rule IDs must be unique" });
		if (rules.reduce((count, rule) => count + (rule.condition ? conditionNodes(rule.condition).length : 0), 0) > 512) ctx.addIssue({ code: "custom", message: "Use at most 512 conditions and groups in a policy" });
	});

export const ingressPolicyUpdate = z.object({ expectedVersion: z.number().int().min(0), policy: ingressPolicy }).strict();

export const protectionTestInput = z
	.object({
		policy: ingressPolicy,
		request: z
			.object({
				method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
				path: z
					.string()
					.min(1)
					.max(4096)
					.startsWith("/")
					.refine((value) => !/[?#]/.test(value), "Enter a path without a query string or fragment"),
				headers: z.record(headerName, z.string().max(8192)).refine((value) => Object.keys(value).length <= 100, "Use at most 100 headers"),
				bodySize: z.number().int().min(0).max(1000000000),
			})
			.strict(),
	})
	.strict();

export type IngressPolicy = z.infer<typeof ingressPolicy>;

export type IngressRule = z.infer<typeof ingressRule>;

export type IngressRateRule = z.infer<typeof ingressRateRule>;

export function newCondition(field: ConditionField = "header"): RequestCondition {
	return {
		id: crypto.randomUUID(),
		kind: "condition",
		field,
		...(field === "header" ? { header: "" } : {}),
		operator: "equals",
		value: field === "body_size" ? 0 : "",
		ignoreCase: false,
	};
}

export function newConditionGroup(): Extract<RequestCondition, { kind: "group" }> {
	return {
		id: crypto.randomUUID(),
		kind: "group",
		join: "all",
		negate: false,
		children: [newCondition()],
	};
}

export function conditionValue(node: Extract<RequestCondition, { kind: "condition" }>, request: ProtectionRequest): string | number | undefined {
	if (node.field === "header" || node.field === "content_type") {
		const name = node.field === "header" ? (node.header ?? "") : "content-type";

		return Object.hasOwn(request.headers, name) ? request.headers[name] : undefined;
	}

	return node.field === "method" ? request.method : node.field === "path" ? request.path : request.bodySize;
}

/** Convert wildcard syntax to the same bounded, non-backtracking engine. */
function wildcardSource(glob: string) {
	let source = "(?s)";
	for (let index = 0; index < glob.length; index++) {
		let character = glob[index];
		if (character === "*") {
			if (glob[index + 1] === "*") throw Error("consecutive_wildcards");
			source += ".*";
			continue;
		}

		if (character === "\\") {
			if (glob[index + 1] !== "*" && glob[index + 1] !== "\\") throw Error("invalid_wildcard_escape");
			character = glob[++index];
		}

		source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	return source;
}

export function protectionEvaluationBudget() {
	return { remaining: 2000000 };
}

export function matchesCondition(node: RequestCondition, request: ProtectionRequest, budget = protectionEvaluationBudget()): boolean {
	if (node.kind === "group") {
		const matches = node.join === "all" ? node.children.every((child) => matchesCondition(child, request, budget)) : node.children.some((child) => matchesCondition(child, request, budget));

		return node.negate ? !matches : matches;
	}

	const actual = conditionValue(node, request);
	if (node.operator === "present") return actual !== undefined;
	if (node.operator === "missing") return actual === undefined;
	const negative = node.operator.startsWith("not_");
	const operator = node.operator.replace(/^not_/, "");
	let matches = false;
	if (typeof actual === "number" && typeof node.value === "number") matches = operator === "equals" ? actual === node.value : operator === "gt" ? actual > node.value : operator === "gte" ? actual >= node.value : operator === "lt" ? actual < node.value : operator === "lte" ? actual <= node.value : false;
	else if (typeof actual === "string") {
		const normalize = (value: string) => (node.ignoreCase ? value.toLowerCase() : value);

		const value = normalize(actual);
		if (Array.isArray(node.value)) matches = node.value.some((item) => normalize(item) === value);
		else if (typeof node.value === "string") {
			const expected = normalize(node.value);
			if (operator === "wildcard" || operator === "regex") {
				const compiled = pattern(operator === "wildcard" ? wildcardSource(node.value) : node.value, node.ignoreCase);
				// Bound aggregate NFA work before entering the matcher, including negated rules.
				budget.remaining -= compiled.programSize() * (actual.length + 1);
				if (budget.remaining < 0) throw new AppError("protection_work_limit", 422, "Regex matching exceeds the evaluation limit. Simplify the patterns or shorten the compared fields.");
				matches = operator === "wildcard" ? compiled.matches(actual) : compiled.test(actual);
			} else matches = operator === "equals" ? value === expected : operator === "contains" ? value.includes(expected) : operator === "starts_with" ? value.startsWith(expected) : operator === "ends_with" ? value.endsWith(expected) : false;
		}
	}

	return negative ? !matches : matches;
}

export function formatCondition(node: RequestCondition): string {
	if (node.kind === "group") return (node.negate ? "NOT " : "") + "(" + node.children.map(formatCondition).join(node.join === "all" ? " AND " : " OR ") + ")";
	const field = node.field === "header" ? "headers[" + JSON.stringify(node.header ?? "") + "]" : node.field;

	return field + " " + node.operator.replaceAll("_", " ") + (node.value === undefined || node.operator === "present" || node.operator === "missing" ? "" : " " + JSON.stringify(node.value)) + (node.ignoreCase ? " [ignore case]" : "");
}

export function evaluateFilters(policy: IngressPolicy, request: ProtectionRequest, budget = protectionEvaluationBudget()) {
	if (!policy.enabled) return { action: "continue" as const, rule: null };
	const rule = policy.rules.find((item) => item.enabled && matchesCondition(item.condition, request, budget));

	return rule ? { action: rule.action, rule: { id: rule.id, name: rule.name } } : { action: policy.defaultAction === "block" ? ("block" as const) : ("continue" as const), rule: null };
}

export const filterTemplates = [
	{
		id: "browser-navigation",
		name: "Block browser navigation",
		description: "Match navigation metadata rather than all browser-like traffic.",
		create: (): IngressRule => ({
			id: crypto.randomUUID(),
			name: "Block browser navigation",
			enabled: true,
			action: "block",
			condition: {
				id: crypto.randomUUID(),
				kind: "group",
				join: "any",
				negate: false,
				children: [
					{
						...newCondition(),
						kind: "condition",
						field: "header",
						header: "sec-fetch-mode",
						operator: "equals",
						value: "navigate",
						ignoreCase: false,
					},
					{
						...newCondition(),
						kind: "condition",
						field: "header",
						header: "sec-fetch-dest",
						operator: "equals",
						value: "document",
						ignoreCase: false,
					},
				],
			},
		}),
	},
	{
		id: "browser-clients",
		name: "Block browser-like clients",
		description: "A broader heuristic using browser names and client hints. Headers can be spoofed.",
		create: (): IngressRule => ({
			id: crypto.randomUUID(),
			name: "Block browser-like clients",
			enabled: true,
			action: "block",
			condition: {
				id: crypto.randomUUID(),
				kind: "group",
				join: "any",
				negate: false,
				children: [
					{
						...newCondition(),
						kind: "condition",
						field: "header",
						header: "user-agent",
						operator: "regex",
						value: "(?:Chrome|Chromium|Firefox|Safari|Edg|OPR)/",
						ignoreCase: true,
					},
					{
						...newCondition(),
						kind: "condition",
						field: "header",
						header: "sec-ch-ua",
						operator: "present",
						ignoreCase: false,
					},
				],
			},
		}),
	},
];
