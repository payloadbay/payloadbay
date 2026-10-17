import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Authority } from "./execution-lease.ts";

const claims = z
	.object({
		executionId: z.string().uuid(),
		endpointId: z.string().uuid(),
		owner: z.string().min(1).max(128),
		generation: z.number().int().positive(),
		expiresAt: z.number().int(),
		nonce: z.string(),
	})
	.strict();

export function mintBrokerToken(secret: string, authority: Authority, expiresAt: number) {
	const payload = Buffer.from(JSON.stringify({ ...authority, expiresAt, nonce: randomBytes(16).toString("hex") })).toString("base64url");

	return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyBrokerToken(secret: string, token: string, now: number): Authority {
	const [payload, signature, ...extra] = token.split(".");
	if (!payload || !signature || extra.length) throw Error("Invalid broker capability");
	const expected = createHmac("sha256", secret).update(payload).digest();
	const actual = Buffer.from(signature, "base64url");
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error("Invalid broker capability");
	let parsed;
	try {
		parsed = claims.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
	} catch {
		throw Error("Invalid broker capability");
	}

	if (parsed.expiresAt <= now) throw Error("Expired broker capability");

	return {
		executionId: parsed.executionId,
		endpointId: parsed.endpointId,
		owner: parsed.owner,
		generation: parsed.generation,
	};
}
