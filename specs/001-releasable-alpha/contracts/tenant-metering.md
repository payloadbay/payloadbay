# Organization, usage and local policy foundation

Confirmed design 2026-10-16; runtime implementation is pending the F01–F12 tasks.
This extends the alpha foundation, not payment infrastructure.

## Tenant and permission boundary

Hierarchy: Instance → Organization → Workspace → Project → Endpoint.
An organization owns the customer/company boundary and future subscription.
A workspace groups projects within one organization. An authenticated person may
belong to several organizations, or only a workspace/project. Admission to the
instance is not an instance role and is not membership in every organization.

An organization has id, installationId, name, slug, ownerUserId, archivedAt.
A workspace has a required organizationId, with a composite ownership constraint
when installationId is also retained. Workspace live slugs are organization-local.
Endpoints, events, executions and managed attempts have unambiguous tenant lineage;
immutable usage records snapshot that lineage at the time of the fact.
Cross-organization resource movement is unavailable in alpha; it needs a later
explicit transfer/export operation, not editing a parent ID.

Positive role grants inherit instance → organization → workspace → project.
Organization owner/admin rights affect descendants, never sibling organizations.
A child grant does not reveal parent settings or aggregate private resources.
Operator instance roles intentionally cross tenants and stay unavailable to normal
registration. Preserve last-owner protection and optimistic grant updates.

All collections, direct-ID reads/mutations, search, analytics, secret resolution,
helper imports, middleware, publication pins, tokens, notifications, invitations,
SSE cursor backfill and worker/broker effects require the same tenant lineage and
current permissions. A selected organization ID is navigation context, not proof
of membership. Ordinary users cannot choose the organization for another user's
queued job or read global statistics merely by requesting an aggregate endpoint.

Database ownership constraints and negative tenant tests are required. Do not
claim database row security while using unrestricted role credentials or missing
request context. A future RLS implementation must use verified per-transaction
context, proper non-owner/non-BYPASSRLS application roles and scoped worker access;
RLS does not replace command authorization or isolate script/network execution.
The hosted release remains blocked until its independent runtime/egress boundary
and complete tenant access matrix are validated.

## Setup, registration and invitations

Self-hosted owner setup remains one-time and secret protected. Completing it
atomically creates the instance owner, a default organization and workspace.
The operator can create further organizations with the same product services.
Self-hosted public registration remains disabled by default and needs no cloud
account. Hosted/new-organization registration is a server-controlled policy;
build and test the flow now without turning it on for production by default.

A new verified customer follows identity verification → name organization → create
organization/default workspace → create first project/route. Provisioning is
idempotent under refresh, concurrent submissions and interrupted requests. It
never grants instance administrator rights. An authenticated but unprovisioned
identity may access only the narrow onboarding endpoints until provisioned.

An invited person follows verify matching email → accept selected invitation →
enter that existing scope. Do not force a second organization on project-only
invitees. Organization-scoped inviters may admit a new invitee into the authorized
scope; they cannot bypass an operator suspension, grant sibling access, alter
instance roles or reactivate globally inactive accounts. Pending membership,
expiry/cancellation and permission rechecks remain visible and auditable.

## Usage facts, counters and retention

Record usage on every deployment, including commercially unlimited self-hosting.
No metrics leave the installation as part of this foundation.

Append-only `usage_fact` has organizationId, workspaceId/projectId where relevant,
metric, sourceKey, positive bigint quantity and database occurrence timestamp.
The unique metric/source key makes insertion idempotent. It contains no payload,
HTTP body, token, OTP or secret. Counter/rollup updates happen only when a new fact
is inserted. Their canonical source is the ledger, not a UI aggregate.

| Fact | Identity | Atomic source boundary |
| --- | --- | --- |
| ingress.recorded | Event ID | Persist any recorded ingress outcome |
| ingress.accepted | Event ID | Receipt, event, execution and dispatch commit |
| execution.created | Execution ID | Initial execution or deliberate replay commit |
| execution.replayed | Replay execution ID | Additional classification, not a second logical execution |
| processing.attempt.started | Execution ID + attempt number | Successful fenced claim |
| delivery.attempt.started | Delivery-attempt ID | Persist actual managed attempt, after cached-success branch |
| execution.succeeded / execution.failed | Execution ID + terminal classification | Successful fenced terminal state transition |

