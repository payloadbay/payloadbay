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
