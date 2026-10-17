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


### Exact remote settings/jobs checkpoint — 2026-10-17

Coolify deployed `9d0c3f7` successfully at 08:54:25 UTC. Real synthetic owner/viewer
OTP, scoped API-key creation/authentication/revocation, key settings screens,
centered desktop workspace dialog, bounded mobile jobs screen, safe job metadata
and viewer denial passed. Both screenshots were inspected. The shared-dashboard
SSE follow-up is still local and is not part of that remote result. Public
sign-in hint text is configurable, but preview Compose is still loaded from
master; its optional text is not claimed visible remotely.

Local live-update checkpoint: complete browser53/53, integration257/257 and unit47/47, plus lint, web/tooling TypeScript, formatting and inventory passed. One shared dashboard stream survives navigation; open attempt details refresh; successful replay preserves original history and creates a separate execution. Remote verification of these newer live changes is pending.
