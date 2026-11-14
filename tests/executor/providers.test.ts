import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { compile } from "../../apps/executor/src/compiler.ts";
import { execute } from "../../apps/executor/src/supervisor.ts";
import { stripeTemplate } from "../../packages/script-sdk/src/templates/stripe.ts";
import { twitchTemplate } from "../../packages/script-sdk/src/templates/twitch.ts";

const secret = "synthetic-provider-signing-secret";

async function handler(source: string, secrets: Record<string, string>) {
	const compiled = await compile({ stage: "ingress", body: source });

	return async (body: Uint8Array, headers: Record<string, string>) => {
		const result = await execute({
			stage: "ingress",
			bundle: compiled.bundle,
			input: {
				request: {
					body,
					headers,
					method: "POST",
					contentType: "application/json",
				},
				secrets,
			},
		});

		return result.decision as { kind: string; response: { status: number; body: string }; event?: { body: Uint8Array } };
	};
}

test("provider Stripe verifies exact bytes, rotated signatures and timestamp tolerance in workerd", async () => {
	const run = await handler(stripeTemplate.source, { STRIPE_WEBHOOK_SECRET: secret });
	const body = new TextEncoder().encode('{ "id": "evt_synthetic", "data": {"name":"日本語"} }\n');
	const timestamp = String(Math.floor(Date.now() / 1000));

	const sign = (time: string) =>
		createHmac("sha256", secret)
			.update(time + ".")
			.update(body)
			.digest("hex");

	const signature = sign(timestamp);
	const valid = await run(body, { "stripe-signature": `v0=ignored,t=${timestamp},v1=${"0".repeat(64)},v1=${signature},destination=ignored` });
	assert.equal(valid.kind, "accept");
	assert.deepEqual(valid.event?.body, body);
	assert.equal((await run(new TextEncoder().encode("{}"), { "stripe-signature": `t=${timestamp},v1=${signature}` })).response.status, 401);
	for (const time of [String(Number(timestamp) - 600), String(Number(timestamp) + 600)]) {
		assert.equal((await run(body, { "stripe-signature": `t=${time},v1=${sign(time)}` })).response.status, 401);
	}

	for (const header of ["", `t=${timestamp},v0=${signature}`, `t=${timestamp},t=${timestamp},v1=${signature}`, `t=NaN,v1=${signature}`, `t=${timestamp},v1=invalid`]) {
		assert.equal((await run(body, { "stripe-signature": header })).response.status, 401);
	}

	assert.equal((await (await handler(stripeTemplate.source, {}))(body, {})).response.status, 503);
});

test("provider Twitch authenticates before returning a plain challenge and preserves notification bytes", async () => {
	const run = await handler(twitchTemplate.source, { TWITCH_WEBHOOK_SECRET: secret });
	const timestamp = new Date().toISOString();
	const id = "synthetic-eventsub-id";

	const headers = (body: Uint8Array, type: string, time = timestamp) => ({
		"twitch-eventsub-message-id": id,
		"twitch-eventsub-message-timestamp": time,
		"twitch-eventsub-message-type": type,
		"twitch-eventsub-message-signature":
			"sha256=" +
			createHmac("sha256", secret)
				.update(id + time)
				.update(body)
				.digest("hex"),
	});

	const body = new TextEncoder().encode('{"challenge":"a challenge é"}');
	const challenge = await run(body, headers(body, "webhook_callback_verification"));
	assert.deepEqual(challenge, { kind: "respondOnly", response: { status: 200, headers: { "content-type": "text/plain", "content-length": "14" }, body: "a challenge é" } });
	for (const type of ["notification", "revocation"]) {
		const accepted = await run(body, headers(body, type));
		assert.equal(accepted.kind, "accept");
		assert.deepEqual(accepted.event?.body, body);
	}

	assert.equal((await run(new TextEncoder().encode("{}"), headers(body, "webhook_callback_verification"))).response.status, 401);
	assert.equal((await run(body, headers(body, "notification", new Date(Date.now() - 700000).toISOString()))).response.status, 401);
	assert.equal((await run(body, { ...headers(body, "notification"), "twitch-eventsub-message-signature": "bad" })).response.status, 401);
	assert.equal((await run(body, headers(body, "unknown"))).response.status, 400);
	for (const invalid of [new TextEncoder().encode("bad JSON"), new TextEncoder().encode("{}")]) {
		assert.equal((await run(invalid, headers(invalid, "webhook_callback_verification"))).response.status, 400);
	}

	assert.equal((await (await handler(twitchTemplate.source, {}))(body, {})).response.status, 503);
});
