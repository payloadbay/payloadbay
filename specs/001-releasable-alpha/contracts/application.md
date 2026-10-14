# Application/API contract v1

Design artifact. Next Route Handlers under /api/v1 and future MCP call shared server-only services. Initial server reads call those services directly. No Server Action public protocol. Zod definitions drive public types/validation/OpenAPI; raw ingress is an independent byte-preserving interface.

## Authentication and authorization

Better Auth handlers live under /api/auth; default Email OTP with SMTP. Request-code response generic regardless of admitted account existence; normalized email, code expiry5min, maximum5 verification attempts, request/resend limit documented/configurable. Hash stored OTP, expiry-aware durable SMTP jobs; no logging code. New request invalidation/resend behavior verified against selected version. No automatic signup. One-time /api/v1/bootstrap requires server-held operator setup secret plus verified email; concurrent claims cannot create two owners. Invitations supply admitted identities/scoped grants, not anonymous signup.

Browser session cookies: secure deployment flags, origin/CSRF validation for commands. API token: Bearer token, stored hash, explicit scope/expiry/revoke; no token in URL. Effective permission = token grant intersect current admission/user inherited grants. Immediate inactive/revoked checks; every list/detail/mutation and SSE backfill checks scope. 401 unauthenticated, 403 insufficient rights; conceal inaccessible resource existence consistently.

## Routes and commands

| Route family | Operations / permission |
|---|---|
| /workspaces, /workspaces/:id/projects | list/create/update/archive; scope grant and owner rules |
| /projects/:id/endpoints | create/list/configure; endpoint configure |
| /endpoints/:id/drafts/:stage | GET/PATCH body/shared bindings; draft read/edit |
| /endpoints/:id/test | POST synthetic fixture dry-run; code test and relevant payload/secret use |
| /endpoints/:id/publications | POST validate/publish; GET history; publish rollback as new activation |
| /projects/:id/destinations | list/create/update/test; separate destination/secret rights |
| /projects/:id/events, /events/:id | cursor list metadata; body endpoint requires payload read |
| /events/:id/executions, /executions/:id/attempts | execution and actual destination history |
| /events/:id/replay | POST new execution; original publication default, explicit current publication audited |
| /endpoints/:id/pause, /endpoints/:id/resume | POST controls new processing claims; inflight may finish |
| /scopes/:kind/:id/middleware, /shared-modules, /templates | scoped code/bindings/copies; parent override rights |
| /scopes/:kind/:id/members, /grants, /ownership | admitted identities, preset/custom grants, scope ownership |
| /tokens | create/list/revoke current authorized API grants; plaintext shown once |
| /installation/settings, /health, /jobs, /audit | privileged config/health/job visibility scoped to rights |
| /api/openapi.json, /docs/api | installation-local machine contract and Scalar; no remote credential proxy |
| /api/v1/live | one authenticated multiplexed SSE stream |

Names describe resource families; implementation may use explicit scoped routes rather than ambiguous kind/id polymorphism, preserving these semantics. PATCH drafts/config includes If-Match/version; mismatch returns409/412, never last-write-wins. Publish request includes draft versions and expected active publication; all compilation succeeds before atomic switch. Replays accept idempotency keys scoped to actor/event; same key/different input is409. Mutations return resulting identifiers/version and correlationId.

Cursor pagination uses stable createdAt/id or monotonic change ID, bounded limit (default50,max200), filter schemas and opaque cursors. Errors: {error:{code,message,fieldErrors?,correlationId}}; no stack/SQL/secrets. Test/publish diagnostics add {sourceId,line,column,severity,code,message}; source maps refer to editable body/shared modules. Contract mismatches never silently publish.

## SSE

Content-Type text/event-stream, no-store; event kinds event.accepted,execution.changed,attempt.completed,configuration.changed,health.changed,resync-required. Payload includes scoped resource references/minimal allowed metadata, not raw private bodies. id is durable monotonic cursor. Last-Event-ID reconnect replays authorized retained changes then streams new ones without gap; outdated cursor produces resync-required and client refreshes authorized HTTP view. Heartbeat15s, bounded output/subscribers/backfill. Never trust client-supplied scope without permission checks; role/token revocation terminates stream and blocks backfill. NOTIFY/polling wakeups do not replace durable change records. Validate TLS proxy buffering/timeouts. Multiple tab/session behavior bounded.

## Acceptance evidence

Generated OpenAPI agrees with actual schemas/routes and Scalar executes local token-authenticated calls. Cross-scope grants and revoked tokens cannot read list/detail/payload/live. OTP/resend/bootstrap races and generic responses tested. Draft conflicts/publish errors preserve prior active revision. Paused ingestion continues, ordinary successful/failed event replay creates new history. API/MCP future shares domain services; full MCP OAuth server is later work.

## Notification API design extension

/api/v1/notifications provides authorized cursor list/detail and per-user read/dismiss. Project rule routes configure opt-in count/window/signal/severity and eligible SMTP subscriptions with optimistic version checks. No rule creation or email subscription is implicit. notification.changed SSE carries authorized incident references/redacted metadata. Instance notices never leak to project-only users. Producer schemas are server-only, registered/versioned and validated; notification inbox components never poll environment flags as a parallel condition system. See proposals/notification-inbox.md.
