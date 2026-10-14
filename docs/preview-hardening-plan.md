# Public PR preview hardening plan

Confirmed direction, 2026-10-14. This is an implementation plan, not evidence
that the current preview is hardened or that its remote deployment is healthy.

## Goal

Anyone, including a PR author or first-time contributor on a phone, can test the
real application in a browser without running the monorepo locally. Every PR has
an independent disposable dataset. Each successful redeployment recreates and
seeds it. Preview failures complement CI; a working demo does not replace tests.

Use the real UI, API, Better Auth email-code flow, PostgreSQL, queue and worker.
Expose the matching Mailpit UI for testing synthetic email. Keep the known demo
identity recoverable, warn about public/shared/resetting data, and protect the
few controls that could lock out other reviewers. Do not use production data,
SMTP accounts, OAuth credentials or operator secrets in previews.

## Current evidence and gaps

Implemented: PR source-build Compose, preview-only guarded seed, a fixed admitted
reviewer account, sample workspace/project/unpublished route, queued real OTP,
Mailpit service, ephemeral PostgreSQL, runtime preview warning and protection
against demoting the seeded instance owner. Local preview integration tests and
normal authorization regressions pass. Force recreation is configured in Coolify.

Not verified: successful clean licensed remote build, service URLs, actual remote
reset, gVisor runtime, hostile-code isolation, public write access, egress policy,
public-demo quotas or secret-safe external-contributor builds. Current Docker
runtime is runc; selecting runsc is not proof that every relevant boundary works.
The current Coolify token cannot read failure logs without read:sensitive.

## Tonight's sequence

### 1. Diagnose the existing preview build

Obtain scoped read:sensitive access, inspect the failed deployment, fix the actual
failure, and verify the app and Mailpit domains. Do not relax controls or repeatedly
redeploy without observing the failure. Preserve HeroUI's build-only secret setting;
never copy the local CLI credential to an image or disclose it in logs.

### 2. Separate public review from privileged builds

Keep automatic external-contributor/fork builds disabled while builds receive the
HeroUI credential. Maintainer approval must apply to an exact PR commit; a new
commit requires another approval. Do not execute untrusted source with secrets
under pull_request_target. Public access to an already-approved demo must not
require GitHub maintainer membership.

Move towards a maintainer-owned dependency/bootstrap image or stage that installs
licensed packages before PR source is introduced. The PR-controlled build should
receive installed dependencies, not the installer token. Review licensing before
publishing any dependency image. Keep registry authentication in the build host's
pull mechanism, outside the build container. Isolate the builder from production
services, its management plane and unrelated secrets. A sandbox for running scripts
alone does not protect a Dockerfile or Next build executing untrusted PR code.

Use trusted build instructions and an audited dependency/bootstrap step; inspect
PR changes to Dockerfiles, package hooks, lockfiles and Next configuration. Keep
secret files outside the source build context. Test image layers, caches, history,
logs and deliberate exfiltration attempts using synthetic canaries. Require that
unapproved commits do not run privileged builds and that PR source cannot obtain
the real installer credential.

### 3. Make public demos simulate external effects by default

Introduce an explicit preview effect policy, separate from IS_PREVIEW display and
from PAYLOADBAY_EXECUTOR_RUNTIME. Default public demos to simulated outbound effects.
Run the real event lifecycle and durable jobs, but intercept direct fetch and managed
HTTP delivery at the executor bridge and worker broker/transport, not just a UI
button or a replaceable global fetch wrapper.

Build on the existing dry-test pipeline and workerd globalOutbound deny configuration.
Record intended method/URL/body summaries and return configurable deterministic
fixture responses, including failure and timeout cases. Cap/redact logs. Show
"simulated" in inspection; never claim that an external service received a message.
A plain console log is insufficient for testing response-dependent script logic,
retries, pause/resume, replay and queue state.

