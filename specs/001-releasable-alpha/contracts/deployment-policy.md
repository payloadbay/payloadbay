# Shared deployment and entitlement boundary

Confirmed by the maintainer on 2026-10-16. This is an architectural contract, not
an implemented billing system or a change to the repository license.

## One product

Self-hosted, first-party hosted and demo instances use the same codebase,
dashboard, HTTP/MCP business services, database schema and release lineage.
Deployments may choose different configuration and capacity without maintaining
separate product implementations. Optional enterprise capabilities may later be
licensed; their feature list and license mechanism are not selected.

| Deployment | Operator/customer boundary | Commercial policy |
| --- | --- | --- |
| Self-hosted | Operator owns the instance and its workspaces | Standard features enabled; no subscription quotas or required cloud account |
| First-party hosted | We own the instance; each customer owns a workspace | Future workspace plans may limit projects/events or other defined resources |
| Demo / PR preview | Shared disposable installation with scoped test accounts | Reset and effect restrictions, independently of hosted billing |

Unlimited self-hosting means no artificial subscription quota. Resource capacity,
request size, execution deadlines and security/rate protections still apply.
Moving between deployments must not require a different event schema or script
language. A supported customer export/import migration still needs its own
implementation and validation; sharing a schema does not prove portability.

## Three independent decisions

1. Authorization: may this user/service perform the action at this scope?
2. Entitlement: does the workspace's commercial policy permit the operation?
3. Runtime safety: under what resource, network and isolation policy can it run?

A larger plan does not grant administrator permissions. Workspace owners never
become instance administrators merely by signing up or paying. Client controls
are explanatory; domain services enforce policy for all entry points.

Self-hosted entitlement resolution must remain local, with the full standard
feature set and no billing-provider availability dependency. A future hosted
billing adapter updates local workspace entitlements; event handling does not
perform synchronous subscription-provider lookups. Enterprise capability checks
reuse this boundary once those capabilities are actually defined.

## Future hosted limits

Do not choose prices, plan IDs, billable event definitions or billing periods in
this alpha. Before adding hosted enforcement, define a durable usage contract
that distinguishes original ingress, rejected requests, managed sends, retries
and explicit replays. UI analytics are not a billing ledger.

Concurrent resource creation and event admission need atomic enforcement, tested
at plan boundaries and across retries. Over-limit admission must never return a
false durable-acceptance response. Once an event is accepted, later exhaustion,
plan downgrade or payment failure must not erase it or discard already committed
recovery work. Retention and downgrade behavior need an explicit user-visible
contract before activation.

## Implementation boundary

Present: the shared Next.js/PostgreSQL/Graphile/workerd engine, inherited
instance/workspace/project authorization, operator installation and preview-only
scoped test accounts.

Still required before a public hosted release: customer onboarding/admission,
local workspace entitlement storage/resolution, durable usage accounting and
atomic limit enforcement, subscriptions, per-workspace queue/executor fairness,
workspace-owned notification adapters/secrets, validated tenant isolation/egress,
and operational backup/export/abuse handling. This contract does not certify the
current restricted-Docker setup for mutually hostile customers.

No unused plan tables, speculative feature flags or separate hosted repository
are needed to preserve this boundary now. Implement concrete policy at the
shared domain command/event-admission boundary when its semantics are approved,
with self-hosted unrestricted behavior covered by the same tests.
