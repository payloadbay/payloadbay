# Payload Bay Core Constitution

## Core Principles

### I. Understandable, Small Deliverables

Explain what changes, why it helps and how it will be checked before substantial
work. Describe component roles and the request/data flow when architecture is
involved. Deliver one working product flow at a time. Add services, abstractions
and repository boundaries only when a concrete requirement needs them. Keep
proposed behavior distinct from implemented code and experiment evidence.

### II. Durable, Honest Delivery

The intended flow is Provider → bounded ingress handling → atomic PostgreSQL
event and job commit → Graphile Worker → isolated processing code → HTTP target
→ recorded attempt result. Persist the event and its durable delivery work before acknowledging the
provider. Preserve original request bytes for verification and delivery. Promise
at-least-once delivery; receivers remain responsible for duplicate handling.
Test rejection, crash, retry and recovery behavior as well as successful delivery.

### III. Authorization and Backend Ownership

The approved foundation is an integrated Next.js/Node.js application, PostgreSQL,
Graphile Worker and Better Auth. Domain commands and authorization are shared
server-only services. Auth libraries do not automatically isolate domain data. Instance admission,
workspace ownership and project roles are distinct; role grants inherit down
instance → workspace → project. Enforce resource-scoped
authorization across API, live streams and future MCP.
User-authored code requires a validated executor boundary without application
Docker socket access. Keep privileged credentials out of browsers and scripts.
Public API contracts must not accidentally expose internal
table layout. Preserve append-only applied migration history. Propose architecture
changes explicitly before substituting another backend or infrastructure layer.

### IV. Test-First Behavior

For new or changed runtime behavior, observe a meaningful failing test before
implementation. Fixes first reproduce the defect. Make the smallest passing
change, then refactor while relevant tests remain green. Broken setup, missing
dependencies and empty selections are not valid Red evidence. Use isolated local
services and fixtures; never depend on production credentials or shared mutable
state. Infrastructure receives executable checks; prose-only changes need none.

### V. Fast Feedback and Complete Evidence

Use the smallest verified whole-file or scenario check during development without
full coverage overhead. Run affected suites for broader feedback and broaden
unknown dependency boundaries. Before completion, run every applicable final gate
from the plan. Each test has one execution owner and can support multiple valid
requirements. Split independent full-validation lanes only with resource isolation,
explicit concurrency budgets, complete test/report inventory and merged coverage
threshold enforcement. Preserve checks and thresholds rather than trading them
for speed. Do not claim a product test suite or baseline exists until verified.

### VI. Source-Verified Navigation and Ownership

Use an existing, current Graphify graph for broad architecture and dependency
navigation when the tool/skill is available. Verify source locations against the
current checkout, use `rg` for exact searches or missing/stale graph coverage, and
avoid rebuilding the graph for every edit. Shared preset source is maintained in
`payloadbay/.github` and distributed through Repository Baseline. This repository
owns its constitution, specs, plans, tasks, verified test commands and graph state.

## Engineering Constraints

- Use Bun workspaces and the existing lockfile for product dependencies/scripts.
- Keep application, worker and shared package directories separate; add them when
  their implementation begins. Do not create empty future architecture scaffolds.
- Runner remains separately released; moving it requires an explicit decision.
- Keep secrets, private payloads, local environments and machine state out of Git.
- SpecKit executes Python helpers with the verified project interpreter and
  PyYAML dependency. Use `python` or `py` on Windows if `python3` is unavailable.
  Codex is the initial integration; the shared preset supports Claude switching.

## Development Workflow

1. Agree a concrete outcome through the existing GitHub-first issue process.
2. Specify the smallest complete flow, its acceptance and failure/recovery cases.
3. Plan against actual repository code and verified tooling, not the README's
   future directory tree. Establish missing test capability before behavior work.
4. Put behavioral tests before implementation tasks and use Red → Green → Refactor.
5. Keep test evidence, affected checks and applicable final gates explicit.
6. Report what changed, why, observed results and remaining limitations.
7. Commit focused changes, run CI and follow the existing squash-merge process.

## Governance

This initial constitution applies the maintainer-approved shared preset while
preserving `AGENTS.local.md` architecture boundaries. Amendments require an
explained proposal and maintainer agreement. Major versions change incompatible
principles; minor versions add obligations; patch versions clarify wording.
Every review checks compliance. Exceptions state scope, reason and compensating
evidence. Refreshing a shared preset does not itself amend this constitution.

**Version**: 2.2.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-13
