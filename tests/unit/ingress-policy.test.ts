import { test, expect } from "bun:test";
import { ingressPolicy, ingressRuleOutcome, browserBlockingRules } from "../../packages/contracts/src/ingress-policy.ts";

test("ordered header filters support a leading exception and a default block", () => {
	const policy = ingressPolicy.parse({
		enabled: true,
		defaultAction: "block",
		rules: [
			{
				id: crypto.randomUUID(),
				name: "Trusted sender",
				enabled: true,
				header: "X-Sender",
				operator: "equals",
				value: "provider",
				action: "skip",
			},
			...browserBlockingRules(),
		],
	});
	expect(ingressRuleOutcome(policy, { "x-sender": "provider", "user-agent": "Mozilla/5.0" })).toBe("allow");
	expect(ingressRuleOutcome(policy, { "user-agent": "Mozilla/5.0" })).toBe("block");
	expect(ingressRuleOutcome(policy, {})).toBe("block");
	expect(ingressRuleOutcome({ ...policy, enabled: false }, {})).toBe("allow");
});

test("header filter operators distinguish missing, empty and matched values", () => {
	for (const [operator, headers, outcome] of [
		["present", { "x-test": "" }, "block"],
		["missing", {}, "block"],
		["equals", { "x-test": "token" }, "block"],
		["equals", { "x-test": "TOKEN" }, "allow"],
		["contains", { "x-test": "Test TOKEN" }, "block"],
	] as const) {
		const policy = ingressPolicy.parse({
			enabled: true,
			rules: [
				{
					id: crypto.randomUUID(),
					name: "Rule",
					enabled: true,
					header: "X-Test",
					operator,
					value: "token",
					action: "block",
				},
			],
		});
		expect(ingressRuleOutcome(policy, headers)).toBe(outcome);
		expect(ingressRuleOutcome({ ...policy, rules: policy.rules.map((rule) => ({ ...rule, enabled: false })) }, headers)).toBe("allow");
	}
});

test("request protection rejects malformed and unbounded configuration", () => {
	expect(ingressPolicy.safeParse({ rateLimit: { enabled: true, requests: 0, windowSeconds: 60 } }).success).toBe(false);
	expect(ingressPolicy.safeParse({ rateLimit: { enabled: true, requests: 1, windowSeconds: 86401 } }).success).toBe(false);
	const rules = browserBlockingRules();
	expect(ingressPolicy.safeParse({ rules: [rules[0], rules[0]] }).success).toBe(false);
	expect(ingressPolicy.safeParse({ rules: [{ ...rules[0], header: "bad\r\nheader" }] }).success).toBe(false);
});
