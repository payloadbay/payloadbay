# Coolify preview deployment setup

Configured on 2026-10-14. This records deployment configuration, not a successful
preview deployment.

- Instance: `https://cloud.thedannicraft.de`
- Private management destination: `100.72.180.95`, preserving the instance
  hostname and HTTPS certificate verification.
- Project: `Payload Bay`, UUID `vye2znf0fmih1sqoz8roy3eb`.
- Environment: `previews`, UUID `dzp1ufe9glyg6uchd47wxnzq`.
- Server: `hel1-node1`, UUID `xsgws8k884so8ksw4o848c8k`.
- GitHub source: `paylaodbay`, UUID `tfsut6qcaterwk5iwphos86i`, installed
  in the `payloadbay` organization with access to `payloadbay/payloadbay`.
- Application: `Payload Bay PR previews`, UUID `hn6zpt6p4zq5y87ngm0skgyw`.
- Source branch: `master`; build pack: `dockercompose`.
- Expected Compose path: `/deploy/compose.preview.yml`.
- PR previews enabled; external-contributor automatic previews disabled.
- Ordinary push auto-deployment disabled; no deployment started during setup.
- Preview URL template: `{{pr_id}}.{{domain}}`.

The native `/mcp` connection supports inspection and deployment operations.
REST was explicitly authorized for project/application configuration that the
installed MCP server does not expose. Credentials remain outside the repository.

## Current deployment policy

Confirmed on 2026-10-15: automatic previews are restricted to Coolify's trusted
repository members (owners, members and collaborators). Public/fork automatic
PR deployment is disabled. An external contributor's PR requires a maintainer
to review the exact current commit and explicitly deploy it through Coolify's
Preview Deployments controls. Review new commits before redeploying them.

Coolify's setting is a deployment restriction, not a queued approval system.
External authors do not receive automatic build access after opening a PR.
Reviewers can still use a deployed preview without GitHub maintainer membership.
No n8n gate, package proxy or custom image pipeline is being introduced.

## Preview build strategy

PR previews build application, worker and executor images directly from the
checked-out PR branch using `deploy/compose.preview.yml`. No published Payload
Bay images or merge into master is required. Clipify's separate preview Dockerfile
uses the same source-build approach. Prebuilt images remain the operator release
interface, not a preview prerequisite.

The preview-only `schema` service runs development Drizzle push after PostgreSQL
is healthy. Application and worker startup wait for schema completion and executor
readiness. Production continues to require CI-owned release migrations; preview
startup does not generate or commit release migration files. PostgreSQL storage
is scoped to the Compose project; no fixed container or volume names are used.
Mailpit collects synthetic preview email internally and has no public port mapping.

HeroUI Pro installation uses the `heroui_auth_token` BuildKit secret sourced from
`HEROUI_AUTH_TOKEN`. Configure it for preview builds, not container runtime; never
pass it as a Docker ARG or commit it. Runtime secrets are generated separately from
production credentials in this dedicated preview application. Additional PRs use
the application's preview settings; this is not a claim of a fresh key per PR.

The intended app domain is `https://payloadbay-preview.cloud.thedannicraft.de:3000`,
with the saved PR URL template. Both the base hostname and
`42.payloadbay-preview.cloud.thedannicraft.de` resolved to the deployment host.
Coolify must load the branch Compose definition before accepting the service domain
mapping. PUBLIC_URL references the generated service URL for authentication links.

## Verification and remaining work

The real Docker Compose parser validates the preview definition. Existing Docker
image tests verify non-root startup and actual worker/executor HTTP delivery with
a disposable source-schema database. These do not prove the remote preview works.

Verify a clean licensed build on Coolify, service domain mapping, PR webhook
handling, isolated state, login/event delivery and close/merge cleanup. Operator
release images, CI migration artifacts and full alpha release gates remain separate
unfinished work.

## Preview base URL

`packages/domain/src/base-url.ts` reuses Clipify's runtime precedence: when
Coolify runtime metadata exists, the first `COOLIFY_URL` wins over a stale
configured URL and is normalized to an HTTPS hostname without the internal
container port or path. Both Next.js authentication/origin checks and worker
notification links consume this shared configuration. Outside Coolify,
`PUBLIC_URL` (or `NEXT_PUBLIC_BASE_URL`) wins and preserves explicit ports/paths;
the existing localhost fallback remains. URLs are read from operator/deployment
configuration, never untrusted request Host headers.

## Disposable demo configuration

Preview PostgreSQL now uses tmpfs, not a persistent volume. The application has a
custom start command `docker compose up -d --force-recreate --remove-orphans`.
This recreates the database on redeployment; schema startup runs development push
and the guarded seed command before app/worker startup. This reset policy applies
only to this dedicated preview application. Remote reset behavior still needs
verification once its build succeeds.

The known synthetic account is `reviewer@preview.payloadbay.test`; it is admitted
and provisioned through Better Auth, then assigned the demo instance owner role.
The seed creates a sample workspace, project and unpublished ingress draft through
normal domain commands and is repeatable within a fresh demo. It refuses production
mode and will not overwrite a completed non-demo installation.

Mailpit exposes HTTP port 8025 to the proxy, not a host-published port. MP_UI_AUTH
uses the preview-only PREVIEW_MAIL_AUTH value. The intended service mapping is
`https://payloadbay-mail.cloud.thedannicraft.de:8025`, with a distinct PR hostname.
The browser URL is pending Coolify's successful Compose loading/domain assignment;
it is not live merely because the service is declared. Its shared reviewer
credential is separate from GitHub roles and never committed. The chosen goal is public functional review without GitHub maintainer privileges.
Before privileged access is distributed publicly, sandbox, preview egress and
resource limits still require verification. The current mail credential is a
temporary access control, not the final public demo experience.