Retries do not create another logical execution. Replay does create a new one.
Heartbeats, duplicate jobs, lost offer recovery, dispatch-generation changes and
cached managed-operation success do not increment logical usage. A recorded send
attempt does not prove remote receipt across the documented HTTP crash window.
Direct script fetch is not automatically a managed delivery attempt; its resource
controls remain broker/runtime policy, not invented delivery-ledger entries.

Usage facts survive payload/history pruning and retain original tenant/time
attribution. Never reset lifetime counters to implement billing periods. Usage
queries accept explicit UTC bounds; future billable policies can classify the
facts and choose a subscription window without changing event identities.
Backfill/reconciliation needs an explicit versioned cutoff and deduplication;
existing event counts must not be reported as a verified historical billing ledger.

## One local policy service

One server-only organization policy resolver returns capabilities, resource
ceilings and work-capacity policy. Commercial unlimited is explicit (`null`),
not a zero sentinel or an omitted usage collector. Self-hosted standard behavior
is unrestricted by subscription; body/runtime/memory/rate/capacity safeguards
still apply. No actual alpha standard feature is newly paywalled.

Only operator-authorized server code may modify organization entitlements. A
customer cannot post a plan name to get more capacity. Future verified enterprise
licenses and hosted billing adapters update this same local policy boundary;
no payment or license-server call belongs in the webhook request path.
No license issuer, activation SDK, pricing catalog or checkout is implemented now.

Enforce organization workspace/project ceilings at the shared creation command.
The limit check and insert/ownership grant commit together under a database lock
or equivalent serializable transaction. Test concurrent creates at the boundary.
A UI disabled button is explanatory, not enforcement. Keep policy revisions
optimistic and audit changes. Missing/invalid hosted policy must not silently
become an unrestricted production hosted tenant; self-hosted defaults are local.

Operational quotas use explicit measurement windows, not an invented monthly
billing period. If an admission ceiling is configured, quota reservation and
persistence must be atomic; exceeding it must not produce a false success ack.
Accepted events and queued recovery obligations remain retained after quota
exhaustion/downgrade. Commercial suspension does not silently delete them.

## Capacity and fairness

Acquire organization processing capacity atomically with execution claim and
lease/generation authority. A capacity deferral does not increment attempt_number
or consume retry budget. Finish, retry and lease expiry release/recover authority
without stale workers freeing a replacement's slot. Survives multiple worker
processes, restart and recovery; not an in-memory semaphore.

Retain reserved ingress/critical/platform lanes. Enforce configured destination
concurrency as a separate resource constraint. Per-organization caps alone do
not prove fair scheduling: explicitly test bounded progress for another
organization while one floods a queue, and use bounded eligible selection or
rescheduling that cannot spin. A duplicate job or expired worker must not double
reserve capacity or double count an attempt.

## Compatibility and validation

Add the hierarchy before the first release; retain an additive, non-destructive
mapping for existing alpha development data. Give existing workspaces explicit
organizations without promoting their existing scoped owners to global roles.
Preserve resource IDs, grants, secrets, published revisions, event histories and
queued jobs. For existing alpha data, map each existing workspace to a distinct operator-owned
organization, preserving workspace grants without automatic organization grants.
Apply the mapping atomically and repeatably before nonnullable constraints.
Independent owners must not be silently merged into one newly shared tenant.
Drizzle schema/runtime SQL remain authoritative; merge CI generates the release
migration, not an agent-generated sequence of release files.

Required evidence: two unrelated organizations, multi-organization user,
project-only invitee, operator, archived/suspended scopes; direct-ID and aggregate
access; token/SSE revocation; cross-tenant secret/helper/publication rejection;
worker job lineage; atomic quota create races; usage dedup/rollback/recovery/replay;
retention-independent totals; multi-process capacity recovery and bounded neighbor
progress; real first-run/invited OTP onboarding; mobile context/breadcrumb/search
and no extra setup demanded of ordinary self-hosters.
