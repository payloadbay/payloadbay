import { test, expect } from "bun:test";
import { ingressPolicy, evaluateFilters, filterTemplates, requestCondition, matchesCondition, newCondition, type RequestCondition } from "../../packages/contracts/src/ingress-policy.ts";

const request = {
	method: "POST",
	path: "/hooks",
	headers: { "sec-fetch-mode": "navigate" },
	bodySize: 0,
};

test("ordered filters support a leading exception and default block", () => {
	const exception = {
		id: crypto.randomUUID(),
		name: "Trusted sender",
		enabled: true,
		action: "skip",
		condition: { ...newCondition(), header: "x-sender", value: "provider" },
	};
	const policy = ingressPolicy.parse({ enabled: true, defaultAction: "block", rules: [exception, filterTemplates[0].create()] });
	expect(evaluateFilters(policy, { ...request, headers: { ...request.headers, "x-sender": "provider" } }).action).toBe("skip");
	expect(evaluateFilters(policy, request).action).toBe("block");
	expect(evaluateFilters({ ...policy, enabled: false }, request).action).toBe("continue");
	expect(evaluateFilters({ ...policy, rules: [] }, request).action).toBe("block");
});

test("nested conditions distinguish absence from negated comparisons", () => {
	const condition: RequestCondition = {
		id: crypto.randomUUID(),
		kind: "group",
		join: "all",
		negate: false,
		children: [
			{
				...newCondition(),
				kind: "condition",
				field: "header",
				header: "x-source",
				operator: "present",
				ignoreCase: false,
			},
			{
				...newCondition(),
				kind: "condition",
				field: "header",
				header: "x-source",
				operator: "not_contains",
				value: "browser",
				ignoreCase: true,
			},
		],
	};
	expect(matchesCondition(requestCondition.parse(condition), { ...request, headers: {} })).toBe(false);
	expect(matchesCondition(condition, { ...request, headers: { "x-source": "provider" } })).toBe(true);
	expect(matchesCondition(condition, { ...request, headers: { "x-source": "BROWSER" } })).toBe(false);
});

test("request protection rejects malformed and unbounded configuration", () => {
	const rule = filterTemplates[0].create();
	expect(ingressPolicy.safeParse({ rules: [rule, rule] }).success).toBe(false);
	expect(requestCondition.safeParse({ ...newCondition(), header: "bad\r\nheader" }).success).toBe(false);
	expect(
		requestCondition.safeParse({
			...newCondition(),
			header: "x-test",
			operator: "regex",
			value: "(?=unsupported)",
		}).success,
	).toBe(false);
	expect(
		ingressPolicy.safeParse({
			rateLimits: [
				{
					id: crypto.randomUUID(),
					name: "Quota",
					enabled: true,
					algorithm: "rolling",
					requests: 10001,
					windowSeconds: 60,
				},
			],
		}).success,
	).toBe(false);
});
