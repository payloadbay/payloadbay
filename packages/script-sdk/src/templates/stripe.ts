export const stripeTemplate = {
	name: "Stripe signed webhook",
	description: "Bind STRIPE_WEBHOOK_SECRET to the endpoint signing secret. Verifies raw bytes and a five-minute timestamp window.",
	stage: "ingress" as const,
	source: `export async function POST(ctx: IngressContext): Promise<IngressDecision> {
	const secret = ctx.secrets.STRIPE_WEBHOOK_SECRET;
	if (!secret) return ctx.reject({ status: 503, body: "Signing secret is not configured" });

	const entries = (ctx.request.headers["stripe-signature"] ?? "").split(",").map((entry) => entry.trim().split("="));
	const timestamps = entries.filter(([key]) => key === "t");
	const timestamp = timestamps[0]?.[1] ?? "";
	if (timestamps.length !== 1 || !/^[0-9]+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
		return ctx.reject({ status: 401, body: "Invalid signature" });
	}

	const prefix = new TextEncoder().encode(timestamp + ".");
	const payload = new Uint8Array(prefix.length + ctx.request.body.length);
	payload.set(prefix);
	payload.set(ctx.request.body, prefix.length);
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
	let verified = false;
	for (const [scheme, value] of entries) {
		if (scheme !== "v1" || !/^[0-9a-f]{64}$/i.test(value ?? "")) continue;
		const signature = Uint8Array.from(value.match(/../g)!, (byte) => parseInt(byte, 16));
		if (await crypto.subtle.verify("HMAC", key, signature, payload)) verified = true;
	}
	if (!verified) return ctx.reject({ status: 401, body: "Invalid signature" });

	return ctx.accept({
		event: { body: ctx.request.body, contentType: ctx.request.contentType },
		response: { status: 200, body: "Accepted" },
	});
}`,
};
