# Tasks: First Releasable Payload Bay Alpha

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/` and `quickstart.md` in this feature directory.

**State**: Implementation active under SpecKit/TDD. Preserve the existing Next.js/Pro/theme scaffold and known worktree. Check tasks only after their implementation and executable evidence exist; foundational passes do not imply completed alpha acceptance or a release.

**Tests**: Mandatory. Complete each Red → Green → Refactor/verify slice before starting the next dependent behavior. Missing packages, broken setup and empty selections are not Red. Record evidence in the extension-owned `tdd/test-list.md` and `tdd/cycle-log.md` once its verified profile exists; do not invent an alternate cycle log.

**Paths**: Next.js UI/API under `apps/web/src/app`; trusted jobs under `apps/worker/src`; sandbox supervisor/compiler under `apps/executor/src`; reusable domain/contracts/SDK under `packages`; tests under `tests`; operator artifacts under `deploy`. Keep `@/*` → `src/app/*`, `@types` → `src/app/types.ts`. Paths are implementation destinations, not existing files.

**Format**: `- [ ] Tnnn [P?] [USn?] description with exact file paths`. `[P]` permits work only after the phase prerequisites; it never authorizes parallel Red/Green steps of one behavior.

## Phase 1: Setup — explicit pre-implementation bootstrap

**Goal**: Preserve the working web scaffold and establish missing tooling before invoking `$speckit-implement`. Execute T001–T006 as a separately scoped bootstrap, not through that command. Keep the mandatory `before_implement` TDD hook enabled. Infrastructure scripts/checks still follow the constitution’s test-first and executable-validation rules; this is not a feature-code or TDD exemption.

**Independent check**: Pinned installation, genuine test collection, local disposable fixtures and application-image smoke work. T005 records successfully executed commands and creates the feature test list. The runnable tooling, profile/list and default-container preflight are verified, so `$speckit-implement` may invoke its mandatory TDD hook for T007 onward. T002 remains open for the clean licensed CI build and worker image; these are image/release gates, not a dependency blocking foundation implementation.

- [x] T001 Resolve and install plan.md package pins using Bun in package.json, bun.lock and the owning workspace manifests; preserve explicit Node web scripts and HeroUI Pro. Verify dependency compatibility, official Pro installation and credential-free final artifacts; record actual resolved versions in deploy/release-manifest.json.
- [ ] T002 Create Docker build targets in deploy/Dockerfile.app and deploy/Dockerfile.executor plus deploy/compose.dev.yml with disposable PostgreSQL17, SMTP and HTTP fixtures; resolve image patches/digests in deploy/release-manifest.json. Use no Docker socket/host mounts; distinguish development builds from operator prebuilt-image installs.
- [x] T003 Establish meaningful Bun unit/component, production Node/Postgres integration, executor, Playwright and deployment runner configurations in bunfig.toml, tests/config/ and package.json; verify fixture isolation, nonempty discovery and deliberate failing behavior. Do not count setup failures as Red.
- [x] T004 Verify scoped whole-file checks without coverage, dependency-aware affected selection, broad fallback and owning final lanes in scripts/tests/run.ts and scripts/tests/inventory.ts; test deliberate missing-test inventory and coverage-threshold failures, unloaded-file coverage and Bun metric limitations; reuse reports rather than rerunning suites.
- [x] T005 After genuine commands execute, run $speckit-tdd-setup to write .specify/memory/tdd-profile.md; then $speckit-tdd-plan to derive tdd/test-list.md and baseline tdd/cycle-log.md for this feature. Preserve task IDs/order and leave implementation checkboxes open; missing tooling is an explicit prerequisite, never a fictional green baseline.
- [x] T006 Verify default runc startup, explicit runtime validation and missing-runsc creation failure in deploy/compose.dev.yml, scripts/tests/runtime.ts and scripts/tests/sandbox.ts; record mode/host-verification limits in docs/deployment/executor.md. Default startup and missing-runtime behaviour verified2026-10-14; optional actual gVisor execution remains unavailable and is not claimed.

## Phase 2: Foundation — contracts, storage, isolation and recovery primitives

**Goal**: Prove shared technical boundaries before delivering user stories.

**Independent check**: Real PostgreSQL rollback/fencing, fixed lifecycle ABI, resource containment and scoped API primitives pass independently of dashboard flows.

### Configuration and public contracts

- [x] T007 Red: Add configuration/error/limit and Zod public-contract shape cases in tests/unit/contracts.test.ts, including rejected partial SMTP/OAuth config and redacted errors; complete generated-route/OpenAPI parity belongs to T073–T075 after API implementation, not this foundation slice; trace FR011/014/020/022. Behavior markers: [U1] [U2] [U3] [U4] [U5].
- [x] T008 Green: Implement packages/contracts/src/config.ts, packages/contracts/src/errors.ts and packages/domain/src/config.ts using Zod, bounded limits and validated server-only secrets. (after T007). Behavior markers: [U1] [U2] [U3] [U4] [U5].
- [x] T009 Refactor/verify: Rerun the owning contract file and Node configuration checks; record exact commands and ensure no credentials enter browser bundles in tests/integration/config.test.ts. (after T008). Behavior markers: [U1] [U2] [U3] [U4] [U5].

### Transactional database foundation

- [x] T010 Red: Add schema isolation, migration locking, atomic rollback, recovery-table referential integrity and upgrade-equivalence cases in tests/integration/database.test.ts; trace FR006/012. Behavior markers: [U6] [U7] [U8] [U9] [U10].
- [x] T011 Green: Implement packages/domain/src/db.ts, packages/domain/drizzle.config.ts, packages/domain/migrations/0001_foundation.sql and scripts/migrate.ts; create the domain tables in data-model.md, including Execution/Dispatch/PlatformJob and their dependency-complete installation/scope/publication/event records, indices and state constraints before T019. Physical schema belongs to this task; later stories implement domain behaviors rather than recreating these tables. Coordinate Better Auth/Graphile schema changes via supported APIs and separate least-privilege roles. (after T010). Behavior markers: [U6] [U7] [U8] [U9] [U10].
- [x] T012 Refactor/verify: Run real empty/forward migration and rollback cases in tests/integration/database.test.ts; preserve append-only applied migrations and distinguish domain from queue history. (after T011). Behavior markers: [U6] [U7] [U8] [U9] [U10].

### Fixed script contract and publication compiler

- [x] T013 Red: Add wrapper replacement/renaming, invalid union, unregistered import, shared-module binding and user-line source-map cases in tests/unit/contracts.test.ts; trace FR014/017/024. Behavior markers: [U11] [U12] [U13] [U14] [U15] [U16].
- [x] T014 Green: Implement packages/script-sdk/src/lifecycle.ts and apps/executor/src/compiler.ts with fixed default exports, editable bodies, generated imports above wrappers, immutable bundles/maps and pinned tested web/Node-compatible dependencies; no install scripts or runtime downloads. (after T013). Behavior markers: [U11] [U12] [U13] [U14] [U15] [U16].
- [x] T015 Refactor/verify: Run compiler fixtures under production-compatible tooling and diagnose errors by sourceId/line/column in tests/unit/contracts.test.ts; expose no Deno or host APIs as public SDK. (after T014). Behavior markers: [U11] [U12] [U13] [U14] [U15] [U16].

### Restricted workerd supervisor

- [x] T016 Red: Add tests/executor/isolation.test.ts cases for filesystem/SSH writes, native/process/import bypasses, credential access, direct networking, infinite loops, RSS/output bursts, cancellation and sibling ingress availability; trace FR011/017. Behavior markers: [U17] [U18] [U19] [U20] [U21] [U22] [U23] [U24] [U25] [U26].
- [x] T017 Green: Implement apps/executor/src/supervisor.ts and apps/executor/src/workerd-config.ts with fresh processes, generated offline config, bounded direct fetch and authorized broker binding; bound process tree lifetime/concurrency/scratch, non-root image and host-enforced resources in deploy/Dockerfile.executor. (after T016). Behavior markers: [U17] [U18] [U19] [U20] [U21] [U22] [U23] [U24] [U25] [U26].
- [x] T018 Refactor/verify: Run default restricted-container execution and the optional gVisor deployment-selection/failure checks in tests/executor/isolation.test.ts; measure cold-start/resource limits, preserve reserved ingress capacity and report unsupported per-run containment as a release blocker. (after T017). Behavior markers: [U17] [U18] [U19] [U20] [U21] [U22] [U23] [U24] [U25] [U26].

### Fenced broker and crash scheduling primitives

- [x] T019 Red: After T012 and T018, add real-PG expired lease, overdue unclaimed offer, multiple sweeper, stale result and forged/cross-scope broker cases in tests/integration/recovery.test.ts and tests/executor/isolation.test.ts; use persisted fixture scope/publication/event records from the foundation schema, not future public ingress/publication routes; missing tables are setup failures, not Red; trace FR008/016. Behavior markers: [U27] [U28] [U29] [U30] [U31] [U32] [U33] [U34] [U35].
- [x] T020 Green: Implement packages/domain/src/execution-lease.ts, packages/domain/src/broker-auth.ts and apps/worker/src/recovery.ts with PostgreSQL server time, 5s heartbeat, 30s lease, 5s sweep, dueAt+30s offer deadline, CAS generations and fresh generation-specific Graphile keys; no per-execution named queue or private-table unlock. (after T019). Preserve data-model.md constraints verbatim: Dispatch: "Unique execution/generation; fresh key on recovery; no per-execution named queue lock". Behavior markers: [U27] [U28] [U29] [U30] [U31] [U32] [U33] [U34] [U35].
- [x] T021 Refactor/verify: Verify scheduling/fencing before destination effects in tests/integration/recovery.test.ts; missed heartbeat revokes authority without claiming death, and force_unlock_workers is allowed only for observed-dead exact child worker IDs. (after T020). Behavior markers: [U27] [U28] [U29] [U30] [U31] [U32] [U33] [U34] [U35].

### Shared authorized HTTP boundary

- [x] T022 Red: Add transport/origin/CSRF, body limits, canonical error shape and optimistic conflict cases in tests/integration/live-api.test.ts; trace FR002/020. Behavior markers: [U36] [U37] [U38] [U39].
- [x] T023 Green: Implement packages/domain/src/request-context.ts, packages/contracts/src/api.ts and apps/web/src/app/api/v1/_lib/handler.ts plus apps/web/src/app/lib/api-client.ts; shared server-only services, correlation IDs, no routes calling Server Actions. (after T022). Behavior markers: [U36] [U37] [U38] [U39].
- [x] T024 Refactor/verify: Run HTTP boundary tests on Node in tests/integration/live-api.test.ts and verify contracts remain independent of table layout; refactor reusable handlers without weakening permission checks. (after T023). Behavior markers: [U36] [U37] [U38] [U39].

## Phase 3: US1 — install and access the instance (P1)

**Goal**: A single operator can install, bootstrap once, sign in and configure scoped access.

**Independent check**: Clean release-profile installation plus SMTP OTP succeeds; parallel bootstrap yields exactly one owner; anonymous/inactive users cannot access private data. US1 is an internal milestone, not a releasable alpha.

### Owner bootstrap and passwordless identity

- [x] T025 [US1] Red: Add tests/integration/auth.test.ts for concurrent bootstrap, verified email/operator secret, generic OTP responses, no public signup/passwords, expired mail and recovery; trace US1.1–3/FR022. Behavior markers: [U40] [U41] [U42] [U43] [U44] [U45] [U46] [U47] [U48] [U49] [U50].
- [x] T026 [US1] Green: Implement packages/domain/src/auth.ts using the T011 domain schema, packages/domain/src/bootstrap.ts, apps/worker/src/tasks/mail.ts and apps/web/src/app/api/auth/[...all]/route.ts with SMTP Email OTP; expiry5min, maximum5 verification attempts, configurable resend limits and no unverified-email linking. (after T025). Preserve data-model.md constraints verbatim: Installation: "Exactly one successful bootstrap; operator environment secrets never returned"; Identity/Session: "Identity does not imply domain membership; public signup disabled"; PlatformJob: "Trusted mail/cleanup; critical mail generation recoverable; expired OTP never sent". Behavior markers: [U40] [U41] [U42] [U43] [U44] [U45] [U46] [U47] [U48] [U49] [U50].
- [x] T027 [US1] Refactor/verify: Run auth race/expiry/resend cases in tests/integration/auth.test.ts; validate Better Auth behavior against selected version and optional OAuth complete-config behavior. (after T026). Behavior markers: [U40] [U41] [U42] [U43] [U44] [U45] [U46] [U47] [U48] [U49] [U50].

### Inherited roles and scoped ownership

- [x] T028 [US1] Red: Add grant-union tests in tests/unit/policy.test.ts and list/detail/member/token escalation/last-owner races in tests/integration/auth.test.ts; trace FR002/023. Behavior markers: [U51] [U52] [U53] [U54] [U55] [U56] [U57] [U58] [U59].
- [x] T029 [US1] Green: Implement packages/domain/src/authorization.ts, packages/domain/src/membership.ts on the T011 domain schema for admission/workspaces/projects/grants: "Unique live slug per installation", "Unique live slug per workspace", "Positive inherited grants; no child deny; grantor cannot escalate"; Owner/Admin/Operator/Viewer and customized permissions; hashed API-token creation/list/revocation routes in apps/web/src/app/api/v1/tokens/route.ts with explicit scope/expiry and token rights intersecting current user grants. (after T028). Preserve data-model.md constraints verbatim: Admission: "Unique pair; ordinary admission grants no global role"; Workspace: "Unique live slug per installation; owner admitted/active; last-owner protection"; Project: "Unique live slug per workspace; explicit scoped ownership"; Grant: "Positive inherited grants; no child deny; grantor cannot escalate"; ApiToken: "Hash only; token rights intersect current user rights"; Audit: "Append-only operator/policy history". Behavior markers: [U51] [U52] [U53] [U54] [U55] [U56] [U57] [U58] [U59].
- [x] T030 [US1] Refactor/verify: Verify transactional ownership transfers and instance→workspace→project inheritance, inactive admission and child isolation in tests/integration/auth.test.ts; publish effective permission matrix in docs/permissions.md. (after T029). Behavior markers: [U51] [U52] [U53] [U54] [U55] [U56] [U57] [U58] [U59].

### Bootstrap/access dashboard and administration

- [x] T031 [US1] Red: Add setup/login/workspace navigation/member customization and configuration-error scenarios in tests/acceptance/dashboard.spec.ts; trace US1/FR003/023/026. Behavior markers: [U60] [U61] [U62] [U63] [U64].
- [ ] T032 [US1] Green: Implement HeroUI Pro pages in apps/web/src/app/(auth)/login/page.tsx, apps/web/src/app/setup/page.tsx and apps/web/src/app/(dashboard)/layout.tsx; scoped resource/member/ownership/settings routes under apps/web/src/app/api/v1/ backed by packages/domain/src/ services. (after T031). Behavior markers: [U60] [U61] [U62] [U63] [U64].
- [ ] T033 [US1] Refactor/verify: Verify keyboard/focus/error/loading states and canonical local theme in tests/acceptance/dashboard.spec.ts; confirm metadata/payload/code/secret permissions remain distinct. (after T032). Behavior markers: [U60] [U61] [U62] [U63] [U64].

### Story acceptance completion gates

- [ ] T086 [US1] [A1] Verify acceptance US1.1 through its real entrypoint in tests/deployment/installation.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: An empty supported installation completes exactly one owner bootstrap.
- [ ] T087 [US1] [A2] Verify acceptance US1.2 through its real entrypoint in tests/integration/auth.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Anonymous or inactive access returns no private instance data.
- [ ] T088 [US1] [A3] Verify acceptance US1.3 through its real entrypoint in tests/integration/auth.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: An admitted operator signs in with SMTP email code while public signup stays unavailable.

## Phase 4: US2 — own and publish endpoint code (P1)

**Goal**: Edit and test two script bodies, copy templates/helpers and activate immutable revisions.

**Independent check**: Create endpoint, publish custom HMAC/challenge code, change draft/helper source without changing active behavior, then activate rollback; invalid publication leaves active version intact.

### Drafts, revisions and publication transactions

- [ ] T034 [US2] Red: Add draft If-Match/version conflicts, full compilation failure, atomic activation and revision-pin tests with directly seeded Execution fixtures (live event/job creation is tested in T046–T048) in tests/integration/publication.test.ts; trace US2.1–3/FR017/018/024. Behavior markers: [U65] [U66] [U67] [U68] [U69].
- [ ] T035 [US2] Green: Implement packages/domain/src/publication.ts on the T011 schema for Endpoint/Draft/StageRevision/SharedModuleRevision/Publication: "Multiple endpoints per project; publication switch atomic", "Optimistic concurrency; only bodies edited, wrapper not user-owned", "Immutable complete execution manifest; parent edits do not mutate old runs". (after T034). Preserve data-model.md constraints verbatim: Endpoint: "Multiple endpoints per project; publication switch atomic"; Draft: "Optimistic concurrency; only bodies edited, wrapper not user-owned"; StageRevision: "Immutable validated ingress/processing source"; SharedModuleRevision: "Frozen imports/dependencies; copy creates local provenance"; Publication: "Immutable complete execution manifest; parent edits do not mutate old runs". Behavior markers: [U65] [U66] [U67] [U68] [U69].
- [ ] T036 [US2] Refactor/verify: Run real-PG publication and revision-pin tests; secret revocation is owned by T040–T042 after secret management exists, not this check in tests/integration/publication.test.ts; preserve compiler/SDK/bundle/compatibility manifests and original publication default for later replay. (after T035). Behavior markers: [U65] [U66] [U67] [U68] [U69].

### Scoped secret versions and capabilities

- [ ] T040 [US2] Red: Add manage-versus-use, encrypted storage, no plaintext compilation/log/API leakage and emergency revocation of persisted queued-execution/publication fixture cases in tests/integration/publication.test.ts; trace FR002/011/017/023. Behavior markers: [U70] [U71] [U72] [U73] [U74].
- [ ] T041 [US2] Green: Implement packages/domain/src/secrets.ts on the T011 domain schema with versioned encrypted SecretVersion records, external operator key configuration, scope-authorized broker resolution and audited secret routes under apps/web/src/app/api/v1/; never give scripts unrelated platform secrets. (after T040). Preserve data-model.md constraints verbatim: SecretVersion: "Explicit use/manage rights; never in payload logs/revision plaintext". Behavior markers: [U70] [U71] [U72] [U73] [U74].
- [ ] T042 [US2] Refactor/verify: Run publication/secret revocation fixtures in tests/integration/publication.test.ts; old queued references fail visibly when revoked rather than silently using new material. (after T041). Behavior markers: [U70] [U71] [U72] [U73] [U74].

### Editable templates and synthetic test API

- [ ] T037 [US2] Red: Add copied-template independence, dry-run/no-effects, authorized real test mode and source diagnostics cases in tests/integration/publication.test.ts using the completed compiler, publication and secret services. A bounded fixture broker owns synthetic test capabilities; real managed HTTP journal integration is tested after T050, not assumed here; trace FR004/017/018. Behavior markers: [U75] [U76] [U77] [U78] [U79].
- [ ] T038 [US2] Green: Implement packages/script-sdk/src/templates/hmac.ts, packages/script-sdk/src/templates/unverified.ts, packages/domain/src/script-test.ts and apps/web/src/app/api/v1/endpoints/[endpointId]/test/route.ts; no hidden provider primitives, no missing-secret fallback and audit explicit side-effect test permissions. (after T037). Behavior markers: [U75] [U76] [U77] [U78] [U79].
- [ ] T039 [US2] Refactor/verify: Run accepted/rejected/plaintext synthetic fixtures and audit/redaction checks in tests/integration/publication.test.ts; copied helpers remain ordinary editable code. (after T038). Behavior markers: [U75] [U76] [U77] [U78] [U79].

### Two-body Monaco editor

- [ ] T043 [US2] Red: Add browser cases for fixed signatures, API-level wrapper bypass rejection, shared imports, test diagnostics, publish conflict and rollback in tests/acceptance/dashboard.spec.ts; trace US2/FR024. Behavior markers: [U80] [U81] [U82] [U83] [U84].
- [ ] T044 [US2] Green: Implement apps/web/src/app/components/script-editor.tsx and apps/web/src/app/(dashboard)/projects/[projectId]/endpoints/[endpointId]/page.tsx with Ingress/Processing/Shared/Test tabs, read-only signature chrome, generated preview and matching SDK types; notification integration uses T111 shared inbox rather than a separate isolation component; implement scoped drafts/publications routes in apps/web/src/app/api/v1/endpoints/. (after T043). Behavior markers: [U80] [U81] [U82] [U83] [U84].
- [ ] T045 [US2] Refactor/verify: Verify function-name changes cannot break stage registration and source errors point to editable lines in tests/acceptance/dashboard.spec.ts; retain body-only public edit representation. (after T044). Behavior markers: [U80] [U81] [U82] [U83] [U84].

### Story acceptance completion gates

- [ ] T089 [US2] [A4] Verify acceptance US2.1 through its real entrypoint in tests/acceptance/dashboard.spec.ts; observed passing output and the complete affected story checks are required before closing this criterion: Selecting a template copies its editable source and helpers.
- [ ] T090 [US2] [A5] Verify acceptance US2.2 through its real entrypoint in tests/integration/publication.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Editing draft or parent helper source leaves the active published behavior unchanged.
- [ ] T091 [US2] [A6] Verify acceptance US2.3 through its real entrypoint in tests/integration/ingress.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Invoking published custom verification code returns its exact protocol response.

## Phase 5: US3 — durable ingress and actual delivery (P1)

**Goal**: Complete receive → atomic storage/work → processing → tracked HTTP delivery.

**Independent check**: JSON/binary fixtures retain bytes, challenge response is exact, rollback never acknowledges, and app-required/chat-optional sends expose actual independent results.

### Atomic webhook ingress

- [ ] T046 [US3] Red: Add raw-byte/HMAC/challenge/reject/invalid-result/DB failure/body-header limit tests in tests/integration/ingress.test.ts; trace US3.1–3/5/FR004–006/011. Behavior markers: [U85] [U86] [U87] [U88] [U89] [U90] [U91] [U92] [U93] [U94] [U95].
- [ ] T047 [US3] Green: Implement packages/domain/src/ingress.ts and apps/web/src/app/ingress/[endpointKey]/route.ts; accept transaction writes Event/Receipt/Execution/Dispatch plus Graphile job before emitting response; original bytes immutable, protocol-only creates no processing work, initial body1MiB/header16KiB/ingress2s. (after T046). Preserve data-model.md constraints verbatim: Event: "Original bytes immutable; redacted metadata separate; future derivedFromEventId nullable"; Receipt: "Accepted event/execution/job in same transaction; response not emitted before commit"; Execution: "Domain lifecycle authoritative; Graphile completion does not erase it". Behavior markers: [U85] [U86] [U87] [U88] [U89] [U90] [U91] [U92] [U93] [U94] [U95].
- [ ] T048 [US3] Refactor/verify: Run exact binary/plaintext/status/content-type and rollback fixtures in tests/integration/ingress.test.ts; validate response headers/status and redact private diagnostic data. (after T047). Behavior markers: [U85] [U86] [U87] [U88] [U89] [U90] [U91] [U92] [U93] [U94] [U95].

### Journaled managed HTTP effects

- [ ] T049 [US3] Red: Add actual2xx/network-timeout/non2xx/partial-fanout/stable-ID digest conflict/recorded-result reuse cases in tests/integration/delivery.test.ts; trace US3.4/FR007/010/015/016. Behavior markers: [U96] [U97] [U98] [U99] [U100] [U101] [U102] [U103] [U104].
- [ ] T050 [US3] Green: Implement packages/domain/src/delivery.ts with ManagedOperation "Unique pair; reused key with changed input rejected; same-generation single attempt ownership" and DeliveryAttempt "Immutable actual history; bounded/redacted response storage"; no redirects, 10s HTTP timeout, configured reachable address categories allowed. (after T049). Preserve data-model.md constraints verbatim: Destination: "Address categories allowed; actual reachability sender-specific"; ManagedOperation: "Unique pair; reused key with changed input rejected; same-generation single attempt ownership"; DeliveryAttempt: "Immutable actual history; bounded/redacted response storage". Behavior markers: [U96] [U97] [U98] [U99] [U100] [U101] [U102] [U103] [U104].
- [ ] T051 [US3] Refactor/verify: Verify sender-localhost/LAN/domain behavior, bounded HTTP response storage and remote-success/local-record-loss uncertainty in tests/integration/delivery.test.ts; do not claim exactly-once effects. (after T050). Behavior markers: [U96] [U97] [U98] [U99] [U100] [U101] [U102] [U103] [U104].

### Continuous worker processing and priority

- [ ] T052 [US3] Red: Add pinned processing outcome/exception/timeout and critical event under email/replay backlog cases in tests/integration/delivery.test.ts and tests/performance/delivery.test.ts; trace FR008/025. Behavior markers: [U105] [U106] [U107] [U108] [U109] [U110] [U111] [U112] [U113] [U114].
- [ ] T053 [US3] Green: Implement apps/worker/src/main.ts, apps/worker/src/tasks/process-event.ts and packages/domain/src/dispatch.ts for generation claim/heartbeats, reserved critical/mail capacity, independently reserved ingress, destination concurrency and complete/retry/fail; initial processing30s, targetRSS256MiB, defaultmax5 bounded exponential/jitter attempts. (after T052). Behavior markers: [U105] [U106] [U107] [U108] [U109] [U110] [U111] [U112] [U113] [U114].
- [ ] T054 [US3] Refactor/verify: Measure documented10events/sec×60s fixture: p95ack≤1s, acceptance-to-first-attempt≤2s, no critical wait>10s in tests/performance/delivery.test.ts; report hardware/cold starts/counts and never silently relax failed targets. (after T053). Behavior markers: [U105] [U106] [U107] [U108] [U109] [U110] [U111] [U112] [U113] [U114].

### Destination and basic event dashboard

- [ ] T055 [US3] Red: Add destination configure/test, raw/derived event/attempt visibility and optional-send failure display in tests/acceptance/dashboard.spec.ts; trace FR003/005/010/015. Behavior markers: [U115] [U116] [U117] [U118] [U119] [U120].
- [ ] T056 [US3] Green: Implement scoped destination/events/execution/attempt routes under apps/web/src/app/api/v1/ plus apps/web/src/app/(dashboard)/projects/[projectId]/destinations/page.tsx and apps/web/src/app/(dashboard)/projects/[projectId]/events/page.tsx; bounded cursor list default50/max200, separate payload-read permission and immutable history. (after T055). Behavior markers: [U115] [U116] [U117] [U118] [U119] [U120].
- [ ] T057 [US3] Refactor/verify: Verify event list/detail authorization, escaped payload rendering and handler-versus-attempt outcomes in tests/acceptance/dashboard.spec.ts; use shared API client services. (after T056). Behavior markers: [U115] [U116] [U117] [U118] [U119] [U120].

### Story acceptance completion gates

- [ ] T092 [US3] [A7] Verify acceptance US3.1 through its real entrypoint in tests/integration/ingress.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Provider success is observable only after event and recoverable work commit.
- [ ] T093 [US3] [A8] Verify acceptance US3.2 through its real entrypoint in tests/integration/ingress.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: A protocol-only challenge returns exact bytes without creating processing work.
- [ ] T094 [US3] [A9] Verify acceptance US3.3 through its real entrypoint in tests/integration/ingress.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Verification failure or invalid ingress result creates no accepted work.
- [ ] T095 [US3] [A10] Verify acceptance US3.4 through its real entrypoint in tests/integration/delivery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: A failing optional destination remains visible without overriding successful app-required policy.
- [ ] T096 [US3] [A11] Verify acceptance US3.5 through its real entrypoint in tests/integration/ingress.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: A failed acceptance transaction never sends provider success.

## Phase 6: US4 — shared middleware and custom routing (P1)

**Goal**: Reuse ordered scope-aware code and support administrator-authored routing/fan-out.

**Independent check**: Pinned middleware executes instance→workspace→project→endpoint; optional failure retains last valid context; authorized copies/overrides and custom destinations work without provider-specific modes.

### Middleware ordering, patches and override policy

- [ ] T058 [US4] Red: Add ordered scope/stage resolution, parent required policy, optional partial-patch failure and forbidden-auth-removal cases in tests/unit/policy.test.ts and tests/integration/middleware.test.ts; trace US4.1/FR019. Behavior markers: [U121] [U122] [U123] [U124] [U125] [U126].
- [ ] T059 [US4] Green: Implement packages/domain/src/middleware.ts and packages/script-sdk/src/middleware.ts; typed atomic patches, pinned deterministic bindings, parent-controlled authorized copy/disable/replace and immutable original bytes. (after T058). Preserve data-model.md constraints verbatim: MiddlewareRevision/Binding: "Deterministic resolved order; authorized override only". Behavior markers: [U121] [U122] [U123] [U124] [U125] [U126].
- [ ] T060 [US4] Refactor/verify: Run optional/required ingress and processing short-circuit fixtures in tests/integration/middleware.test.ts; copied helpers/parent edits do not mutate queued publications. (after T059). Behavior markers: [U121] [U122] [U123] [U124] [U125] [U126].

### Custom destinations and inherited code management

- [ ] T061 [US4] Red: Add custom code-selected target capability, fanout, forbidden cross-scope secret and middleware/shared-module CRUD conflicts in tests/integration/middleware.test.ts; trace US4.2–3/FR007/015/018/019. Behavior markers: [U127] [U128] [U129] [U130].
- [ ] T062 [US4] Green: Implement packages/domain/src/shared-code.ts, packages/domain/src/destination-policy.ts and scoped middleware/shared-module/template routes under apps/web/src/app/api/v1/; reuse managed sends for named/default/custom targets with pinned config and secret references, no address-category denial. (after T061). Behavior markers: [U127] [U128] [U129] [U130].
- [ ] T063 [US4] Refactor/verify: Verify all effects retain stable operation identity and current lease authority in tests/integration/middleware.test.ts; document sender-relative topology in docs/deployment/networking.md. (after T062). Behavior markers: [U127] [U128] [U129] [U130].

### Middleware/shared-code dashboard

- [ ] T064 [US4] Red: Add browser inherited provenance/order/failure-policy/custom routing and forbidden override flows in tests/acceptance/dashboard.spec.ts; trace US4/FR018/019. Behavior markers: [U131] [U132] [U133].
- [ ] T065 [US4] Green: Implement apps/web/src/app/components/middleware-bindings.tsx and apps/web/src/app/(dashboard)/projects/[projectId]/shared-code/page.tsx with effective/inherited bindings, copy/edit/publish actions and permission-aware controls. (after T064). Behavior markers: [U131] [U132] [U133].
- [ ] T066 [US4] Refactor/verify: Verify atomic publication after changes and consistent error/focus states in tests/acceptance/dashboard.spec.ts; no extra lifecycle hooks/workflow designer. (after T065). Behavior markers: [U131] [U132] [U133].

### Story acceptance completion gates

- [ ] T097 [US4] [A12] Verify acceptance US4.1 through its real entrypoint in tests/integration/middleware.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Scoped middleware applies the published order and declared optional-failure policy.
- [ ] T098 [US4] [A13] Verify acceptance US4.2 through its real entrypoint in tests/integration/middleware.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: User-authored routing selects destinations without hidden provider restrictions.
- [ ] T099 [US4] [A14] Verify acceptance US4.3 through its real entrypoint in tests/integration/delivery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Reachable administrator-configured localhost LAN 100.x public domain and tunnel destinations deliver.

## Phase 7: US5 — recover, inspect and replay (P1)

**Goal**: Retain events through outages/crashes, pause safely and replay with distinct history.

**Independent check**: Crash at claim/send/result boundaries, partition or suspend old worker, restore destination and replay terminal/successful events; stale generations cannot send/write and prior success is reused.

### Whole-worker/executor recovery

- [ ] T067 [US5] Red: Extend tests/integration/recovery.test.ts with whole-container death, pre-domain-claim crash, concurrent sweepers, DB partition, suspended live worker, stale reconnect and HTTP/local-commit-loss scenarios; trace US5.1–2/4/FR008/009/016. Behavior markers: [U134] [U135] [U136] [U137] [U138] [U139].
- [ ] T068 [US5] Green: Complete apps/worker/src/supervisor.ts and packages/domain/src/recovery.ts using foundation fences; fresh dispatch on expired running/offer lease, exclude paused scopes, supported cleanup APIs only, trusted OTP jobs equivalent expiry-aware generation recovery. (after T067). Behavior markers: [U134] [U135] [U136] [U137] [U138] [U139].
- [ ] T069 [US5] Refactor/verify: Prove orphan work claimable≤60s after replacement services healthy in tests/integration/recovery.test.ts; successful managed effects reused, uncertain effects may duplicate; never unlock suspected-live workers or promise JS instruction continuation. (after T068). Behavior markers: [U134] [U135] [U136] [U137] [U138] [U139].

### Pause, retries, replay and retention

- [ ] T070 [US5] Red: Add paused ingress/parked dispatch/bounded resume, exhaustion, failed/successful replay idempotency and original/current-publication policy cases in tests/integration/delivery.test.ts; trace US5.3/FR008/010/016. Behavior markers: [U140] [U141] [U142] [U143] [U144] [U145] [U146] [U147] [U148].
- [ ] T071 [US5] Green: Implement packages/domain/src/replay.ts, packages/domain/src/pause.ts, packages/domain/src/retention.ts and apps/worker/src/tasks/cleanup.ts; "operator replay creates a new queued execution even from succeeded", same replay key/different input409, retained immutable attempts and unfinished-work/revision retention protection. (after T070). Behavior markers: [U140] [U141] [U142] [U143] [U144] [U145] [U146] [U147] [U148].
- [ ] T072 [US5] Refactor/verify: Run offline→retry→terminal→restore→replay and concurrency cases in tests/integration/delivery.test.ts; history outlives queue records and edited-payload replay remains deferred. (after T071). Behavior markers: [U140] [U141] [U142] [U143] [U144] [U145] [U146] [U147] [U148].

### Scoped live API and local interactive docs

- [ ] T073 [US5] Red: Add SSE no-gap reconnect, expired cursor/resync, revocation, unauthorized backfill, slow-client bounds and Scalar token calls in tests/integration/live-api.test.ts; trace FR020/021. Behavior markers: [U149] [U150] [U151] [U152] [U153] [U154] [U155] [U156].
- [ ] T074 [US5] Green: Implement packages/domain/src/change-stream.ts, apps/web/src/app/api/v1/live/route.ts, apps/web/src/app/api/openapi.json/route.ts and apps/web/src/app/docs/api/page.tsx; transactional durable cursor, NOTIFY hint, heartbeat15s, one authenticated multiplexed stream and local Scalar assets. (after T073). Preserve data-model.md constraints verbatim: ChangeRecord: "Same transaction as visible domain update; NOTIFY only hint, authorized backfill". Behavior markers: [U149] [U150] [U151] [U152] [U153] [U154] [U155] [U156].
- [ ] T075 [US5] Refactor/verify: Verify proxy buffering/timeouts, cookie/token scopes and generated docs/schema parity in tests/integration/live-api.test.ts; no raw private payload broadcast or credential-forwarding docs proxy. (after T074). Behavior markers: [U149] [U150] [U151] [U152] [U153] [U154] [U155] [U156].

### Recovery and job administration dashboard

- [ ] T076 [US5] Red: Add live status/reconnect/replay/pause and privileged job/queue-age/metrics inspection flows in tests/acceptance/dashboard.spec.ts; trace US5/FR003/010/021/025. Behavior markers: [U157] [U158] [U159] [U160].
- [ ] T077 [US5] Green: Implement apps/web/src/app/components/event-timeline.tsx, apps/web/src/app/components/live-subscription.tsx and apps/web/src/app/(dashboard)/admin/jobs/page.tsx; scoped event replay/pause routes under apps/web/src/app/api/v1/, installation health/audit/settings, factual configured isolation mode; notification attention control is implemented through the shared T104–T112 backbone, plus explicit metric denominators/time windows. (after T076). Behavior markers: [U157] [U158] [U159] [U160].
- [ ] T078 [US5] Refactor/verify: Verify successful-event replay creates a new timeline, stale client refresh is safe, lower permissions conceal payload/admin controls and offline destination history remains inspectable in tests/acceptance/dashboard.spec.ts. (after T077). Behavior markers: [U157] [U158] [U159] [U160].

### Modular notification inbox and opt-in rules (FR027–028)

- [ ] T104 [US5] Red: Add typed producer incident/deduplication/resolution, scoped API/SSE recipients and restart-persistent dismissal cases in tests/integration/notifications.test.ts; no React-only environment branch. Behavior markers: [U169] [U170] [U171] [U172] [U173] [U181].
- [ ] T105 [US5] Green: Implement packages/contracts/src/notifications.ts and packages/domain/src/notifications.ts on T011 NotificationRule/Incident/RecipientState/Dispatch tables, plus apps/web/src/app/api/v1/notifications/; active conditions reconcile durable scoped incidents and authorized ChangeRecords. Preserve per-user dismissal, validated redacted data and configured-versus-verified isolation distinction. After T104. Behavior markers: [U169] [U170] [U171] [U172] [U173] [U181].
- [ ] T106 [US5] Refactor/verify: Run owning notifications integration cases in tests/integration/notifications.test.ts; runc producer and runsc resolution use the shared backbone, no global banner or duplicate warning pipeline. After T105. Behavior markers: [U169] [U170] [U171] [U172] [U173] [U181].
- [ ] T107 [US5] Red: Add no-rule/no-email, count1, N-1/N boundary, route/destination filter, retry-count dedupe and revoked recipient cases in tests/unit/notifications.test.ts and tests/integration/notifications.test.ts. After T106. Behavior markers: [U168] [U174] [U175] [U176] [U177] [U178] [U179].
- [ ] T108 [US5] Green: Implement explicit project/ingress-route/destination rule management in packages/domain/src/notification-rules.ts and low-priority evaluation/optional SMTP in apps/worker/src/tasks/notifications.ts; no automatically active rule/threshold/subscription; >= positive count in operator-selected window; recheck current rights before channel dispatch. After T107. Behavior markers: [U168] [U174] [U175] [U176] [U177] [U178] [U179].
- [ ] T109 [US5] Refactor/verify: Verify repeat/cooldown/recovery/recipient-channel dedupe in tests/integration/notifications.test.ts; notifications cannot starve critical delivery. Version checks and active endpoint probes stay deferred. After T108. Behavior markers: [U168] [U174] [U175] [U176] [U177] [U178] [U179].
- [ ] T110 [US5] Red: Add empty/info/warning/critical control, count/accessibility, scoped read/dismiss and authorized rule-edit flows in tests/acceptance/dashboard.spec.ts. After T109. Behavior markers: [U180] [A19] [A20].
- [ ] T111 [US5] Green: Implement apps/web/src/app/components/notification-inbox.tsx beside profile/context controls and notification/rule settings under apps/web/src/app/(dashboard)/; controls read shared authorized incident services, not process.env flags. Use existing theme tokens and chosen locally bundled icon package. After T110. Behavior markers: [U180] [A19] [A20].
- [ ] T112 [US5] Refactor/verify: Run real inbox/control flows in tests/acceptance/dashboard.spec.ts and owning notifications tests; per-user dismissal survives restart and project-only users never see installation notices. After T111. Behavior markers: [U180] [A19] [A20].
- [ ] T113 [US5] [A19] Verify US5.5 through real notification API/UI in tests/integration/notifications.test.ts and tests/acceptance/dashboard.spec.ts: no implicit failure alerts, runtime notice uses the backbone.
- [ ] T114 [US5] [A20] Verify US5.6 through configured rule and optional SMTP fixture in tests/integration/notifications.test.ts: count1 triggers only its authorized scope and eligible subscribed recipients.

### Story acceptance completion gates

- [ ] T100 [US5] [A15] Verify acceptance US5.1 through its real entrypoint in tests/integration/recovery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Acknowledged work recovers after a crash without claiming JS instruction continuation.
- [ ] T101 [US5] [A16] Verify acceptance US5.2 through its real entrypoint in tests/integration/recovery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Recovery reuses recorded successful managed sends while uncertain sends retain duplicate risk.
- [ ] T102 [US5] [A17] Verify acceptance US5.3 through its real entrypoint in tests/integration/delivery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Replaying a terminal event creates new execution identity without changing prior history.
- [ ] T103 [US5] [A18] Verify acceptance US5.4 through its real entrypoint in tests/integration/recovery.test.ts; observed passing output and the complete affected story checks are required before closing this criterion: Lost scheduling recovers under a new generation that rejects stale writes.

## Phase 8: Final validation, upgrade and alpha release readiness

**Goal**: Deliver the whole confirmed alpha, not an installation-only MVP.

**Independent check**: Every owning lane passes once with complete inventory; published-image installation/upgrade/backup works and remaining operator prerequisites are explicit.

- [ ] T079 Red then Green then refactor: implement tests/deployment/installation.test.ts and deploy/compose.yml for prebuilt pinned web/worker/executor/Postgres images, readiness/migration locking, SMTP config, supported host sandbox verification and complete first delivery; no operator Node/Bun install and no raw licensed artifacts or build secrets in images. Behavior markers: [U161] [U162] [U163].
- [ ] T080 Red then Green then refactor: add pending-job/code-revision image upgrade, expansion-compatible schema, backup/restore and rollback-limit scenarios in tests/deployment/installation.test.ts and scripts/backup.ts; record coordinated schema/SDK/engine/compatibility/sandbox versions in deploy/release-manifest.json. Behavior markers: [U164] [U165] [U166].
- [ ] T081 Configure owning final CI lanes in .github/workflows/alpha-ci.yml using scripts/tests/inventory.ts, unique databases/ports/artifacts and explicit CPU/memory concurrency budgets; unit/component, Node/PG, executor, browser, performance and installation gates each run once; merge/reuse coverage/JUnit outputs and enforce complete inventory and applicable thresholds.
- [ ] T082 [P] Document clean install, SMTP, bootstrap, optional gVisor host setup, networking/localhost, supported dependencies, recovery/deduplication and upgrade limits in docs/deployment/README.md and specs/001-releasable-alpha/quickstart.md; resolve CI HEROUI_AUTH_TOKEN through secret configuration, never a committed value or insecure package downgrade.
- [ ] T083 [P] Refresh source-verified architecture navigation using Graphify only after implemented paths exist; update README.md, AGENTS.local.md and graphify-out/ provenance without modifying centrally managed baseline files.
- [ ] T084 Execute the owning final lanes and quickstart scenarios, collect nonempty inventory/coverage/source-map/license/image/security/resource/latency/recovery evidence in specs/001-releasable-alpha/preflight.md and extension tdd/verification.md; do not rerun passing unrelated lanes unless changes/failures require it. Every SC001–006 and FR001–028 needs its owner evidence.
- [ ] T085 Prepare coordinated alpha image/release candidates and update the existing Linear work items from verified evidence; record release checklist and remaining operator prerequisites in docs/releases/alpha.md. Publishing/merging occurs only under existing authorization and repository contribution workflow; generation of tasks does not itself release the product.

## Dependencies and execution order

Setup → Foundation → US1 → US2 → US3 → US4 → US5 → Final validation. All five stories are P1 and required for the release. Story-level independence means a verifiable increment once prerequisites exist, not unrelated implementations that can ignore identity/publication dependencies.

- US1 depends on foundation; tests isolate installation/auth from event delivery.
- US2 depends on US1 scoped access plus compiler/executor; verification uses synthetic fixtures.
- US3 depends on US2 publication and US1 scopes; tests use controlled senders/receivers.
- US4 depends on US2 publication and US3 managed effects; tests isolate middleware policies.
- US5 depends on US3 deliveries and foundation leases; end-to-end recovery uses the completed middleware path.
- Default-container/runtime capability and database fencing are early blocking proofs. Optional gVisor is not a default-installation gate. If failed, stop the affected slice and report evidence; do not substitute a weaker boundary or different stack silently.
- Within every three-task slice: Red task → Green task → Refactor/verification task. Develop one intended failing behavior at a time, even when a task lists several scenarios. The extension test list refines those scenarios into individual cycles.
- Execute T001–T006 explicitly before `$speckit-implement`; T005 prepares the mandatory hook prerequisites. T011 owns all domain DDL; T019 uses its dependency-complete persisted fixtures.
- US2 order: T034–T036 publication → T040–T042 secret capabilities → T037–T039 template/synthetic tests → T043–T045 editor. Full managed delivery and actual ingress integrations remain US3.
- T007 tests public schema primitives only. T073–T075 own complete generated OpenAPI/actual route parity after routes exist.
- Test tooling/profile creation precedes TDD planning; that profile precedes remaining behavioral implementation and the mandatory before_implement TDD hook.

## Parallel opportunities and examples

Final documentation and graph refresh may run independently after behavior is stable. Within stories, different files may be prepared concurrently only after the shared prerequisite and relevant Red cycle are satisfied; no same-file test ownership conflicts. No subagents are launched by this task-generation command.

| Story | Conditional parallel example                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1   | After auth/grant Green: login UI in `apps/web/src/app/(auth)/login/page.tsx` and permissions documentation in `docs/permissions.md`.                                   |
| US2   | After publication service Green: Monaco presentation in `apps/web/src/app/components/script-editor.tsx` and template fixtures in `packages/script-sdk/src/templates/`. |
| US3   | After ingress/delivery Green: destination UI and events UI under separate `apps/web/src/app/(dashboard)/projects/[projectId]/` routes.                                 |
| US4   | After policy Green: binding presentation in `components/middleware-bindings.tsx` and topology docs in `docs/deployment/networking.md`.                                 |
| US5   | After live/replay Green: event timeline component and privileged admin jobs page.                                                                                      |

These examples describe possible future division of work; numbered tasks preserve safe sequential execution and prerequisites. Final isolated lanes can run concurrently only within their verified resource budget.

## Implementation strategy and acceptance ownership

First internal checkpoint: Setup + Foundation + US1 prove installation/access. First functional checkpoint: add US2 + US3 for programmable durable delivery. Then complete US4 + US5 and final install/upgrade gates. The maintainer explicitly requires the full releasable alpha; do not publish US1 alone as the requested MVP.

The plan.md section14 table is the single complete test-owner inventory, including database, publication, middleware and configuration suites. scripts/tests/inventory.ts must reconcile discovered files against that inventory and fail on missing, unowned or multiply owned final executions. Pure policy/compiler tests, server transactions and browser flows own distinct assertions; no duplicate scenarios merely to fill lanes.

Fast feedback: owning whole files/scenarios without coverage. Affected feedback: dependency selection with broad fallback. Final validation: each owner runs once, reusing artifacts. Preserve Node production integration and browser accessibility. No fictional numerical CI speedup or passing product suite claimed.

## Extension hook disposition

No before_tasks hook is registered. The optional after_tasks `$speckit-tdd-plan` was subsequently executed as T005 after verified tooling/profile creation; test-list and baseline cycle-log now exist. Explicitly execute T001–T006 as tooling bootstrap before `$speckit-implement`; T005 runs `$speckit-tdd-setup` and `$speckit-tdd-plan` against successfully executed commands. Do not invoke `$speckit-implement` to bootstrap its own hook prerequisites, disable the mandatory hook, or fabricate a profile/test list. After bootstrap succeeds, invoke `$speckit-implement`; its mandatory `$speckit-tdd-run` drives the remaining behavior tasks.

## Generation summary

Total:114 tasks; original T001–T103 preserved, notification extension T104–T114 added. Counts: Phase1:6, Phase2:18, US1:12, US2:15, US3:17, US4:12, US5:27, Phase8:7. Original task IDs T001–T085 are preserved; new IDs T086–T103 are unique acceptance gates; document order carries dependencies, including T040–T042 before T037–T039. Every task includes an implementation or evidence path. T001/T003/T004/T005/T006 completed with bootstrap evidence; T002 remains partial (clean licensed CI build/worker image pending; release gate, not a foundation blocker), T006 default mode and missing-runsc failure verified; optional gVisor execution unverified. All product tasks remain open. Notification backbone/rules are design only; no default delivery-alert policy is enabled.

Confirmed UI dependency: install `@tabler/icons-react` when implementing the dashboard/notification UI; use locally bundled static imports, outline by default and available filled variants for emphasis.

## Maintainer UI review follow-up — 2026-10-15

Tracked in Linear PAB-66; this is a continuation of the alpha, not a release.

- [x] Record approved reusable UI/UX principles, including breadcrumbs and direct cross-resource search, in repository guidance and Linear.
- [x] Add scoped hourly overview aggregates and recent execution data; verify metadata isolation and individual outgoing-attempt counts in PostgreSQL.
- [x] Retain valid rejected/response-only ingress outcomes without queued delivery work; verify response-only replay is refused.
- [x] Verify the revised dashboard hierarchy/search/breadcrumbs, collection/modals, playground and mobile editor/dialog flow against production browser acceptance. Full dashboard 27 passed; mobile/editor/bootstrap 8 passed; final five-case dialog/navigation rerun passed.
- [x] Refresh scoped delivery/live/seed integration coverage after the history changes and record remaining limits accurately. Delivery/replay 15, live API 18 and preview seed/runtime 3 passed. See docs/ux-audit.md for history limits.
- [x] Deliver verified review changes through existing alpha PR #13; keep the alpha draft and unreleased. Remote deployment evidence is tracked in Linear PAB-66.

## Second maintainer mobile review — 2026-10-16

Reference: docs/ux-review-2026-10-16.md. Concrete fixes and the proposed larger
navigation/editor redesign are tracked separately; preserve the requirement to
review refreshed Coolify findings before applying that structural redesign.

- [x] Audit refreshed Coolify mobile layout, resource task groups and search source;
  compare Cloudflare Trace and Hoppscotch request/response conventions.
- [x] Correct status vocabularies and OR filtering; expose permission-gated captured
  attempt responses, visible status chips and valid empty results.
- [x] Remove prefilled secret keys; explain ctx.secrets access; format saved editor
  loads/default templates and restore page scrolling with the sticky header.
- [x] Apply explicitly requested global ordering, concise labels, bottom instance
  administration and a distinct helper icon.
- [x] Confirm the maintainer already requested scope-only navigation and native
  imports; do not block this implementation on the unreceived confirmation.
- [x] Verify and deliver scope-only navigation, command search, named route/section
  breadcrumbs and native source imports with server-side immutable dependency pins.
- [ ] Complete the remaining middleware ordering and test-client presentation review.
- [ ] Verify keyboard open/close and browser-toolbar resizing on mobile; no physical
  Android keyboard pass is claimed by a narrow desktop viewport alone.

## Maintainer review follow-up — 2026-10-16

These additions extend the dashboard review; they do not mark the original alpha
release gates complete. Track actual verification in `tdd/cycle-log.md` and
`docs/ux-review-2026-10-16.md`.

- [x] R01 Finish and verify shared centered loading states, helper-import modal,
  unified event inspector, publication picker, filtered/bulk replay and scoped
  code creation; push and check the exact preview revision.
- [x] R02 Finish middleware table with accessible atomic ordering, connected
  request/response playground, decoded dry-test results/log filters and compact
  mobile breadcrumbs. Verify provenance, stale edits and mobile navigation.
- [x] R03 Implement the forkable notification-channel catalog, immutable published
  versions, instance-admin editing and isolated adapter execution. Ship email as
  the first channel; custom adapters use the same catalog and runtime.
- [x] R04 Implement shared branded email rendering and instance-admin template
  configuration with synthetic preview/test-send/reset. Reuse the wrapper for
  OTP, invitations and notification alerts; preserve protocol-owned recipients,
  verification/expiry and SMTP credentials in deployment secrets.
- [ ] R05 Verify durable channel dispatch, permission changes, retries/deduplication,
  secret redaction, mobile email/template flows and the actual preview; update
  the audit and PR evidence. The scope is recorded in
  `proposals/notification-channels.md`.
