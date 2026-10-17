# Feature Specification: First Releasable Payload Bay Alpha

**Feature Branch**: `feat/12-releasable-alpha`
**Created**: 2026-10-13
**Status**: Alpha product implemented with scoped verification; organization/metering foundation extension F01–F12 planned on 2026-10-16, not yet implemented. Broader release gates remain open.
**Architecture decision (2026-10-13)**: Next.js/Node.js, PostgreSQL, Graphile Worker, Better Auth, Bun tooling and prebuilt Docker releases. HeroUI and API-first SSE selected; inherited instance/workspace/project roles and separate ingress/processing stages approved; no Supabase backend mode. Prior single-script requirements are replaced by separate configurable ingress/processing stages.

**Input**: A self-hostable, designed for a later edge-ingress adapter programmable event-delivery platform. Users own all provider logic, routing and middleware; Payload Bay manages execution, durable acceptance, attempts, retries and replay. Each endpoint has editable ingress logic and worker-executed processing logic, sharing ordinary helpers.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Install and access the instance (Priority: P1)

An operator installs a versioned container release, creates the owner once, signs in and configures the instance without a required central cloud account.
**Independent Test**: Clean-host install, owner bootstrap, passwordless email-code login using released artifacts.
**Acceptance Scenarios**:

1. **Given** empty supported infrastructure, **When** setup completes, **Then** health/configuration are visible and owner bootstrap completes exactly once with recoverable partial failures.
2. **Given** private administration, **When** anonymous or inactive-user access occurs, **Then** access fails without leaking credentials/private events.
3. **Given** configured SMTP login mail, **When** the operator requests an email login code, **Then** the documented passwordless flow succeeds without revealing account existence. Public registration remains disabled.

### User Story 2 — Own and publish endpoint code (Priority: P1)

An operator selects a code template or starts blank, edits ordinary TypeScript including helpers, tests it and publishes an immutable revision. Shared code is reusable across scripts.
**Independent Test**: Publish a custom verification/response script, invoke it, edit a draft and confirm active behavior changes only on publication; roll back.
**Acceptance Scenarios**:

1. **Given** a template, **When** it is selected, **Then** its actual code/helpers are copied and remain editable; no hidden provider-specific platform behavior is activated.
2. **Given** an active revision, **When** its draft/template/shared-module source changes, **Then** already-published behavior does not silently change.
3. **Given** a script with its own verification/challenge logic, **When** a request arrives, **Then** published code determines the exact response under lifecycle/resource guarantees.

### User Story 3 — Accept through ingress and deliver through processing (Priority: P1)

A dispatcher runs endpoint ingress code and middleware. Accepted event and processing job commit before the provider response. A worker later runs the pinned processing code/middleware, awaits destination.send and records its final outcome.
**Independent Test**: A controlled sender receives its configured response while the processing script later sends custom payloads to an app and an analytics/chat receiver.
**Acceptance Scenarios**:

1. **Given** a valid event, **When** the script acknowledges it, **Then** original event/revision/recoverable processing work is committed before provider success; later processing does not hold open the provider response.
2. **Given** protocol-only challenge handling, **When** code responds with plain text, **Then** bytes/status/content type are correct and a protocol response is not falsely recorded as an event delivery.
3. **Given** verification failure or invalid script result, **When** processing runs, **Then** no unaccepted event is falsely acknowledged.
4. **Given** app-required/chat-optional policy, **When** app succeeds and chat fails, **Then** final handler result follows user policy while each destination's actual outcome stays visible.
5. **Given** a persistence failure, **When** acknowledgement is attempted, **Then** no success is sent and accepted data/work is rolled back.

### User Story 4 — Reuse middleware and custom routing (Priority: P1)

Users configure shared middleware at instance/organization/workspace/project/endpoint scopes with explicit order and failure policy. Code can use a default destination, configured destination or custom HTTP destination, transform payloads and fan out.
**Independent Test**: A shared processing middleware records event metadata, then processing code sends to its selected application; required/optional failure policies are observable.
**Acceptance Scenarios**:

