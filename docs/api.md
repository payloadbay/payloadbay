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

Create personal keys in account settings; they act as your user with optionally
reduced permissions. Organization, workspace and project keys stay inside their
creation resource. Organization keys may additionally restrict workspaces. No
instance-scoped keys can be created; the creation contract excludes that scope
and the HTTP handler explicitly rejects it.

`POST /api/v1/notifications/{incidentId}/snooze` accepts `minutes` of 15, 60 or
1440. Snoozing hides that incident from your account inbox until expiry. It does
not resolve the incident, change another recipient's inbox, suppress email
subscriptions or mute a later incident. Dismissal remains a separate action.

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

### Installation configuration and service checks

`GET /api/v1/installation/settings` and `GET /api/v1/health` require current
instance-level `settings.manage`. The operational projection reports
SMTP configured state, enabled OAuth provider names, registration policy,
configured executor mode and request/deadline limits. Credentials, database and
SMTP connection details are excluded. Instance customization (including future app-wide white-labeling) is hidden and
branding writes are disabled until verified enterprise licensing is available.
OAuth client editing is documented below; SMTP and execution settings remain deployment-managed. These endpoints do not rewrite deployment environment variables.

Health checks query the installation schema and probe the configured executor's
`/health` with a three-second deadline, a 16KiB response limit and redirects
blocked. The snapshot distinguishes ready, not-ready and unavailable executor
states, and never returns raw upstream errors. Worker health reports whether a heartbeat was recorded within 60 seconds.
SMTP health verifies a connection and authentication, without sending an email;
it does not establish mailbox delivery. Configured `runc`/`runsc` modes are
reported separately for the app and executor, without claiming host attestation.
This administrative snapshot is not an end-to-end readiness or delivery test.


Publication history supports activation and reversible archival through the same
version-checked PATCH command. Supply `archived: true` to archive, `false` to
restore, or omit it to activate. Active and latest versions cannot be archived;
an archived version must be restored before activation. Archival changes separate
metadata, never the published code or event references. Permanent deletion is not
supported: retained versions are part of recovery and explicit replay history.

### Unused configuration deletion and route overview

`DELETE /api/v1/endpoints/{endpointId}` and
`DELETE /api/v1/destinations/{destinationId}` require the resource's configuration
permission, current admission and `If-Match` expected version. They remove unused
configuration only. Publication/event/related-setting references return409
`resource_in_use`, stale versions return409 `version_conflict`, and history is
never cascaded away. Destination removal is serialized with publication snapshot
creation through the project lock. The operator should pause a used route rather
than delete its retained history.

`GET /api/v1/overview?endpointId=<uuid>` applies the same current metadata and token
checks as endpoint access before returning exact route-filtered traffic buckets
and recent executions. Omitting endpointId retains the authorized all-project
view. The filter never broadens access through an instance role.

## Installation sign-in providers

`GET /api/v1/installation/settings` returns public operational settings and a
versioned `configuration` containing OAuth client IDs and `secretConfigured`
flags. It never returns saved client secrets. Instance `settings.manage` is
required for both reading and updating this configuration.

`PUT /api/v1/installation/settings` accepts `{version, settings: {oauth}}`.
The supported provider keys are `google` and `github`. Supply `clientId` and
`clientSecret` when adding an application. For the same client ID, omitting the
secret preserves its stored value. Omit a provider from `oauth` to disable it.
A stale version returns 409. OAuth configuration is encrypted with the existing
instance encryption key and reloaded by each web process when its revision
changes. Existing sessions remain valid. Client IDs/secrets are managed only in
the database; legacy `GOOGLE_CLIENT_*`/`GITHUB_CLIENT_*` environment settings do
not configure runtime providers.

SMTP has one separate source: deployment environment variables. Its host,
credentials and sender cannot be overwritten through this API. Keep the instance
encryption key outside the database and include it in the operator backup plan.

## Saved TypeScript checks

`GET`/`POST /api/v1/endpoints/{endpointId}/tests` list/create named fixtures.
`PUT`/`DELETE /api/v1/endpoints/{endpointId}/tests/{testId}` update/delete them.
Definitions contain stage, synthetic request data, middleware selection,
structured expectations and optional `assertionSource`. They do not pin a
handler: selecting a test runs it against the current editor contents. Updates
carry the current version; a new test uses version zero. Definitions are encrypted
at rest, with at most 100 saved tests per route. Listing requires `code.read` and
`code.test`; saving/deleting additionally requires `code.edit` on that route's
project. A referenced route cannot be deleted while its saved tests remain.

The assertion module exports one async default function accepting
`ScriptTestContext`. It receives the decision kind, HTTP status/body, `test` and
`expect`. Await named checks and use `toBe`, `toEqual`, `toContain` or
`toBeTruthy`. Assertion code runs in the existing workerd executor with a
2-second deadline, no real secrets and no external fetch or managed effects.
This is an immediate regression runner, not a scheduler or arbitrary Node.js test
process.

## Organization passkey policy

`GET`/`PUT /api/v1/organizations/{organizationId}/security` require that
organization's `members.manage` permission. Updates carry `{version,
requirePasskey}`. An administrator must register their own passkey before
enabling the policy. Members without one receive no permissions in that
organization or its descendant workspaces/projects, but can still reach account
settings to enroll. Instance administration does not bypass the policy or grant
customer membership. The database prevents deletion of a member's last required
key; disable the policy or register another key first.

This policy requires enrollment; it is not session-level two-factor or a
passkey challenge after each email login. Passkey registration requires HTTPS
outside local development. It depends on the relying-party hostname and the
server-side credential record. Disposable previews reset those records on clean
rebuild, so an authenticator's saved credential cannot sign in after that reset.
