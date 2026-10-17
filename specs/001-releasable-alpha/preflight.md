# Alpha implementation preflight

Updated 2026-10-17. The alpha remains unreleased in draft PR #13. The original
bootstrap-only snapshot is historical; it does not describe the current app.

## Implemented and verified foundation

The app uses Next.js/React/Node, PostgreSQL/Drizzle, Graphile Worker, Better Auth,
HeroUI Pro and a separate workerd executor. Bun owns package management and unit
feedback. Standard restricted Docker/runc is the default; optional runsc needs
operator host setup. No Docker socket is mounted into the app.

Implemented product flows include SMTP OTP/bootstrap and passkeys; inherited
roles/invitations; organization/workspace/project setup; editable ingress and
processing, helper imports, middleware and encrypted secrets; immutable
publication/rollback; durable acceptance, delivery/retry/pause/replay; live event
and captured attempt inspection; scoped notifications, forkable notification
modules and branded email; local usage and operator policy/capacity.

Organization foundation F01–F12 is complete. Source `f5a71d5` deployed in Coolify
`pgmz2eckz2wr057enfchfh1b` at 2026-10-16 15:58:21 UTC. Real OTP passed for four
normal demo identities. Unrelated organization and project-only access, denied
parent aggregates/mutations, a newly correlated queued HTTP delivery, local
usage increments and the 390px usage page were verified. Evidence commit
`4a56806` contains the detailed ledger and completed foundation tasks. These
checks do not certify hostile public multi-tenancy.

## Evidence and boundaries

- Full integration: 244/244 at `b26c421`; after two narrow final-source changes,
  complete organization 23/23 and live-API 18/18 passed.
- Unit 47/47; real executor 28/28. Browser broad run 40/41, plus the sole
  infrastructure-blocked mobile onboarding rerun 1/1. Deployment broad run
  14/15, plus the sole infrastructure-blocked container-delivery rerun 1/1.
- Those are broad runs plus targeted reruns, not retroactively green complete
  invocations. All 41 browser and 15 deployment behaviors were verified.
- Lint, formatting, inventory and final-source web/tooling TypeScript passed at
  that checkpoint. Source changes require their own affected evidence.
- Local image checks used six pre-existing uncommitted Docker/build drafts,
  excluded from foundation commits. The exact remote preview above used
  committed Dockerfiles. Preserve those unrelated drafts.
- No ordinary release SQL was generated locally. Development/preview uses
  schema push; master CI owns the coordinated migration after merge. Legacy
  mapping tests are not published-release installation/upgrade certification.

Subsequent work and actual red/green failures are recorded in
`tdd/cycle-log.md`. Local API documentation now covers all 82 implemented
operations with route/body/header/query parity. The locally bundled Scalar
console passed real scoped-token calls and revocation without owner cookies.
This checkpoint passed integration 250/250, unit 47/47, final live/API owner
23/23 and a complete browser invocation 44/44. API source `9bdbfe7` deployed in Coolify `wgbpjaut8qbpgcg8plqirnp9` at
2026-10-17 07:13:23 UTC. Its public console passed a real 390px browser check:
200 response, all 82 operations, no external requests or page overflow, and the
sticky preview notice. Scoped-token execution/revocation is locally browser-proven;
that full token flow has not been repeated against the remote installation.

## Current settings and UI checkpoint

Personal API keys are available under account settings; organization settings
provide organization-wide or selected-workspace keys with explicit permissions.
Keys remain user-issued and intersect the issuer's current rights; selected scopes
are persisted and filtered before collection limits. Secrets are shown once,
listed only as metadata, and revocation is immediate.

Ordinary form/confirmation/detail overlays now use native responsive HeroUI
Modals: centered desktop placement, mobile placement and inside scrolling.
Notification attention includes accessible count/highest severity and receives
real scoped producer changes. Complete browser48/48, unit47/47 and notification
owner19/19 and full backend integration256/256 passed locally. Exact preview
deployment for this newer settings/UI checkpoint remains pending.

## Remaining release gates

- Reconcile remaining notification boundary acceptance; opt-in retention cleanup
  and scoped UI/live invalidation are implemented and verified below.
  Queue/age/job inspection and instance audit/configuration inspection are now
  implemented; coordinated whole-stack release readiness remains separate.
- Finish remaining middleware ordering and script-test client presentation
  review. Physical Android keyboard/browser-toolbar behavior needs a real
  device; viewport emulation is not equivalent evidence.
- Validate published pinned release images, clean operator installation,
  pending-job upgrade, backup/restore and coordinated version readiness.
- Execute the performance/latency and contention scenarios, measure product
  coverage against the agreed thresholds, and reconcile original acceptance
  tasks from their actual owning evidence. An installed test profile or green
  selected suite does not satisfy those gates.
- Graphify architecture navigation is refreshed from implemented source; its
  documented unresolved/coalesced edges and parser gaps require source verification.
- Optional runsc execution is unverified. Standard trusted-publisher mode must
  remain explicit; no silent fallback or hostile-sandbox certification.

Hosted checkout/subscriptions, commercial plan catalog/enterprise activation and
production hostile-tenant rollout remain H01. Self-hosting records local usage
without commercial ceilings or a required billing/license/telemetry service.
There is no released alpha, production rollout or authorization to merge PR #13
implied by this preflight.

### Exact remote settings/jobs checkpoint — 2026-10-17