1. **Given** selected scoped middleware, **When** a request runs, **Then** configured revision/order is reproducible and optional failure does not silently become required failure.
2. **Given** published routing logic, **When** event data selects a destination, **Then** user-owned code controls the decision; no finite platform provider catalog restricts it.
3. **Given** configured localhost/LAN/100.x/public/domain/tunnel endpoints, **When** reachable from the sending runtime, **Then** address category alone does not reject them. Localhost/container topology is documented accurately.

### User Story 5 — Recover and replay (Priority: P1)

Operators inspect accepted events, handler runs and individual attempts; recover temporary outages; deliberately replay retained events.
**Independent Test**: Crash/restart a controlled run at defined boundaries, fail one destination, restore it and inspect automatic recovery/explicit replay.
**Acceptance Scenarios**:

1. **Given** successful provider acknowledgement, **When** execution dies before finishing, **Then** recoverable work remains and is retried according to a documented replay/checkpoint contract, without pretending arbitrary JS resumes at its previous instruction.
2. **Given** a recorded successful managed send, **When** the same run recovers, **Then** stable operation identity avoids blindly creating it again; remote-success/local-record-loss remains an explicit duplicate window.
3. **Given** terminal failure, **When** replay is requested, **Then** a new execution identity preserves previous history and recorded code/replay policy.
4. **Given** lost scheduling/expired ownership, **When** recovery runs, **Then** unfinished work survives and stale workers cannot overwrite newer results.
5. **Given** no delivery alert rule, **When** deliveries fail, **Then** no failure notification or email is generated; the reusable notification inbox still supports instance-scoped isolation advice.
6. **Given** an explicit project/ingress-route rule with count1 and optional SMTP subscription, **When** its first matching managed delivery fails, **Then** one scoped incident appears and only authorized subscribed recipients receive its summary.

### Edge Cases

Invalid/missing verification; malformed/binary bodies; exact challenge bytes; code timeout/exception/invalid result; response already sent; expired request timestamp during replay; time/random/secret/shared-module changes; direct external side effects; partial fan-out; destination timeout/failure; bounded resources; queue/database rollback; lost wake-up; stale lease; unauthorized access; private payload/secret exposure. The runtime contract must resolve recovery semantics before implementation rather than hide these cases.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Provide an independently installable, pinned container alpha; no mandatory central account or optional Runner dependency.
- **FR-002**: Protect administration/private data with authenticated active-user checks; public ingress does not grant administrative/database access.
- **FR-003**: Provide a small dashboard for endpoint code/configuration, destinations, health and event/run/attempt inspection. Administrator-code-selected HTTP/HTTPS addresses are not restricted by address category.
- **FR-004**: Users MUST own verification/acceptance behavior. Generic HMAC and deliberately unverified examples are editable code presets, never hard-coded platform provider modes or missing-secret fallbacks.
- **FR-005**: Preserve original request bytes and needed private runtime context; deliberately transformed payloads retain original/provenance and published revision identity.
- **FR-006**: Persist accepted event/receipt/revision and durable recoverable execution work atomically before successful event acknowledgement. Protocol-only responses are explicitly distinguished.
- **FR-007**: Provide bounded tracked HTTP delivery from a runtime with destination reachability; define hosted/edge and installation-local placement before implementation.
- **FR-008**: Provide delayed retry, explicit failure policy, fenced ownership and lost-scheduling/expired-run recovery.
- **FR-009**: Promise at-least-once external effects honestly; document receiver deduplication and direct custom side-effect limitations.
- **FR-010**: Expose immutable history, actual destination outcomes, final handler outcome and distinguishable operator replay.
- **FR-011**: Bound payload/execution/network resources; keep private bodies/secrets out of general logs and public responses.
- **FR-012**: Document and exercise supported install/restart/backup/restore/upgrade paths before alpha release.
- **FR-013**: Copy versioned templates including their ordinary helpers into editable handlers; no built-in verifyProvider/buildDiscord or finite runtime provider registry. Users/community can define templates.
- **FR-014**: Support separate endpoint ingress and processing scripts with fixed typed lifecycle registration, scoped middleware and shared modules; provider responses follow acceptance commit and processing returns explicit outcomes.
- **FR-015**: Support awaitable destination.send returning actual managed attempt outcome for default/named/code-selected HTTP destinations; keep individual attempts distinct from handler success.
- **FR-016**: Define execution/revision/action identity and recovery semantics so recorded completed actions are reused; intentional replay creates a new run. Do not promise transparent continuation of arbitrary JS state.
- **FR-017**: Support draft/test/publish/rollback, pinned compatible dependencies and bounded isolated execution with controlled capabilities/secrets, proven on supported runtime modes.
- **FR-018**: Support shared/global code modules/functions; publishing pins dependency revisions and does not silently mutate active handlers.
- **FR-019**: Support instance/organization/workspace/project/endpoint-scoped user middleware with explicit order, versioned bindings and configurable required/optional failure behavior. Permission inheritance follows instance → organization → workspace → project.

