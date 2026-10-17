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
| First-party hosted | We own the instance; each customer owns an organization | Future organization plans may limit projects/events or other defined resources |
| Demo / PR preview | Shared disposable installation with scoped test accounts | Reset and effect restrictions, independently of hosted billing |

Unlimited self-hosting means no artificial subscription quota. Resource capacity,
request size, execution deadlines and security/rate protections still apply.
Moving between deployments must not require a different event schema or script
language. A supported customer export/import migration still needs its own
implementation and validation; sharing a schema does not prove portability.

## Three independent decisions

1. Authorization: may this user/service perform the action at this scope?
2. Entitlement: does the organization's commercial policy permit the operation?
3. Runtime safety: under what resource, network and isolation policy can it run?

A larger plan does not grant administrator permissions. Workspace owners never
become instance administrators merely by signing up or paying. Client controls
are explanatory; domain services enforce policy for all entry points.

Self-hosted entitlement resolution must remain local, with the full standard
feature set and no billing-provider availability dependency. A future hosted
billing adapter updates local organization entitlements; event handling does not
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

Current alpha foundation implementation is now required for organization lifecycle,
local policy, metering and work limits (F01–F12). No payments, remote licensing or
production public registration is enabled by this design. Hosted commercial
integration and independently validated hostile-tenant runtime/egress/operations
remain later release gates. See the detailed contract linked below.

## Foundation scope correction

The later maintainer decision supersedes the earlier workspace-as-customer model:
Instance → Organization → Workspace → Project. Organization is the future
subscription owner. Organization lifecycle, tenant tests, local metering/policy
and work-capacity enforcement move into current alpha foundation tasks F01–F12;
H01 now defers only commercial integration and hosted production rollout.
See [tenant and metering contract](tenant-metering.md) and
[n8n research](../research-n8n-foundation.md). These are planned contracts, not
completed runtime functionality.
