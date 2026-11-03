# n8n research and Payload Bay foundation decision

Research date: 2026-10-16. Payload Bay inspected at `291f3e0`.
n8n master revision observed during source inspection:
`d0cb5821630e1b4ef2c623eefb09c42cde4df59a`.
This is source research and an implementation design, not completed runtime work.
No n8n source is copied into Payload Bay.

## What n8n actually separates

### Product editions, capabilities and quotas

The same self-hosted product can run Community or unlock licensed features.
Its `LicenseState` exposes boolean capabilities separately from numeric ceilings,
with explicit defaults. Product services read this local state rather than
embedding checkout logic in execution handlers.

Sources:
[edition documentation](https://docs.n8n.io/deploy/host-n8n/community-edition-features),
[LicenseState](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/backend-common/src/license-state.ts).

Do not equate all self-hosting with unlimited paid usage: current pricing also
assigns execution allowances to paid self-hosted plans. The published Business/
Enterprise overage policy permits continued execution with commercial follow-up;
it is not simply a kill switch at zero remaining executions. Resource ceilings,
concurrency and execution allowances are distinct policy choices.

Source: [current plans and quota FAQ](https://n8n.io/pricing/).
Payload Bay deliberately differs: standard self-hosting has no commercial quota;
no artificial resource ceiling or central account is required to use standard
features. Enterprise capabilities remain undefined and do not justify gating
existing alpha features now.

### Activation and renewal

The `License` integration supplies an SDK with certificate persistence, renewal,
feature-change callbacks and aggregate metrics. Main instances perform reporting
and renewal; workers use the available certificate state instead of independently
contacting the license service on every execution. Public configuration also
supports an ephemeral certificate. These are useful dependency boundaries, not
a reason to adopt n8n's SDK or operate a license server now.

Sources:
[License integration](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/license.ts),
[configuration](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/config/src/configs/license.config.ts).

Official documentation supports activation through UI/environment and separately
issued certificates for cases such as air-gapped deployments. Expiry, renewal,
offline grace and downgrade behavior need an explicit future enterprise contract;
an environment boolean or client-submitted plan name is not license validation.

Source: [license administration](https://docs.n8n.io/deploy/host-n8n/configure-n8n/manage-your-license).

### Usage collection and retained counters

n8n gathers user/workflow counts and production/manual/root execution totals from
repositories for its license metrics callback. Its execution-statistics service
classifies completed outcomes; PostgreSQL appends deltas and a separate bounded
rollup folds them into totals. This keeps collection separate from product UI and
avoids making a dashboard query the only durable counter.

Sources:
[license metrics service](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/metrics/license-metrics.service.ts),
[metrics repository](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/db/src/repositories/license-metrics.repository.ts),
[statistics service](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/services/workflow-statistics.service.ts),
[rollup](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/services/workflow-statistics-rollup.service.ts).

Its billable predicate distinguishes execution mode, status and source. It is not
one counter for every internal task: manual/internal/integrated runs differ from
root production work, and the inspected predicate includes retry mode. These are
n8n-specific commercial semantics, not Payload Bay's billable-unit definition.

Source: [billable execution predicate](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/backend-services/src/executions/is-billable-execution.ts).

Payload Bay will collect operational facts locally on every deployment. It will
not send self-hosted usage, payloads, workflow identifiers or secrets to a central
service as part of this foundation. Future licensed reporting is a separate
explicit contract. Metering is not telemetry and is not an invoice.

### Atomic resource limits and runtime capacity

Team-project creation passes the current ceiling into a repository operation
that counts, creates the project and assigns its administrator in a serializable
transaction. This matters: a separate UI/count check races under simultaneous
requests. The concurrency service separately controls execution capacity, and
Cloud documentation describes excess execution work waiting for capacity.

Sources:
[project service](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/services/project.service.ee.ts),
[project repository](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/db/src/repositories/project.repository.ts),
[concurrency service](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/concurrency/concurrency-control.service.ts),
[Cloud concurrency](https://docs.n8n.io/deploy/use-n8n-cloud/understand-concurrency.md).

### Ownership and onboarding are not cloud provisioning

The inspected user repository creates a personal project and ownership relation;
the invitation path can supply a surrounding transaction. The generic repository
also contains a non-transactional fallback, so it is not evidence that every n8n
user creation path is atomic. The public signup component validates an invitation
token. Neither is proof that the public repository contains the complete Cloud
account/subscription/provisioning system.

Sources:
[user repository](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/@n8n/db/src/repositories/user.repository.ts),
[user invitation service](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/cli/src/services/user.service.ts),
[signup component](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/packages/frontend/editor-ui/src/features/core/auth/views/SignupView.vue).

n8n project access controls organize shared-instance resources. They must not be
used as proof of mutually hostile tenant isolation, and this research did not
verify n8n Cloud's infrastructure/control-plane implementation. Payload Bay must
prove its own tenant boundary, including its configurable script/network runtime.

### Reuse boundary

Learn the architectural patterns; implement Payload Bay's own code. n8n's root
license distinguishes Sustainable Use code and `.ee` enterprise code. This
research does not change Payload Bay's license or establish a right to copy n8n's
commercial implementation into a hosted product.

Sources: [root license](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/LICENSE.md),
[enterprise license](https://github.com/n8n-io/n8n/blob/d0cb5821630e1b4ef2c623eefb09c42cde4df59a/LICENSE_EE.md).

## Current Payload Bay gaps verified in source

- `ScopeRef`, grant checks and ancestry stop at instance/workspace/project.
- `createResource` requires instance permission to create a workspace. It is not
  a customer organization-provisioning flow.
- OTP signup is disabled. The authenticated principal expects active admission;
  a verified onboarding identity needs narrowly scoped access before dashboard
  admission, not a broad anonymous bypass.
- New invitees currently require instance `members.admit`; organization owners
  need a scoped invitation/admission path without global grants or the ability
  to reactivate an operator-suspended account.
- No PostgreSQL row-security policies are present. Domain authorization is real,
  but project-only preview checks do not certify all cross-tenant surfaces.
- Overview counts depend on retained event/execution rows; no independent usage
  ledger exists. Deleting/pruning those rows must not erase future usage totals.
- Workers reserve critical/bulk/platform lanes, not per-organization fairness.
  Destination concurrency is stored but is not enforced in `managedSend`.
- Notification adapters and branding are instance-owned. Organization-owned
  adapters/secrets need a controlled extension of that catalog.

## Selected foundation now

The maintainer confirmed Instance → Organization → Workspace → Project.
Organization is the customer/company and future subscription owner. Insert this
layer before release; do not rename workspace to organization or fork the engine.
One organization may own several workspaces, each with several projects. A user
may join several organizations and may be invited only to a project.

Implement organization-aware ownership, onboarding, local metering, local policy
and work-capacity enforcement in the alpha foundation. Keep payment checkout,
subscription syncing, remote enterprise activation and production Cloud rollout
for later. The old H01 deferral was too broad and is superseded by the foundation
tasks and [tenant/metering contract](contracts/tenant-metering.md).

## Alternatives considered

- Defer all tenancy/metering until billing: rejected; loses durable attribution
  and forces later scope/ownership changes.
- Separate hosted product/database model: rejected; duplicates behavior and
  migration/release work.
- Treat organizations as workspaces: rejected after maintainer confirmation;
  companies need multiple workspaces.
- Copy n8n's instance-level license/usage model directly: rejected; our policy is
  organization-owned, standard self-hosting is unlimited and no SDK is selected.
- Charge for retries by incrementing a generic job counter: rejected; retries,
  replay, claims and logical executions have different identities.
- Declare hosted security because IDs are UUIDs or RLS is enabled: rejected;
  ownership constraints, authorization, runtime isolation and negative tests are
  all necessary. If RLS is added, roles/pool context/worker behavior must be tested;
  table owners and BYPASSRLS roles otherwise bypass it.

PostgreSQL reference:
[row-security roles and default-deny behavior](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