### Shared deployment foundation — confirmed 2026-10-16

- **FDN-001**: Self-hosted, first-party hosted and demo deployments use the same product codebase, API contracts, schema/migration lineage and coordinated release artifacts. No separate hosted dashboard/backend fork. An instance is the operator boundary; a hosted customer owns an organization containing workspaces and projects, without receiving instance administration.
- **FDN-002**: Self-hosted standard product features have no subscription-based workspace/project/event quotas and require no central billing account or license heartbeat. Normal capacity, payload, rate and execution safety bounds still apply. Optional enterprise licensing is a separate future capability decision; existing standard features must not be silently reclassified or gated by this foundation work.
- **FDN-003**: Future hosted subscription policy resolves per organization in shared server-side domain services, independently of user-role authorization. The dashboard, external API, MCP and workers must not have separate plan rules. Limit definitions, prices, billing provider, metering units/periods and enterprise capabilities are deliberately not selected yet.
- **FDN-004**: Hosted limits cannot silently discard acknowledged events or cancel committed delivery/recovery work. Future concurrent quota enforcement must be atomic, and plan changes must preserve retained history and outstanding obligations. Demo reset/network policy is separate from commercial entitlement policy.

- **FDN-005**: Introduce Organization above Workspace before alpha release, including organization membership, scoped ownership, default self-hosted setup, idempotent verified-customer onboarding and invitation admission without global-role escalation. A user may join multiple organizations or a single project.
- **FDN-006**: Record durable, payload-free organization-attributed usage facts and counters locally for ingress, logical executions/replays, processing attempts, managed delivery attempts and terminal outcomes. Preserve identities under retry/recovery and totals under payload retention; no billing provider or telemetry dependency.
- **FDN-007**: Implement shared server-side organization policy with commercially unlimited self-host defaults, atomic configurable resource/admission ceilings and lease-backed work-capacity enforcement. Capacity deferrals do not exhaust retries. Accepted work survives quota changes; another organization makes bounded progress under a busy neighbor.
- **FDN-008**: Verify cross-organization data access across APIs, aggregates, SSE, tokens, code/secrets/publications and workers; do not certify public hostile-tenant hosting from role checks alone. Build the registration-policy/onboarding path without enabling public production registration by default.

The current alpha scope now includes tenancy, onboarding, local metering, policy
and capacity foundations. Payments, commercial license activation, paid plan
catalog and production hosted security/operations certification remain separate.
See [tenant/metering contract](contracts/tenant-metering.md) and
[n8n research](research-n8n-foundation.md). Runtime implementation of this extension
is pending; the existing workspace/project engine does not yet implement it.

### Key Entities

