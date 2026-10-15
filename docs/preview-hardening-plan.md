# Public PR preview hardening plan

Confirmed direction, 2026-10-14. This is an implementation plan, not evidence
that the current preview is hardened or that its remote deployment is healthy.

## Policy update: 2026-10-15

The maintainer selected Coolify's native restricted automatic deployments:
repository owners/members/collaborators may auto-deploy; other PRs require a
maintainer-reviewed explicit preview deployment for the current commit.
Public automatic PR deployments are disabled. This supersedes the automatic
untrusted-build goal below. Dependency images, proxies, n8n gates and a custom
build/publish pipeline are deferred proposals, not agreed implementation work.
Runtime isolation, disposable data and preview warnings remain relevant.

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

### 2. Make automatic PR builds secret-free

The target is automatic builds and deployments for PRs, without a maintainer-only
Coolify deployment button. Until this boundary is implemented, the current privileged
source builds must not automatically accept arbitrary external PRs.

Use a trusted dependency image: a pipeline from the protected baseline installs
HeroUI Pro with its BuildKit credential before introducing PR source. Export only
the installed package/tooling needed for compilation, never credentials, installer
login state or secret-bearing caches. Pin the dependency image by digest. Keep it
private until the HeroUI license's distribution/collaboration terms are verified.

The PR build consumes those installed dependencies with no HeroUI token. Normal
public dependencies can follow the PR lockfile without privileged credentials.
A requested incompatible HeroUI/toolchain change fails with a clear dependency-image
update requirement; it must not silently rerun a privileged installer on PR source.
Trusted baseline changes regenerate the image through normal CI, not a per-PR deploy
approval. Verify image layers and caches using synthetic secret canaries.

Prefer building arbitrary PR source on disposable CI runners rather than the shared
Coolify production host. CI automatically builds app/worker/executor images for the
exact PR SHA, then a separate trusted publish/deploy job delivers those newly built
images to Coolify. This does not require a release image or merge to master. The
build job has no production, deployment, signing or installer credentials; any
necessary package/image pull access is narrowly scoped and outside the build
container. Registry authentication and artifact publishing require explicit boundary
verification, not an assumption that BuildKit secrets protect against malicious code.

Use build and deployment definitions from the trusted baseline. A PR must not be
able to change its deployment Compose recipe to mount the Docker socket, join a host
network, attach production volumes, disable limits or choose a privileged runtime.
Keep runtime environment files out of the build context. The trusted coordinator
may read PR metadata but must not execute PR code with pull_request_target secrets.
Validate image identifiers/PR SHA before deploying; do not execute artifact-provided
commands. Document any GitHub organization-level first-contribution workflow policy.

Acceptance: new commits automatically build/deploy after this setup, without a
Coolify approval click; malicious PR build scripts cannot obtain the installer or
deployment credentials or alter the trusted deployment recipe.

### 3. Make public demos simulate external effects by default

Keep ingress real: raw HTTP requests, provider verification, WebCrypto, challenge
responses, durable acceptance and queueing all use the production path. The Twitch
CLI can send mock events and verification challenges with a synthetic test secret;
contributors must select synthetic identifiers and payload values. No real provider
subscription or production credential is needed for these ingress checks.

Introduce an explicit preview effect policy, separate from IS_PREVIEW display and
from PAYLOADBAY_EXECUTOR_RUNTIME. Default public demos to simulated outbound effects.
Run the real event lifecycle and durable jobs, but intercept direct fetch and managed
HTTP delivery at the executor bridge and worker broker/transport, not just a UI
button or a replaceable global fetch wrapper.

Keep the difference at one shared outbound HTTP transport boundary. Production
uses the native transport; preview startup selects the recorded fixture transport.
Both the worker-managed delivery path and executor direct-fetch bridge must use it;
a worker-only stub would leave direct script fetch unrestricted. Keep business
logic, permissions, publication, queues, retries and API contracts the same. Build
on the existing dry-test pipeline and workerd globalOutbound deny configuration.
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
for the preview services executing PR-controlled code (app, worker and executor),
recreate them, and verify host-side runtime settings,
startup, compilation, WebCrypto, processing and bounded execution. A requested
missing runtime must fail deployment rather than fall back silently. Maintain the
ordinary Docker operator default outside this public preview policy.

Use a separate preview network and keep executor networking limited to its approved
bridge/broker dependencies. Network isolation must preserve the real app/database/
queue/Mailpit path. network_mode: none alone would also break the broker connection;
use an internal network and deliberate boundary rather than assuming it is a drop-in.

Apply the network boundary to every PR-controlled preview service, not only scripts.
The normal Next.js/worker code in an untrusted PR can itself perform arbitrary I/O.
Allowing connections that merely "leave the server" is insufficient: public DNS
can resolve back to that server, and its public IP may expose management services.

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

Prefer existing container/cgroup and reverse-proxy limits over a bespoke demo
application. Reuse the production timeout, payload and concurrency controls; add
only enforcement needed for public use. Avoid parallel preview business logic.

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

## Production parity

Tests exercise the same lifecycle with the native HTTP transport against controlled
real HTTP fixtures as well as the preview transport. Only outbound I/O is swapped;
simulation metadata stays explicit. Keep a small non-public live-effect smoke check
for native delivery so successful preview behavior cannot mask a broken production
transport. Build credentials, network policy and reset/seeding belong to deployment
infrastructure; core application behavior must not fork on preview mode.

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

- [Twitch CLI webhook tests](https://dev.twitch.tv/docs/cli/event-command/)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
