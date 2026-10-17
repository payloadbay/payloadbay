# Installation-local API

Payload Bay serves the machine-readable OpenAPI 3.1 document at
`/api/openapi.json` and the interactive Scalar reference at `/docs/api`.
Open **Account menu → API documentation**, or visit the reference URL directly.
The reference renderer, fonts and specification are bundled or served locally.
The same relative URLs work on self-hosted and disposable preview installations.
No external documentation proxy is required.

The reference describes the versioned `/api/v1` product API. Better Auth owns
identity/passkey endpoints under `/api/auth`; receiving URLs under `/ingress`
follow the published ingress script's method, verification and response logic.
They are separate interfaces, not assumed JSON CRUD endpoints.

## Authentication and real effects

Enter a scoped API token in Scalar's Bearer authentication control. Token rights
are intersected with current membership and admission; revocation, expiry and
ancestor access still apply. Documentation does not grant additional rights.
The browser console does not persist entered credentials in local storage.

An existing browser session can also authenticate product API calls. Mutating
cookie requests require a matching `Origin` and `x-payloadbay-csrf: 1`; the local
console supplies the CSRF header, and the browser supplies its origin normally.
The console sends requests only to this installation and rejects redirects. It
does not forward credentials through a hosted proxy or to another server.

**Try request runs the actual API.** It is not the effect-free script test.
Use synthetic data in a disposable preview. Never connect production secrets,
payloads or provider subscriptions to a shared demo.

## Versions, replay and filters

Optimistic updates that require a version use `If-Match: "1"` with the current
quoted positive version. Membership creation has no previous version; an edit
supplies its version. Some commands, such as policy/publication updates, carry
`expectedVersion` in their JSON body instead. Follow the operation's contract.

Replay requires a stable `idempotency-key` of 1–128 characters without control
characters. Repeating the same key/input reuses the operation; changing input
under that key conflicts. A deliberate replay creates new execution history.
It does not overwrite the original request or promise exactly-once HTTP effects.

Event status filters repeat the query key, for example
`state=failed_terminal&state=succeeded`. Usage reads require explicit increasing
UTC `from`/`to` bounds. The window includes its start and excludes its end.
Returned counts are decimal strings to retain integer precision.

## Maintaining the contract

`packages/contracts/src/api-operations.ts` explicitly lists the public versioned
HTTP surface. `api-request-schemas.ts` maps commands to the same Zod definitions
used by handlers. `api-query-schemas.ts` uses shared scope, pagination and usage
primitives for recognized filters. `openapi.ts` generates the document without
reading environment credentials, installation configuration or tenant records.

When adding an operation, update its contract and the handler together. The
owning `live-api.test.ts` checks the actual route exports, required path fields,
JSON commands, version/replay headers and GET filters. The API-docs browser owner
checks the local renderer and real console behavior. Register new test owners
in `tests/config/inventory.json`; use scoped runs during development.

JSON Schema cannot express every runtime rule, including permissions,
installation state, cross-field relationships, byte budgets and immutable
publication dependencies. The server still enforces them. Successful response
fields depend on the caller's permissions; the document does not expose internal
tables as an automatically generated public SDK. Private errors use the shared
safe envelope and correlation ID.


## Jobs and queues

`GET /api/v1/jobs` requires `jobs.read` at instance scope. A project-level grant
with that name does not grant instance administration. The local API reference
publishes the response schema. The dashboard entry is under Administration and
is hidden without that instance permission.

The response is an operational snapshot: up to 100 platform jobs with active work first, then due-time
order, plus counts of queued/retrying processing executions that are due now,
grouped by numeric priority. Paused routes and future-due retries are excluded
from that backlog. The oldest queued age starts at execution creation; oldest
overdue age starts at its due timestamp. Neither is provider acknowledgement
latency; that unmeasured field is explicitly null. The screen currently refreshes
on request, rather than claiming a live feed. Job payloads and raw upstream
errors are excluded. This read-only view does not cancel, rerun or delete jobs;
event replay/pause remain in their existing event/route flows.

### Instance audit history

`GET /api/v1/audit` requires current instance-level `audit.read`. It returns
newest-first action metadata (actor identifier, operation, scope, resource
identifier and timestamp), never stored diffs or secret values. Project or
workspace audit rights do not grant instance administration. Use `limit` (1–200,
default 50) and the opaque `nextCursor` to page through history. Cursors preserve
timestamp precision and use the record identifier to order simultaneous actions.
The dashboard exposes the same read-only collection under Administration → Audit log.