Installation/admission/grants, Workspace and Project scopes; Endpoint; Draft, StageRevision, SharedModuleRevision and Publication; MiddlewareRevision/Binding; Event/Receipt; Execution/Dispatch; ManagedOperation and DeliveryAttempt; SecretVersion, PlatformJob, Audit and ChangeRecord. Names match data-model.md and plan.md. Do not create extra repositories or speculative entity scaffolds. Default routes are optional convenience, not the only processing path.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Clean installation, owner access/configuration and first programmable delivery pass using only documented release artifacts.
- **SC-002**: Original JSON/binary fixture bytes remain exact; unchanged-forward fixtures stay byte-identical; explicit transformations match user-code fixtures; rejected inputs create zero accepted work; challenge responses match expected status/bytes/content type.
- **SC-003**: All acknowledged-event crash/restart/lost-scheduling scenarios retain recoverable work and produce observable outcomes under the declared recovery contract.
- **SC-004**: Template/edit/test/publish/shared-code/middleware/fan-out/retry/terminal/replay scenarios pass with distinct revision/run/destination history.
- **SC-005**: Anonymous/inactive access, invalid verification, unsafe response/rendering and secret-leakage fixtures fail as specified.
- **SC-006**: Each applicable acceptance case has one owning executable route and complete passing final evidence; empty selections are not passes. Publish latency/load claims only after measurement.

## Assumptions

Focused alpha Auth scope: one-time owner setup and email-code login via SMTP, passwords disabled by default and public registration disabled. Supported OAuth providers enable through valid environment configuration. Roles/custom permission editing are planned; instance/workspace/project grants inherit downward. Users control provider behavior through code; Payload Bay controls lifecycle and records actual outcomes. Runner/status-page integrations remain optional. Approved backend: integrated Next.js/Node.js, PostgreSQL, Better Auth and Graphile Worker; no Supabase backend mode.

## Behavior and delivery scope

First alpha includes the plain editor/template/shared-code/middleware and two-stage programmable flow, plus durable acceptance/delivery/recovery and independent installation. No new provider catalogue, required external connector, general workflow designer or arbitrary infrastructure expansion is implied. Existing master is scaffolding; the Supabase spike is unmerged evidence, not a released product. Technical implementation follows design review and authorized SpecKit tasks/TDD, not this specification edit.

## Confirmed application, code and access requirements

- **FR-020**: Provide a versioned API-first dashboard/API using Zod schemas and locally bundled Scalar/OpenAPI, shared server-only authorization, cookie/token transport and future MCP-compatible capability scopes.
- **FR-021**: Provide one authenticated SSE change subscription with reconnect/backfill and permission revocation; do not require polling to see event/job updates.
- **FR-022**: Default to SMTP email-code sign-in, public registration/passwords disabled; support atomic owner bootstrap, scoped invitation acceptance/cancellation, and optional user-registered passkeys with email-code recovery. Supported OAuth providers enable only from complete operator configuration.
- **FR-023**: Role/custom-permission grants inherit instance → every workspace/project, workspace → child projects, project → itself. Admission alone grants no global data access; protect last-owner/transfer and grant escalation.
- **FR-024**: Each endpoint binds a complete editable Ingress module with named HTTP method exports and a separate Processing body with a protected lifecycle wrapper. The generated dispatcher returns 405 for unsupported methods. Monaco diagnostics and server publication validation reject missing/invalid entrypoints; shared modules/middleware are versioned and pinned.
- **FR-025**: Prompt delivery to healthy destinations is independently measured from provider acknowledgement. Continuous workers, critical priority/reserved capacity and visible queue age prevent bulk background backlog from silently delaying critical events for minutes.
- **FR-026**: Use the saved HeroUI Pro theme via canonical brand CSS with provenance, bundled fonts/assets and no runtime theme/font-CDN requirement.

Each project can own multiple endpoints. Ingress returns accept/reject/protocol-only; accepted event/work commits before provider success. Processing runs when claimed and returns complete/retry/fail. Raw request bytes remain immutable; attempts and operator replay have distinct histories.