Allow only controlled in-stack receiver fixtures where real HTTP is needed for
functional delivery tests. SMTP continues to use Mailpit. Do not enable real Stripe,
Discord, production OAuth or external SMTP credentials in the public default.

Acceptance: direct fetch, managed destinations, replay, middleware and dry tests
cannot reach a test external receiver under simulated mode, including scripts that
try to bypass the SDK. Simulated failure/success produces honest inspectable states.
Preview flags and effect policy cannot be changed through the demo dashboard.

### 4. Validate gVisor and constrain network reachability separately

Install/register runsc on the host, accounting for the impact of restarting Docker
on existing services. Do not change the host-wide default runtime. Select runsc
only for the preview executor, recreate it, and verify its host-side runtime settings,
startup, compilation, WebCrypto, processing and bounded execution. A requested
missing runtime must fail deployment rather than fall back silently. Maintain the
ordinary Docker operator default outside this public preview policy.

Use a separate preview network and keep executor networking limited to its approved
bridge/broker dependencies. Network isolation must preserve the real app/database/
queue/Mailpit path. network_mode: none alone would also break the broker connection;
use an internal network and deliberate boundary rather than assuming it is a drop-in.

Block preview user-directed connections to the Docker host, Coolify, production
networks, LAN, Tailscale, loopback/link-local/metadata addresses and other previews.
Apply the rule to both fetch and worker-managed sends. For any optional real public
HTTP mode, validate resolved addresses at connection time, including IPv6, mapped
IPv4, DNS rebinding and redirects. This is preview-only policy: self-hosted product
operators retain the approved ability to configure private-network destinations.

Acceptance: attempts to reach each forbidden network fail; controlled fixture
requests succeed; scripts cannot read process secrets, files or sockets; the
executor has no Docker socket or host mounts. Test actual limits and failure cases.
Do not present gVisor as a complete security guarantee.

### 5. Limit public-demo abuse and preserve reviewability

Add preview-specific request, queue, script-execution, payload/log/retention and
outbound-effect budgets with clear UI feedback. Use the existing script deadlines,
fetch counts and container resource controls as foundations; measure enforcement
under concurrent use rather than relying on configuration alone. Protect SMTP
and OTP flows from message floods without requiring a maintainer login.

Keep the fixed reviewer email/admission/owner access and deployment settings
protected. Allow reviewers to change project test secrets and feature configuration.
Document shared edits and reset semantics in CONTRIBUTING.md. Test repeat seeding,
lockout attempts and two simultaneous PRs. Rebuild one PR and verify that its edits
and email are erased while the other PR is unchanged.

### 6. Open the verified demo and document its limits

Only after the build-secret boundary and runtime/effect controls pass, expose the
seeded login and Mailpit experience for general functional review. If additional
HTTP access credentials remain, make their distribution usable for all reviewers,
not restricted by maintainer role. Record whether external effects are simulated,
which optional live effects were tested, and which host controls were verified.

Verify browser login through Mailpit, editing/publishing/test flows allowed by the
mode, durable ingest, worker processing, retry, replay, notifications, cleanup on
PR closure and automatic rebuilds. Attach sanitized evidence to PR #13 and update
this document with completed checks; do not label the alpha released prematurely.

## Decision for the first public demo

Preserve the openly usable review goal. Prefer simulated external effects plus
verified isolation and quotas for public use. Optional real external HTTP belongs
to a separately controlled preview mode, after its egress policy is validated.
Public access and PR-source trust are separate decisions: approval for a privileged
build does not mean the finished demo must be maintainer-only.

## References

- Clipify source: src/app/lib/baseUrl.ts and Dockerfile-preview, reused for runtime
  preview URL handling and PR source-build strategy.
- [gVisor Docker setup](https://gvisor.dev/docs/user_guide/quick_start/docker/)
- [gVisor networking](https://gvisor.dev/docs/architecture_guide/networking/):
  sandbox networking preserves application reachability; it is not an egress allowlist.
- [Coolify preview deployments](https://coolify.io/docs/applications/deployments/preview-deployments)
