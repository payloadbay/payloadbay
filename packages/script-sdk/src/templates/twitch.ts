export const twitchTemplate = {
	name: "Twitch EventSub",
	description: "Bind TWITCH_WEBHOOK_SECRET to the subscription secret. Verifies EventSub signatures before returning challenges or accepting notifications.",
	stage: "ingress" as const,
	source: `export async function POST(ctx: IngressContext): Promise<IngressDecision> {
	const secret = ctx.secrets.TWITCH_WEBHOOK_SECRET;
	if (!secret) return ctx.reject({ status: 503, body: "Signing secret is not configured" });

	const id = ctx.request.headers["twitch-eventsub-message-id"] ?? "";
	const timestamp = ctx.request.headers["twitch-eventsub-message-timestamp"] ?? "";
	const signatureHeader = ctx.request.headers["twitch-eventsub-message-signature"] ?? "";
	const age = Date.now() - Date.parse(timestamp);
	if (!id || !Number.isFinite(age) || age < -60000 || age > 600000 || !/^sha256=[0-9a-f]{64}$/i.test(signatureHeader)) {
		return ctx.reject({ status: 401, body: "Invalid signature" });
	}

	const prefix = new TextEncoder().encode(id + timestamp);
	const payload = new Uint8Array(prefix.length + ctx.request.body.length);
	payload.set(prefix);
	payload.set(ctx.request.body, prefix.length);
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
	const signature = Uint8Array.from(signatureHeader.slice(7).match(/../g)!, (byte) => parseInt(byte, 16));
	if (!(await crypto.subtle.verify("HMAC", key, signature, payload))) return ctx.reject({ status: 401, body: "Invalid signature" });

	const type = ctx.request.headers["twitch-eventsub-message-type"];
	if (type === "webhook_callback_verification") {
		let challenge: unknown;
		try {
			challenge = JSON.parse(new TextDecoder().decode(ctx.request.body)).challenge;
		} catch {
			return ctx.reject({ status: 400, body: "Invalid challenge" });
		}
		if (typeof challenge !== "string") return ctx.reject({ status: 400, body: "Invalid challenge" });

		return ctx.respondOnly({ status: 200, headers: { "content-type": "text/plain", "content-length": String(new TextEncoder().encode(challenge).length) }, body: challenge });
	}
	if (type !== "notification" && type !== "revocation") return ctx.reject({ status: 400, body: "Unknown message type" });

	return ctx.accept({
		event: { body: ctx.request.body, contentType: ctx.request.contentType, metadata: { providerMessageId: id, messageType: type } },
		response: { status: 204, body: "" },
	});
}`,
};
