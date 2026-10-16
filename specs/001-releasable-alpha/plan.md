# Final implementation plan: Payload Bay releasable alpha

**Date:** 2026-10-13 · **Actual Git branch:** `docs/first-alpha-plan` · **Feature:** `001-releasable-alpha`
**Specification:** [spec.md](spec.md) · **State:** product design consolidated; implementation and executable evidence not yet delivered.

## 1. Product and stack

Build one independently installable event-delivery application. The dashboard is a purpose-built product, not a table editor. No required Payload Bay cloud account. Supabase experiments are historical evidence; no second Supabase backend mode.

| Component   | Selection and responsibility                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Application | Next.js App Router, React, TypeScript, production Node.js; dashboard and API together                                  |
| UI          | HeroUI Pro (`@heroui-pro/react`) with its required base packages; Monaco for TypeScript editing                        |
| API         | Route Handlers, Zod contracts, generated OpenAPI, locally bundled Scalar at `/docs/api`                                |
| Realtime    | One authenticated multiplexed SSE subscription; cursors, reconnect/backfill, heartbeats                                |
| Database    | PostgreSQL; `pg` and Drizzle for typed domain access and append-only SQL migrations                                    |
| Identity    | Better Auth; default email OTP via SMTP; supported OAuth providers enabled by environment                              |
| Jobs        | Graphile Worker; event/job transaction, priorities, reserved capacity, retries                                         |
| Scripts     | Self-hosted workerd executor; fresh process per execution, capability broker; standard Docker default, optional gVisor |
| Tooling     | Bun package manager and unit-test runner; Node/container integration and Playwright browser tests                      |
| Deployment  | Published pinned Docker images and Compose; operator never installs Node/Bun or runs npm scripts                       |

Installed pins: Bun 1.3.14; Node 22.23.3 verified locally; Next.js 16.4.0, React/ReactDOM 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3, HeroUI base 3.2.6, Pro 1.0.0-beta.10 and Inter Variable 5.3.0. Planned package pins resolved from registry 2026-10-13: Graphile Worker 0.18.0, Better Auth 1.7.7, Drizzle ORM 0.45.4 / Kit 0.31.11, pg 8.23.1, Zod 4.6.7, Scalar Next.js 0.12.10, Monaco 0.57.0, Playwright 1.64.0 and Nodemailer 10.1.0. These planned dependencies are not installed or compatibility-tested. PostgreSQL 17 and executor image patch/digest pins are foundation deliverables verified through real image resolution, not invented digests.

## 2. Deployment and source ownership

One release coordinates web, worker, executor, schema, SDK and public contract versions. Web and worker may use the same application image with different internal entrypoints; Compose starts them. PostgreSQL and executor have separate image roles. Do not embed Docker or mount its socket. Optional pulling Runner remains independently released in its existing repository.

