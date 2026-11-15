# Webhook integration examples

These examples run in Payload Bay's bounded workerd ingress stage. Copy the
`source` from the linked template into the route's ingress editor, bind the named
secret to ingress, save and publish. Use the route's receiving URL as the provider
callback. Secrets belong in secret bindings, never in source code.

## Stripe

[Stripe template](../../packages/script-sdk/src/templates/stripe.ts) uses the
endpoint's `STRIPE_WEBHOOK_SECRET`, not an API key. It verifies the unmodified
request bytes with Web Crypto, supports multiple `v1` signatures during rotation,
ignores unknown signature metadata and requires a timestamp within five minutes.
Keep the server clock synchronized. A successful verification accepts the original
bytes and returns HTTP 200 after durable acceptance.

The implementation follows [Stripe's manual verification contract](https://docs.stripe.com/webhooks#verify-manually).
Provider retries and replay within the timestamp window can produce duplicates;
deduplicate using the Stripe event ID in your receiving application. The signing
secret used by Stripe CLI forwarding differs from a Dashboard endpoint secret.

## Twitch EventSub

[Twitch template](../../packages/script-sdk/src/templates/twitch.ts) uses
`TWITCH_WEBHOOK_SECRET`, the secret supplied when creating the subscription.
It authenticates the message ID, timestamp and original bytes before parsing a
challenge. Verified challenges return the exact challenge as plain text, without
starting a processing execution. Notifications and revocations are accepted as
original bytes with their message ID attached as metadata.

The template follows [Twitch's EventSub webhook contract](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/).
Its freshness policy rejects messages older than ten minutes or more than one
minute in the future. Deduplicate notifications by message ID downstream.

## Generic forwarding

Use [generic HMAC ingress](../../packages/script-sdk/src/templates/hmac.ts), bind
`SIGNING_SECRET`, and have the producer send `x-payloadbay-signature` containing
the hexadecimal HMAC-SHA256 of the raw body. This generic protocol has no timestamp
or replay protection; choose provider-specific verification where available.
Use the [delivery template](../../packages/script-sdk/src/templates/delivery.ts)
for processing and configure a default destination. It forwards accepted bytes
with their content type through the tracked broker and retries non-success.
It does not forward provider authentication headers automatically. Configure
receiver authentication separately rather than copying arbitrary request headers.

## Repeatable checks

Run `bun run test:file tests/executor/providers.test.ts` for the Stripe and Twitch
signature vectors in the real compiler/workerd executor. Generic HMAC tampering
is covered by `tests/integration/ingress.test.ts`; actual HTTP forwarding, response
history and retries are covered by `tests/integration/delivery.test.ts`.
These use synthetic credentials and local receivers. They do not certify a live
provider account, public TLS callback, or an unreleased image installation.