Middleware order is instance → organization → workspace → project → endpoint, with explicit stage/order/failure policy. Authorized child overrides/copies follow the parent binding's override policy. Mandatory control-plane authorization is never user-overridable. Templates contain normal copied code/helper modules, not hidden provider behavior.

Future scope: edited-payload replay (derived event preserves original), collection-only policy UI, status-page pause automation, custom cleanup hooks, edge ingress and local pulling Runner. Alpha includes ordinary replay including successful events, endpoint pause/resume, shared modules/middleware and custom processing. API/MCP architectural compatibility does not claim a full MCP server shipped in alpha.

Acceptance evidence for inherited-role/OTP/API/SSE/editor behavior and fixture latency/recovery thresholds is tracked in preflight.md and tdd/cycle-log.md. The specification describes required behavior; it does not certify release readiness.

## Notification inbox foundation (confirmed2026-10-14)

- **FR-027**: Provide a reusable scoped notification backbone with typed producers, durable deduplicated incidents, per-user read/dismiss state, authorized SSE and severity/count presentation. Initial isolation advice must use this backbone, not hard-coded conditional UI. Instance-only notices stay instance-admin-only.
- **FR-028**: Delivery failure notifications have no active global/project defaults. Explicit workspace-wide or project/ingress-route/optional-destination rules select failure signal, count/window/severity and opt-in SMTP recipients; count1 can alert on its first matching failure. Repeated conditions/retries do not flood users, and access is checked before email sending. Version checks and active endpoint probes are later producers.

Terminology: ingress route is the user-facing receiving endpoint; existing Endpoint domain/API maps to it. Destination is an outgoing target; notification inbox is alerts only. See proposals/notification-inbox.md for the modular service contract, rules, dismissal and icon research. This is design, not a built inbox.

### Maintainer dashboard review alignment — 2026-10-15

The review confirms contextual desktop/mobile navigation, a real published-route
playground separated from synthetic tests, aggregate authorized events with
workspace/project/state filters, named HTTP-method ingress scripts, helper/secret
tables, pending invitations with verified acceptance, workspace-wide rules,
personal SMTP preferences and passkeys. See [the UX review](../../docs/ux-audit.md)
and [navigation](../../docs/dashboard-navigation.md) for implemented interactions.
This supersedes the body-only ingress editor description in earlier planning.
Version alerts and endpoint health checks remain deferred.

### Maintainer review clarification — 2026-10-15

The authenticated home is an operational overview, not the project inventory.
Show authorized ingress/acceptance outcomes, processing and outgoing attempt
metrics with recent activity. Apply project UI/UX principles in
`docs/ui-ux-rules.md`: separate global/resource navigation, contextual task groups,
search across accessible resources/settings, ancestor breadcrumbs, mobile drawer
hierarchy browsing, collection tables and context-preserving bounded dialogs.

Persist bounded active-route requests with valid reject or response-only outcomes
for inspection, without accepted receipts or delivery work. Accepted events retain
atomic event/receipt/job commit. The incoming request identity stays stable;
outgoing attempts, including retries, each have their own history row. Replaying
for delivery is restricted to accepted events. Provider challenges remain
response-only unless the configured script explicitly accepts them.


### Maintainer scope and source clarification — 2026-10-16

Opening navigation within a resource shows only that resource's task groups,
expanded initially. Menu Back changes its scope without leaving the working page;
breadcrumbs provide actual page ancestry. Do not duplicate a Browse hierarchy.
Use distinct workspace/project icons and a separate clearable cross-resource
command search with explicit Jump to results.

Ingress and processing source can import real named/default helper exports from
`@shared/HelperName` directly. No separate helper-binding screen is required.
Resolve new imports on save to the nearest authorized immutable helper revision,
retain saved pins on subsequent edits, and pin them in publications/queued work.
Processing/middleware full modules retain a checked async default lifecycle export;
its descriptive function name is not the runtime dispatch identity. Monaco exposes
available module paths and exported types, and formatting preserves native source.