Planned paths (create when implementation starts): `apps/web`, `apps/worker`, `apps/executor`, `packages/domain`, `packages/contracts`, `packages/script-sdk`, `deploy`, `scripts`. Current web source is `apps/web/src/app`; @/* resolves there, @types to src/app/types.ts. Explicit Node scripts use Webpack; production standalone HTML/CSS checks passed. Brand theme.css snapshot/checksum matches canonical brand export; Inter is local. Shared preset/SpecKit baseline remains central; constitution/spec/plan/contracts/test profile remain Core-owned.

Self-hosted and hosted product use the same release artifacts. The complete hosted product includes its dashboard, not only a hosted database. Localhost destinations refer to the sending runtime; all configured HTTP/HTTPS address categories are allowed when reachable. Delivery uses installation/network-local trusted orchestration, not a mandatory edge-only sender. Future edge ingress needs a separately tested adapter and durable database round trip; Node does not imply global edge deployment.

## 3. Request and delivery lifecycle

1. Public request reaches a configured project endpoint. Capture original bytes once and resolve published revisions.
2. Reserved executor capacity runs ingress middleware, then endpoint ingress code under a short deadline.
3. Code returns one typed decision: reject, protocol-only response, or accept with event and proposed response.
4. On acceptance, a single PostgreSQL transaction stores original request, derived data/provenance, pinned code/middleware revisions and Graphile job. Only after commit is the success response emitted.
5. Continuously running workers promptly claim due processing jobs. No scheduled batching delay in the normal path.
6. Processing middleware and the processing body execute in the script executor. Managed sends are performed by the broker/orchestrator, with actual HTTP outcome and immutable attempt history.
7. Processing result determines success, retry or retained terminal failure. Provider acknowledgement cannot be changed by later delivery failure.

Protocol-only challenges do not create a delivery job unless explicitly accepted. Rejects create no accepted event/work. Bounded diagnostic records may remain subject to redaction/retention. Database failure never produces a false successful acceptance.

## 4. Code editing model: two stage modules, checked lifecycle contracts

Each project can have multiple endpoints, each binding **Ingress** and
**Processing** revisions. The 2026-10-15 maintainer review changes ingress to a
complete editable TypeScript module with exported HTTP-method handlers:

```ts
export async function POST(ctx: IngressContext): Promise<IngressDecision> {
	return ctx.accept({
		event: { body: ctx.request.body, contentType: ctx.request.contentType },
		response: { status: 202, body: "Accepted" },
	});
}

export async function GET(ctx: IngressContext): Promise<IngressDecision> {
	return ctx.respondOnly({ status: 200, body: "Ready" });
}
```

GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS are supported; missing methods return
405 with Allow. A generated default export dispatches to the selected method.
All stage modules import real helper exports from `@shared/HelperName`. The
2026-10-16 maintainer clarification extends native source editing to processing
and middleware, with immutable revisions resolved/pinned on draft save. Existing
pins remain stable; publishing snapshots the dependency manifest.
There is no giant module mixing every lifecycle stage.

Processing uses a checked async default lifecycle function:

```ts
export default async function processEvent(ctx: ProcessingContext): Promise<ProcessingDecision> {
	return ctx.complete();
}
```

The default export gives processing/middleware a stable lifecycle identity while
allowing descriptive function names and native imports. Monaco edits complete
modules; the server checks context/result signatures and method dispatch. Hover
information comes from SDK/helper declarations. A scripting-guide modal explains
responses, durable acceptance, processing, helpers/secrets, testing and publishing.

API editing uses the same stage/body/binding representation. The ingress body is
a complete method module; processing/middleware also use complete modules in the
dashboard. Internal body-based compiler callers still receive generated wrappers. Server-side
compilation, type/dependency policy and tagged-result validation gate publication.
Editor diagnostics assist rather than enforce the boundary. Save formats with
the repository's Prettier settings; drafts never affect published executions.

### Ingress body example

Illustrative SDK contract; not existing implementation. This generic example deliberately accepts bytes. Real Twitch/Stripe verification and challenge handling are ordinary editable template code with helpers, not hidden platform functions.

```ts
return ctx.accept({
	event: { body: ctx.request.body, contentType: ctx.request.contentType },
	response: { status: 202, body: "Accepted", headers: { "content-type": "text/plain" } },
});
```

`ctx.accept` constructs a decision; it does not itself send HTTP success. The platform validates it and commits storage/work first. Other decisions are `ctx.reject(response)` and `ctx.respondOnly(response)`. Context includes immutable raw bytes/headers, bounded logs and explicitly granted secrets; no database/client credentials. Verification helpers can use WebCrypto. Ingress may use bounded fetch, but direct effects before acceptance have no durable/recovery guarantee. Tracked durable delivery belongs in Processing.

### Processing body example

```ts
const app = await ctx.destinations.send("application", {
	operationId: "application-delivery",
	body: ctx.event.body,
});

const chat = await ctx.destinations.send("notifications", {
	operationId: "notification-delivery",
	body: JSON.stringify({ text: "An event was received" }),
	headers: { "content-type": "application/json" },
});

ctx.log.info("Delivery completed", { appStatus: app.status, chatStatus: chat.status });
return app.ok ? ctx.complete() : ctx.retry({ reason: "Application unavailable" });
```

Each send returns the actual bounded HTTP attempt outcome, not enqueue success. Notifications are optional in this example, but their failed attempt remains visible. Code-selected custom HTTP destinations also use this brokered operation with stable action identity and explicit permission.

A stable operationId is unique within an execution; loops must include a stable item key. Recovery replays the same revision/input, reuses committed operation outcomes and skips already-recorded effects. It does not resume arbitrary JS locals/instruction pointers. Remote success followed by local recording failure remains an at-least-once duplicate window. Intentional operator replay creates a new execution and new operation namespace; prior history is immutable. Time/random/external-read nondeterminism must be explicitly managed or documented; untracked direct side effects are not given recovery guarantees.

## 5. Middleware, templates and future hooks

Bindings specify ingress or processing, order within scope, required/optional failure policy and version. Before-stage middleware order is instance → workspace → project → endpoint. Scope has visible inherited/effective bindings and provenance. Required ingress failures reject before acceptance; optional failures are recorded. Processing failures follow declared retry/terminal policy.

Authorized users can copy/edit/replace/disable inherited middleware where parent policy permits override. Non-overridable parent bindings require parent policy rights to change. Publishing pins effective bindings and shared modules; editing parent/template source never silently changes queued work. Template copies are locally owned code; provider catalog membership is not a runtime restriction.

Control-plane authentication/authorization is platform-enforced, never removable user middleware. Optional webhook login checks and IP-range rules may be ingress middleware. Trusted proxy/IP interpretation is installation configuration; never trust arbitrary forwarded headers.

Alpha has two lifecycle stages and middleware/shared modules. Cleanup and email are trusted jobs. Additional lifecycle hooks are future typed stage registrations; do not introduce generic arbitrary hooks or a workflow designer now.

## 6. Identity and inherited permissions

Default passwordless email code through operator SMTP, public signup disabled. One-time owner setup requires operator bootstrap secret and verified email; prevent concurrent second bootstrap. Durable mail jobs honor OTP expiry, bounded retries/resends and reserved capacity. Missing/partial SMTP or OAuth configuration produces visible configuration errors, never silent insecure fallback. Secrets are not exposed in API/UI/logs. No implicit account linking by unverified email. Magic links/passwords may become explicit configurable options later.

Roles/grants inherit instance → all workspaces/projects; workspace → child projects; project → that project. Ordinary admission is not a role granting global data access. Effective permissions union positive inherited/local grants; a child role cannot revoke parent grants. Presets Owner/Admin/Operator/Viewer plus explicit customized effective permissions. Ownership and transfer have scope and last-owner protections.

Separate metadata/payload read, replay (future edit-replay reserved), pause/resume, configure endpoints/destinations, edit/publish code, secret manage/use, role/member grants, audit and instance settings. Grantors cannot escalate beyond their own rights. A publisher can influence where accessible data is sent, so publication is privileged. API tokens and future MCP grants intersect user's permissions. Scope checks apply to lists, detail, mutations, SSE and reconnect backfill. Better Auth does not automatically secure domain rows.

## 7. API, docs and dashboard

Versioned API Route Handlers invoke shared authorized server-only domain functions. Typed browser helpers preserve function-call ergonomics. Server Component initial reads can call services directly; no API routes calling Server Actions. Zod schemas drive validation, public types and OpenAPI; validate generated documentation in CI. Raw webhook bodies are not passed through JSON schema transforms before verification.

Scalar and OpenAPI ship locally with the release; interactive requests target that installation directly. Session cookies have origin/CSRF protection; API keys are scoped, hashed, revocable and audited. No credential-forwarding external documentation proxy. Future MCP exposes the same services through scoped OAuth consent/revocation, not database access.

HeroUI screens: first-owner/setup/login; overview; workspace/project navigation; endpoints/editor/test/publish; destinations; searchable events with raw/derived views and attempt timelines; pause/resume/replay; scoped members/permissions; privileged installation/job/health settings. Metrics distinguish accepted events, queued executions, per-destination attempts and exhausted runs; denominator/time window explicit. Job admin covers emails/deliveries/replay/cleanup but is not the entire product UI.

One multiplexed authenticated SSE subscription emits lightweight authorized change records, not indiscriminate private payloads. Durable cursor/backfill, heartbeats, reconnect, permission revocation and slow-client bounds; validate proxy buffering/timeouts. Command responses and initial reads remain ordinary HTTP. No WebSocket patch dependency for alpha.

## 8. Latency, priorities and recovery gates

Fast provider acknowledgement is insufficient: a paid user must not wait minutes for a healthy application to receive a payment event. Continuous consumption and prompt executor availability are required. Reserve ingress execution independently of processing; reserve critical delivery capacity independently of email/bulk replay/cleanup. Expose project/endpoint priorities and destination concurrency. Priority does not preempt already-running jobs.

Initial release acceptance targets on a documented local/CI fixture (healthy local DB/HTTP destination, up to 10 accepted events/sec for 60 seconds, competing lower-priority backlog): p95 provider acknowledgement <=1 second; p95 acceptance-to-first-attempt <=2 seconds; no critical fixture waits >10 seconds. These are targets to prove, not current measurements, production SLAs or claims across arbitrary network latency/user scripts. Report hardware, limits, code duration, cold starts and sample counts; fail or explicitly revise targets with maintainer agreement rather than hiding backlog.

Queue-age distributions and oldest critical event are visible; alert on configured thresholds. Pause stops new claims while ingestion continues; in-flight attempts may finish. Retry exhaustion retains event/history. Destination outage necessarily delays delivery; recovery rate must avoid flooding it.

Graphile's default hard-crash locks can last hours. Product executions therefore have independent PostgreSQL leases and monotonically increasing dispatch generations. A trusted worker supervisor sweeps expired running leases and overdue unclaimed dispatch offers every 5 seconds; in one transaction it fences old authority, records recovery, increments generation and creates a new Graphile job with a fresh generation-specific key. No named Graphile queue serializes event executions, since an abandoned queue lock would block its replacement. Destination concurrency uses separate bounded product leases.

A dispatch offer has a claim deadline (initially dueAt +30s). If a Graphile worker dies after queue claim but before domain lease acquisition, the still-queued overdue offer is fenced/replaced too; paused scopes are excluded. This closes the pre-domain-claim crash gap. Each handler atomically claims the expected generation before executing; stale/duplicate jobs return without work. Every broker operation and result write verifies generation, live lease and allowed state. Managed operation identity persists across attempts; recorded successful effects are reused. A missing heartbeat permits revoking authority and scheduling a new generation, but is never treated as proof that the old process is dead. Already-sent HTTP requests cannot be revoked; at-least-once duplication remains possible.

When a supervisor observes its actual child exit, it may additionally use supported `force_unlock_workers` for that child's recorded exact Graphile worker IDs. Never unlock a live/suspected worker or edit Graphile private tables. Whole-container death/partition does not require unlocking unknown IDs to make domain execution progress: a new healthy supervisor requeues fenced expired executions. Retain/clean old queue records through supported APIs and separate retention policy. OTP/other critical platform work uses an equivalent product-job generation record; expired email codes are never sent after recovery.

Gate: orphaned event work is claimable within 60 seconds after a healthy replacement worker/database/executor are available, including whole-container loss. Lease duration 30 seconds, heartbeat every 5 seconds, sweep every 5 seconds are initial test parameters. No bound is promised while all workers/database are unavailable. Validate multiple sweepers, suspended/live old processes, DB partitions, stale reconnect/results and remote-success/local-commit loss. If the design fails tests, stop the recovery slice and bring evidence for a queue-specific decision; do not silently change the stack.

## 9. Script executor and dependencies

Selected engine: self-hosted `workerd`, the established V8 JavaScript/Wasm runtime powering Cloudflare Workers. It is not a new Deno version. Next.js and trusted Graphile jobs remain Node.js; Bun remains tooling. Compile TypeScript to immutable ES-module bundles before execution. Initial feasibility pin: workerd 1.20261013.1 and esbuild 0.28.2, tested only in a disposable local probe; product dependencies/images are not installed yet.

Approved deployment (2026-10-14): ordinary restricted Docker is the default, with no host preparatory scripts. Optional host-installed gVisor uses PAYLOADBAY_EXECUTOR_RUNTIME=runsc; unset/empty defaults to runc (UI: Standard Docker isolation). Compose selects this runtime for the executor only and passes configured mode to administrative status. Installing runsc alone does not change existing/new containers unless the deployment runtime or host default is changed. Recreate/redeploy after selection; startup cannot change its own OCI runtime. Missing explicitly selected runsc fails container creation/deployment with no automatic downgrade, before script/event execution. The application has no Docker socket and never creates per-event Docker containers. A non-running executor keeps ingress unready for successful acceptance; no first-event provisioning surprise or false success. Expose executor health separately from configured mode; no in-container claim of host attestation.

Standard mode requires the bounded executor/capability/resource tests below, not a gVisor installation. All script publishers must be trusted by the instance operator; this mode is not advertised for mutually hostile tenants. Workerd itself is not a hardened sandbox against engine bugs; optional gVisor offers additional host isolation and needs its own compatibility tests. Never silently fall back when explicitly selected runsc is absent. A VM-backed deployment is not a mandatory supported installation mode.

Administrative UX: a discreet alert indicator beside the instance/account switcher for instance administrators opens a dismissible explanation. Also show the configured isolation mode and optional setup instructions in instance settings and the code editor. No permanent global banner or recurring login modal. Explain ordinary container isolation already exists, how to install/register runsc on the Docker host, select the variable in Compose/Coolify and recreate the executor. Show configured versus host-verified/unverified state honestly; without host access the app cannot inspect the Docker runtime registry. Keep instructions inside the product for Coolify users, not solely in GitHub docs.

Dedicated non-root image, read-only base filesystem, bounded ephemeral scratch, dropped capabilities, no-new-privileges and host-enforced CPU/memory/PID limits. Build a trusted supervisor that runs a fresh workerd process per execution, kills its whole process tree on timeout, bounds inputs/logs/results/concurrency and cleans up on exit/crash. The application has no engine or container-management privileges. A shared executor sandbox is not a claim of per-workspace VM isolation; deployment documentation must state that boundary. Resource containment must protect sibling executions, including a script that never yields; ingress gets independently reserved executor capacity. Container-wide memory and V8 heap settings alone do not prove per-execution containment.

Generate workerd configuration and bindings from validated publication records, never user-provided config. Support normal bounded fetch using workerd HTTP networking and an explicitly scoped managed-operation broker binding. Direct fetch is user-controlled unjournaled work; the broker owns tracked managed sends. The broker, outside the script sandbox, performs actual HTTP delivery with installation-network reachability and checks execution identity, scope, current generation/live lease, operation digest and quotas on every request. Script inputs cannot assert their own trusted identity. Give scripts only explicitly granted secrets, never app/DB/SMTP environment credentials. No host disk bindings, subprocess/native-addon APIs or runtime remote module downloads.

Build an unprivileged publication compiler with frozen, pinned supported dependencies and source maps; no install scripts or platform secrets. Standard web APIs are the baseline. Enable only tested Node compatibility features, with versioned compatibility date/flags and editor types matching the publication manifest. Arbitrary npm/native packages and full Node compatibility are not promised. Deno APIs are not part of the SDK. Backend bridge requests/results are bounded and authenticated; late/stale operations/results are rejected by the existing execution fence.

Required proof: forbidden filesystem/SSH-key writes, process spawning, credential access, native/import bypasses, direct network attempts, forged/cross-scope broker calls, timeout/memory/output exhaustion, sibling availability and executor restart cleanup. Verify the standard Docker restrictions and distinguish optional configured gVisor mode from host attestation; tests cannot prove absence of engine/kernel vulnerabilities. Keep runtime and host sandbox patched.

Local feasibility evidence (2026-10-13): TypeScript bundle, WebCrypto raw-body HMAC acceptance/rejection, exact plaintext response, backend service binding returning HTTP outcome, and denied global outbound requests passed. This used a temporary host process/mock backend, not gVisor, real database, recovery or production sandbox validation. Sources: https://github.com/cloudflare/workerd , https://developers.cloudflare.com/workers/runtime-apis/nodejs/ , https://gvisor.dev/docs/user_guide/quick_start/docker/ .

## 10. Persistence, retention and upgrade

Domain records: Installation/Settings; identity and scoped grants; Workspace; Project; Endpoint; immutable stage/shared-module/middleware revisions; Destination; raw Event/Receipt; Execution; stable ManagedOperation; DeliveryAttempt; audit and live-change cursor; secret references and product JobHistory. Queue tables are not permanent event history. Bound retention and preserve unfinished recovery work. A nullable derived-event provenance relationship supports future edited replay; no edited-replay UI/API ships in alpha.

Append-only SQL migrations; validate empty install and forward upgrade. Expansion-compatible schema changes precede new images, preserving older queued job and code revisions. Release manifest coordinates roles; mixed-version execution is either tested or explicitly disallowed. Single migration job with locking, backup/restore exercise, health/readiness gates and documented rollback limits. No destructive downgrade promise. Replace legacy scaffold tooling in scoped implementation; do not rewrite applied experiment history as if production never existed.

Runtime lifecycle: maintainer confirmed workerd in place of the earlier Deno proposal. Pin engine, bundler, compatibility date/flags and sandbox runtime in the release manifest; retain old publication revisions for pending/replayed events and test upgrades against them. Keep the lifecycle SDK/broker ABI independent of engine internals. Deno's announced maintenance horizon is historical decision evidence, not an active release dependency.

## 11. Implementation sequence and test ownership

1. Explicitly bootstrap T001–T006 outside `$speckit-implement`: pinned dependencies, fixture/build tooling, genuine test commands, image/default-container preflight, then `$speckit-tdd-setup` and `$speckit-tdd-plan`. Keep the mandatory implementation TDD hook enabled; invoke implementation only after its profile/test-list prerequisites exist. Foundation T011 owns dependency-complete domain DDL before lease tests; later stories implement services against those tables. No fictitious TDD profile.
2. Prove executor restrictions/SDK contract and fast fenced hard-crash recovery before spreading assumptions.
3. SMTP owner bootstrap, identity/grants and authorization matrix.
4. Atomic ingress/queue, pinned processing, real HTTP attempt history and prompt dispatch.
5. Retries/pause/replay, partial fanout, shared modules/middleware and publication workflows.
6. Complete product/admin dashboard, Scalar/API and authorized SSE.
7. Clean prebuilt-image installation, pending-job upgrade, backup/restore and release evidence.

Behavior changes follow meaningful Red → Green → Refactor. One owning execution route per test. Whole-file/scenario local checks without coverage; dependency-aware affected feedback; isolated final unit/component, Node/PostgreSQL integration, executor, browser and install/migration lanes. Unique ports/data per lane and explicit concurrency budget. Reuse reports/coverage rather than rerun tests; enforce complete test/file inventory and thresholds. Verify Bun coverage enforcement on pinned version, including unloaded files and intentional failing thresholds. Node integration catches Bun/Node differences.

Acceptance covers rejection/challenge bytes, atomic rollback, healthy-delivery latency under backlog, outage buffering, retries/exhaustion/replay, successful-event replay, action journal recovery, crash at HTTP/local-commit boundary, inheritance/escalation, live backfill/revocation, publish signature errors, documented standard-container protections, optional gVisor deployment selection and supported upgrade. No empty selection counts as passing. Bootstrap tests/profile/list now exist; alpha domain/application acceptance tests remain pending.

## 12. Constitution and completion

Constitution 2.2.0 and Core guidance reflect the authorized architecture. Product choices are resolved. Remaining pins, commands, resource limits, supported dependency set and recovery implementation are explicit foundation verification tasks. Shared baseline unchanged. This plan does not authorize publishing a release or assert implementations/tests have passed.

Next SpecKit stage: derive tasks and TDD acceptance inventory from this plan; begin scoped foundation implementation only under the repository issue workflow. No new repositories/worktrees, no generalized multi-backend layer and no extra framework merely for terminology.

## 13. Constitution check and actual repository evidence

Pre-research and post-design gates: PASS for architecture ownership, coherent scope, durable acceptance/at-least-once contract, scoped authorization, isolated user code, append-only migrations and documented failure evidence. No constitution exceptions requested. Implementation gates are not satisfied by planning: exact image resolution, dependency compatibility, lease recovery, resource containment and behavioral tests must pass before release.

Existing files: apps/web source/config/scripts, worker dependency manifest, Bun lock/manifests, bootstrap deploy targets/fixtures/test tooling, verified TDD profile/list, Supabase legacy CLI config/status helper, constitution/SpecKit/TDD and a graph indexing the old scaffold. Do not use stale graph claims as current architecture. No app database/worker/executor/API/auth product suite exists. Pro MCP/CLI and theme export succeeded; CI HEROUI_AUTH_TOKEN remains absent. Use fixture SMTP/generated local auth secrets during development; real operator mail and CI credentials remain deployment prerequisites.

Verified current commands: `bun run web:typecheck`, `bun run web:lint`, `bun run web:build`; standalone local HTTP/CSS smoke. Full builds required permission for Next child processes in this workspace. Bootstrap commands now verified: bun run test (13 passed,0 failed,20.94s), test:file, test:affected, test:coverage, test:inventory and tooling:typecheck. These are bootstrap evidence, not passing alpha acceptance. Coverage is tooling-policy only; product suites remain unimplemented. The profile records runner ownership, capabilities and limits. Sandbox:check now passes in default runc mode; explicit runsc selection fails before startup on this host. Clean licensed CI build and trusted worker image remain pending. before_plan/after_plan hooks: none registered. Tasks originally contained103 items; the documented notification extension adds T104–T114 (114 total), preserving all IDs. T001/T003/T004/T005 completed through explicit bootstrap; T002 partial; T006 default mode verified, optional runsc execution unverified. Test-list originally recorded18 acceptance/166 inner and1 shell characterization; the notification extension now brings it to20 pending acceptance/180 pending inner and1 shell characterization; baseline cycle log only.

## 14. Acceptance-to-test ownership

Planned test routes below do not exist yet; each suite owns its cases once implemented. Tags/coverage may reference multiple requirements without duplicate execution.

| Owner route                             | Acceptance / requirements                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| tests/unit/policy.test.ts               | Grant union, scope resolution, middleware override/order, tagged decisions; FR002/019/023                                            |
| tests/unit/contracts.test.ts            | Zod/OpenAPI/error/publication validation, fixed wrappers and source-map locations; FR014/020/024                                     |
| tests/integration/config.test.ts        | Production configuration and browser-bundle credential exclusion; FR002/011/022                                                      |
| tests/integration/database.test.ts      | Domain schema, recovery-table dependency integrity, migration lock/rollback/equivalence; FR006/008/012                               |
| tests/integration/publication.test.ts   | Server draft conflicts, revision pinning, template/synthetic tests and secret-version capabilities/revocation; FR004/013/017/018/024 |
| tests/integration/middleware.test.ts    | Runtime patches/short-circuit/failure policy, scoped shared-code CRUD and custom routing capability integration; FR007/015/018/019   |
| tests/unit/notifications.test.ts        | Opt-in threshold boundaries, distinct-operation counts and severity selection; FR027–028                                             |
| tests/integration/notifications.test.ts | Typed incident producers, scoped recipients/read/dismiss/SSE, optional SMTP and rule filtering; FR027–028                            |
| tests/integration/auth.test.ts          | Bootstrap races, admission/invites, OTP expiry/resends, config and API-token grants; US1/FR022/023                                   |
| tests/integration/ingress.test.ts       | Exact bytes/challenge, invalid verification, rollback, event/job/publication pin; US3/FR004–006                                      |
| tests/integration/delivery.test.ts      | Actual HTTP outcomes, fanout, pause/retry/terminal/replay/action digest; US3–5/FR007–010/015–016                                     |
| tests/integration/recovery.test.ts      | Child/container death, generation fencing, partitions, old results, successful-effect journal; US5/FR008–009                         |
| tests/integration/live-api.test.ts      | API authorization, scalar document parity, cursor/backfill/revocation; FR020–023                                                     |
| tests/executor/isolation.test.ts        | Import/filesystem/secret/native/network/IPC/resource attacks, sibling availability; FR011/017                                        |
| tests/acceptance/dashboard.spec.ts      | Product flows, body editor publish/test diagnostics, theme, replay/admin views; US1–5/FR003/013/018/024/026                          |
| tests/performance/delivery.test.ts      | Ack versus delivery target, critical capacity under replay/email backlog; FR025                                                      |
| tests/deployment/installation.test.ts   | Published-image install, migrations, pending-job upgrade, backup/restore; FR001/012                                                  |

The table above is the complete owner inventory. scripts/tests/inventory.ts must reconcile discovered tests against it and reject missing, unowned or multiply owned final executions. Each owner distinguishes primitive unit assertions, real server transactions and browser interactions; complete OpenAPI/route parity belongs to live-api after API generation.

Inner loop runs owning whole files/scenarios without coverage. Affected selection broadens when dependency impact unknown. Final lanes run each owning suite once with unique DB/ports/output paths and tested concurrency limits; coverage/report artifacts reused/merged and complete inventory enforced. Bun line/function/report quirks require deliberate failing-threshold tests. Preserve Node production integration and browser accessibility checks instead of relying on Bun-only results.

## 15. Modular notification inbox

Confirmed design is in proposals/notification-inbox.md. Typed producers feed a shared server-only notification service; durable incident reconciliation, scoped recipient state, authorized SSE and optional SMTP are reusable from alpha. The runc advisory is one producer, not a React-only if/else banner. Version checks/active endpoint health probes are future producers. No failure alerts or threshold rules are active by default. Explicit project/ingress-route/destination rules can choose count1, signal/window/severity and opt-in mail. Scope, retry dedupe, per-user dismissal and capacity protections are acceptance gates. Use ingress route in UI; retain Endpoint schema/API identity to avoid an incidental rewrite. Confirmed icon library: `@tabler/icons-react` (2026-10-14). Bundle static imports locally; use outline icons by default and filled variants where available for emphasis. Installation belongs to UI implementation; no CDN or paid icon dependency.

Additional owner: tests/integration/notifications.test.ts owns incident reconciliation, opt-in rules, recipient/revocation/SMTP transaction behaviour; tests/unit/notifications.test.ts owns pure threshold/severity selection; existing dashboard acceptance owns actual inbox controls. Code paths: packages/domain/src/notifications.ts, packages/contracts/src/notifications.ts, apps/worker/src/tasks/notifications.ts, apps/web/src/app/api/v1/notifications/ and apps/web/src/app/components/notification-inbox.tsx. No separate service framework.

## Maintainer workflow corrections (2026-10-14)

- Page-specific interactive screens live in client `page.tsx` modules. Components
  are reusable controls/layout; server/client boundaries are separate modules
  only when genuine server-only work requires them.
- Match Clipify Prettier tabs/JSX single quotes/500-column width and local editor
  preferences; schema properties remain multiline. ESLint plus tsc are gates.
- Drizzle source is authoritative for table structure. Development uses db:push;
  release migration generation belongs exclusively to master CI after merge,
  normally one migration per merged schema/database-behavior change.
- Role/function/history-trigger source is included by CI in that same release
  artifact. Test-only legacy upgrade fixtures preserve migration-mechanism
  evidence. No deployed or committed release migration is rewritten.
- The first CI-generated release artifact and its image upgrade/install gates
  remain unverified until the workflow runs; missing artifacts fail readiness.

## Maintainer dashboard review addendum — 2026-10-15

The implemented follow-up is recorded in [the UX review](../../docs/ux-audit.md).
Account security includes optional passkeys through Better Auth (HTTPS hostname
or localhost required by WebAuthn), with SMTP codes retained for recovery.
Invitations keep selected scoped grants pending until the matching verified
identity accepts, rechecking current issuer authority; cancellation is supported.
Instance views include admitted users, while workspace/project tables show direct
and inherited memberships. No project invitation grants parent access.

Notification rules can belong to a workspace (aggregate descendant operations)
or project (optionally route/destination-specific). Personal SMTP opt-in is
separate from shared thresholds. No failure notifications or subscriptions are
implicitly enabled. Preview seeding publishes only its fixed demo route, executes
synthetic ingress through workerd and stores real receipts/jobs; reruns preserve
existing edited source/publications. CI still owns release migration generation.

### Approved review addendum — 2026-10-15

Follow `docs/ui-ux-rules.md` for composition and `docs/ux-audit.md` for the current
screen review. Persist valid rejected/response-only ingress requests for history
without accepted receipts/jobs; keep retries as distinct outgoing attempts, not
new ingress records. Existing immutable event rows gain outcome/method/response
metadata, defaulting old records to accepted. Development uses db:push; no feature
branch release migration is generated. Overview aggregates and search obey the
same metadata authorization as event/resource lists. Bounded active-route handler failures/invalid outcomes are retained as error
records. A pre-handler ledger for unknown/oversized requests or process crashes
before outcome recording is not included in this addendum.
