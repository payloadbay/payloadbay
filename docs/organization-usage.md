# Organization usage and local policy

Usage is collected locally in self-hosted installations as well as future hosted
installations. No external billing, licensing or telemetry service is required.
These operational metrics are not a price list or a definition of billable work.

## Reading usage

Organization navigation exposes **Usage and limits** under Observe and
troubleshoot. It shows a selected UTC window, lifetime counts and the current
organization policy. A project-only member cannot inspect its parent
organization's aggregate usage.

`GET /api/v1/organizations/{organizationId}/usage?from=...&to=...` requires
`metadata.read` on the organization. Both bounds must be UTC ISO timestamps
ending in `Z`, and the end must follow the start. The start is included and the
end is excluded. No implicit billing period is selected by the API.

The response includes `organizationId`, `from`, `to` and `metrics`. Each metric
has `window` and `lifetime` decimal strings so JavaScript does not lose integer
precision. Missing activity is represented by zero, not a missing metric.

| Metric | Meaning |
| --- | --- |
| `ingress.recorded` | A durably recorded incoming request, including rejected or response-only requests |
| `ingress.accepted` | An accepted request committed with its receipt and execution |
| `execution.created` | A new logical execution, including a deliberate replay |
| `execution.replayed` | The replay subset of created executions |
| `processing.attempt.started` | A successful fenced worker claim |
| `delivery.attempt.started` | An actual managed HTTP attempt recorded before sending |
| `execution.succeeded` | An execution committed as successful |
| `execution.failed` | An execution committed as terminally failed |

Retries do not create another logical execution. A cached successful managed
operation does not create another HTTP attempt. A recorded attempt cannot prove
remote receipt across a network or process crash. Direct script `fetch` is not
invented as a managed delivery metric. Older event history is not automatically
backfilled into a verified usage ledger.

## Local limits

`GET /api/v1/organizations/{organizationId}/policy` requires the same organization
visibility. `PUT` requires instance-level `settings.manage`, even when the caller
owns the organization. Cookie requests also pass the normal origin/CSRF checks.
The write body contains `expectedVersion`, `limits` and `processingConcurrency`;
the route supplies the organization ID. Stale writes return a version conflict.
Each successful write appends an immutable policy revision and audit record.

`limits.workspaces` and `limits.projects` are integer ceilings or `null` for
unlimited. `limits.admission` is `null` or an explicit `{limit, from, to}` UTC
window. It does not reset itself. A future or expired configured window does not
silently become unlimited. Clearing then reapplying the same window preserves
accepted usage from that window.

Self-hosted defaults have no commercial resource/admission ceilings and use four
organization processing slots. Zero processing slots pauses new claims. Missing
or malformed policy in persisted hosted mode fails closed; hosted commercial
activation and policy provisioning are later work.

Resource creation and acceptance serialize under the organization transaction
lock. A rejected over-limit request remains visible as ingress, but creates no
receipt, execution or dispatch. Already accepted work is retained when a limit
changes. Processing capacity is separate from acceptance limits: a saturated
organization gets a delayed fresh offer without spending a processing attempt.
This claim gate alone is not a guarantee of scheduling fairness.

The behavior inventory and cycle log track remaining fairness, destination
capacity, retention and release verification. Do not treat these controls as
certification for running mutually hostile public tenants.

## Processing and destination capacity

New queue offers carry a server-derived organization flag. Critical and bulk
worker lanes select eligible organizations in durable turn order before asking
Graphile for a job. Current execution leases still enforce capacity atomically
at claim time, so concurrent workers cannot use a scheduling turn as authority.
Idle selection uses the worker's bounded polling cadence. The selector uses the
supported public job view and flags API; local job batching remains disabled by
the pinned Graphile default. The policy selector reads the organization flag set
per turn; large hosted fleets need separate load validation.

Existing unflagged offers remain eligible without rewriting job IDs, payloads or
generations. They do not acquire a retroactive fairness guarantee. New offers and
recovery generations receive organization flags through the same enqueue path.

Managed sends reserve destination capacity before creating their attempt or
starting HTTP. The current configured destination concurrency applies when the
same project still owns that destination; the pinned publication value is the
fallback for retained targets. Custom managed HTTP targets use four slots per
project and normalized URL. Cached successful operations return without reserving
another slot or incrementing attempts.

An open attempt occupies capacity only while its matching execution generation
has live authority. Completion, retry or expiry frees that authority without
deleting attempt history. A stale worker cannot release a replacement's slot or
commit its result. This does not make external HTTP exactly once: a response lost
in a crash may be sent again, and an already-issued request cannot be withdrawn
by a database fence.

A destination at capacity raises `destination_capacity` before any HTTP attempt;
the configured script owns how to handle or retry that operation. The script has
already started, so its actual processing attempt remains recorded. This differs
from organization pre-claim deferral, which runs no script and consumes no
processing attempt.
