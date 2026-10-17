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
23/23 and a complete browser invocation 44/44. Remote API deployment verification
is pending; the foundation deployment above predates these local changes.

## Remaining release gates

- Verify the newly completed local Scalar/OpenAPI console in the remote preview.
- Finish privileged queue/age/metrics inspection, remaining notification
  boundary acceptance and retention cleanup.
- Finish remaining middleware ordering and script-test client presentation
  review. Physical Android keyboard/browser-toolbar behavior needs a real
  device; viewport emulation is not equivalent evidence.
- Validate published pinned release images, clean operator installation,
  pending-job upgrade, backup/restore and coordinated version readiness.
- Execute the performance/latency and contention scenarios, measure product
  coverage against the agreed thresholds, and reconcile original acceptance
  tasks from their actual owning evidence. An installed test profile or green
  selected suite does not satisfy those gates.
- Refresh the stale Graphify architecture index from implemented source.
- Optional runsc execution is unverified. Standard trusted-publisher mode must
  remain explicit; no silent fallback or hostile-sandbox certification.

Hosted checkout/subscriptions, commercial plan catalog/enterprise activation and
production hostile-tenant rollout remain H01. Self-hosting records local usage
without commercial ceilings or a required billing/license/telemetry service.
There is no released alpha, production rollout or authorization to merge PR #13
implied by this preflight.
