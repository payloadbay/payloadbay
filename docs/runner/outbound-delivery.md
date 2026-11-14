# Outbound private receiver Runner

Core issue [#18](https://github.com/payloadbay/payloadbay/issues/18) tracks this
separate product. This branch adds the Core transport; the agent is maintained
separately. Neither is a published release yet.

Payload Bay remains the public receiving endpoint. A local agent polls outbound,
then delivers to a fixed local HTTP(S) URL chosen by its operator. Your local app
needs no public port. This is durable webhook delivery, not a general-purpose
ngrok reverse proxy: provider challenges are answered by the Core ingress script.

## Configuration flow

1. Create a project destination. Its HTTP URL remains required by the current
   destination editor; use `http://runner.invalid` as a placeholder. A Runner
   publication never fetches that URL.
2. Using a signed-in account or project API key with `destinations.configure`
   and `payload.read`, POST `/api/v1/destinations/:id/runner`. Keep the returned
   token in the local agent's secret environment; it is returned once and only
   its hash is stored in Core. This rotates any previous Runner credential.
3. Publish the route again so its immutable destination snapshot selects Runner
   transport. Existing publications deliberately keep their previous transport.
4. Start the separately installed Runner with `PAYLOADBAY_URL` set to the Core
   HTTPS origin, `PAYLOADBAY_RUNNER_TARGET` set to the local receiver URL and
   `PAYLOADBAY_RUNNER_TOKEN` set through local secret storage. The agent never
   takes its local URL from a server delivery envelope.
5. DELETE `/api/v1/destinations/:id/runner` to revoke credentials. Rotation,
   creator membership removal, parent API-key expiry/revocation and organization
   passkey policy are rechecked on subsequent claims and acknowledgements.

The HTTP URL editor does not yet offer a dedicated Runner mode selector; this
initial developer flow uses the documented API. Do not promise a polished
end-user connection wizard until that interface has been designed and tested.

## Protocol and failure semantics

`POST /api/v1/runner/claim` uses only the destination-scoped Runner bearer token.
It returns 204 when idle, or an encrypted-at-rest delivery decoded for that
credential with `id`, `idempotencyKey`, `method`, `headers`, `bodyBase64`,
`leaseToken` and `leaseExpiresAt`. A delivery attempt is claimed once; an offline
agent causes the existing managed send to time out and the processing script can
retry. The normal delivery-attempt history records the outcome.

`POST /api/v1/runner/deliveries/:id/complete` accepts the lease and a bounded HTTP
response or `local_delivery_failed`. Expired, wrong-destination, revoked and
superseded-generation acknowledgements cannot finalize an execution. Request
payloads are encrypted with the instance encryption key and cleared after the
managed send finishes. Trusted recovery also clears expired request/response
envelopes in bounded batches if the worker died before its cleanup ran. Never
replace that key as a recovery shortcut.

A receiver may act before its response or acknowledgement is lost. Retries can
therefore duplicate effects. `x-payloadbay-delivery-id` carries a stable
idempotency key for the execution and logical operation across retry attempts;
receivers must persistently deduplicate if effects must happen only once. An
explicit replay creates a new execution and a new key. The transport never claims
exactly-once delivery and does not follow local redirects.

## Checks

`tests/integration/runner.test.ts` exercises encrypted storage, private HTTP
bytes, single claims, timeouts, replay fencing, platform-admin exclusion and
credential revocation. `tests/deployment/runner.test.ts` runs the real Next APIs
and the protocol client. Set `PAB_RUNNER_MODULE` to the absolute file URL of the
separate agent module to run the same API acceptance against the actual agent.
The normal Core suite needs no sibling checkout or external package.

These tests use disposable development databases. The first ordinary release
migration remains master-CI-owned; no local release SQL is generated.