Coolify deployed `9d0c3f7` successfully at 08:54:25 UTC. Real synthetic owner/viewer
OTP, scoped API-key creation/authentication/revocation, key settings screens,
centered desktop workspace dialog, bounded mobile jobs screen, safe job metadata
and viewer denial passed. Both screenshots were inspected. The shared-dashboard
SSE follow-up is still local and is not part of that remote result. Public
sign-in hint text is configurable, but preview Compose is still loaded from
master; its optional text is not claimed visible remotely.

Local live-update checkpoint: complete browser53/53, integration257/257 and unit47/47, plus lint, web/tooling TypeScript, formatting and inventory passed. One shared dashboard stream survives navigation; open attempt details refresh; successful replay preserves original history and creates a separate execution. Remote verification of these newer live changes is pending.

### Audit and installation inspection — 2026-10-17

Audit source `931bf86` deployed in Coolify `qrencpsdsm3p0tozv56ju0yo`, finished
09:56:28 UTC. Real owner/viewer OTP, metadata-only audit projection, cursor paging,
mobile table containment and viewer denial passed. The screenshot was inspected.
Authorization owner17/17 and HTTP/OpenAPI owner23/23 passed locally at that source.
The audit retry follow-up passed its real503/retry browser pair2/2.

Local installation settings/health passed IH01 browser1/1 and config owner3/3.
Settings require instance settings.manage and expose no credentials or SMTP/database
connection details. Real executor probes are bounded to3s/16KiB and reject
redirects; worker processing/SMTP delivery remain explicitly unmeasured. Runtime
configuration is not host attestation. Desktop/mobile screenshots were inspected.
All current static checks and final-source unit47/47 pass. Complete browser56/56
passed in one invocation; full backend verification follows. These installation changes are not yet
part of the exact deployed-source claim above.

Complete installation/audit regression passed: browser56/56, backend259/259,
unit48/48 (including the new inventory safeguard), lint, web/tooling TypeScript,
format and inventory. Product source195b39e is pushed. Known test lanes now include
serialized performance; an invalid owner name fails rather than disappearing.
The attempted Bun coverage command did not produce a fresh LCOV report; the old
October14 file is not accepted as current evidence. Coverage remains open, along
with performance, retention and published-release gates.

The latency gate is now registered separately as `bun run test:performance`.
Source-identical images with one CPU each delivered all 600 requests under
1,000 lower-priority queued executions. After a competing preview build finished,
ACK p95 was 129 ms and first-attempt p95 156 ms (max 265 ms), passing the agreed
fixture targets. The earlier concurrent-build run missed the first-attempt target
at 5.34 s and is retained. See `docs/performance.md`; this is not a production SLA.

Exact remote installation source81dc1fd deployed in Coolify
ifz6ql8qshyzhx9ebzeizkd9, finished10:19:42UTC. Real owner/viewer OTP, safe
configuration, actual database/executor health, explicit worker/SMTP unmeasured
states, one connected EventSource across client navigation, mobile containment
and viewer denial passed. The mobile screenshot was visually inspected.

## Retention and cold CI checkpoint — 2026-10-17

Complete backend272/272, complete browser57/57, retention13/13and configuration3/3
passed at the recorded source checkpoints (see cycle log). Pruning defaults
disabled, retains unfinished/recent/unproven work, serializes both replay race
orders and uses exact24-hour bounds across PostgreSQL daylight-saving offsets.
Changes invalidate only affected project views; expired inspectors close quietly.
Exact source e9724c7deployed and passed normal owner/viewer OTP, safe health and
configuration, shared live connection, mobile containment and viewer denial.

Fresh GitHub CI at ef479c4passes static, executor and all21deployment tests.
These clean-checkout image tests use committed Dockerfiles, resolving the earlier
local-draft evidence limitation; they are still source/candidate image tests,
not published operator release installation/upgrade/restore certification.
Latest-source performance passed600/600delivered, ACK p95116.789ms, first attempt
p95131.701ms/max258.514mswith1000seeded bulk requests; see docs/performance.md.
Backend/browser CI remain running at this checkpoint.

Unit tests51/51pass, but their per-file coverage gate remains failing. The initial
cold run's missing-rg prerequisite was corrected explicitly. Licensed installation
works with the encrypted Actions credential. Central source policy PR#30checks and
real App-token dry run passed; live external environment policy awaits approval
and merge. No alpha merge or production migration generation is implied.


Source-mapped CI run `39034217843` at `7fa7da0` passed backend **274**,
executor **28**, deployment **21**, browser **57**, performance **1** and static
checks. These owners collect filtered Node LCOV without raw V8 caches; the separate
unit per-file coverage gate still fails. This is not a complete coverage pass.
Unused Supabase CLI commands and their helper were removed after verifying no
current owner invokes them. Root/web/contributor docs now describe the implemented
alpha, actual aliases and optional plain sign-in hint.

T083 source navigation is refreshed: **1,723 nodes / 5,557 edges / 89 communities**
from 317 code files, 43 documents and seven canonical brand assets. The SQL parser
is installed in Graphify's tool environment. Nineteen unresolved raw references,
158 coalesced same-endpoint edges, 12 self-loops and one valid-TypeScript parser gap
are disclosed in `graphify-out/GRAPH_REPORT.md`. This is navigation assistance,
not complete runtime, security or coverage proof.


## Executor compatibility checkpoint

Protocol/SDK/compatibility-date validation now gates worker startup before
recovery and queue/producers. Actual prior Red and affected complete Greens
(config3, executor-client3, retention13, executor28) are in the cycle ledger.
The public installation view remains a bounded readiness projection. This does
not close pending-job release upgrades or imply per-request negotiation.
