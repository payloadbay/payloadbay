import { z } from "zod";
import type { IngressRateRule } from "./ingress-policy.ts";

const instant = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);

export const ingressRateState = z.discriminatedUnion("kind", [z.object({ kind: z.literal("fixed"), startedAt: instant, count: z.number().int().min(0).max(1000000) }).strict(), z.object({ kind: z.literal("token_bucket"), updatedAt: instant, tokens: z.number().finite().min(0).max(1000000) }).strict(), z.object({ kind: z.literal("rolling"), timestamps: z.array(instant).max(10000) }).strict()]);

export type IngressRateState = z.infer<typeof ingressRateState>;

/** Calculates one reservation; callers persist it only after all applicable limits admit. */
export function reserveIngressRate(rule: IngressRateRule, prior: IngressRateState | null, timestamp: number): { allowed: boolean; state: IngressRateState; retryAfter: number } {
	const period = rule.windowSeconds * 1000;
	if (rule.algorithm === "token_bucket") {
		const previous = prior?.kind === "token_bucket" ? prior : { updatedAt: timestamp, tokens: rule.burst };
		const now = Math.max(timestamp, previous.updatedAt);
		const tokens = Math.min(rule.burst, previous.tokens + ((now - previous.updatedAt) * rule.requests) / period);
		const allowed = tokens + 1e-9 >= 1;

		return { allowed, state: { kind: "token_bucket", updatedAt: now, tokens: Math.max(0, allowed ? tokens - 1 : tokens) }, retryAfter: allowed ? 0 : Math.max(1, Math.ceil(((1 - tokens) * period) / rule.requests / 1000)) };
	}

	if (rule.algorithm === "rolling") {
		const previous = prior?.kind === "rolling" ? prior.timestamps : [];
		const now = Math.max(timestamp, previous.at(-1) ?? timestamp);
		const timestamps = previous.filter((time) => time > now - period);
		const allowed = timestamps.length < rule.requests;
		const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((timestamps[0] + period - now) / 1000));
		if (allowed) timestamps.push(now);

		return { allowed, state: { kind: "rolling", timestamps }, retryAfter };
	}

	const previous = prior?.kind === "fixed" ? prior : { startedAt: timestamp, count: 0 };
	const now = Math.max(timestamp, previous.startedAt);
	const state = now >= previous.startedAt + period ? { kind: "fixed" as const, startedAt: now, count: 0 } : { kind: "fixed" as const, ...previous };
	const allowed = state.count < rule.requests;
	if (allowed) state.count++;

	return { allowed, state, retryAfter: allowed ? 0 : Math.max(1, Math.ceil((state.startedAt + period - now) / 1000)) };
}
