# Quickstart and validation guide

## Current status

The alpha implements the dashboard/API, passwordless authentication, tenant
permissions, editable scripts and durable delivery. It remains unreleased in
PR #13. Use `preflight.md` and `tdd/cycle-log.md` for source-specific evidence;
an installed tool, green selected test or working preview is not release approval.

Published operator installation, pending-job upgrades, complete coverage and
release recovery acceptance remain separate gates. The encrypted HeroUI installer
credential is configured in CI and clean builds have passed; it is not a missing
operator runtime requirement.

## Review the disposable preview

Open the PR preview, read its disposable-data notice, and use a listed account
through normal email-code sign-in. Preview Mailpit receives the synthetic codes;
there is no selector or authentication bypass. The owner, organization owner,
project administrator and viewer demonstrate different scopes. Do not use
production credentials or sensitive events in a shared preview.

Create a project/route and destination, edit or copy a template, test it, save a
draft and publish. Send a synthetic request to the displayed ingress URL. Inspect
the live event and its delivery attempts, including captured response details.
Pause delivery, leave the receiving route active, then resume or replay retained
work. Draft/helper edits must not change an already-published revision.

## Source development

Bun owns packages; Next.js and production integration tests run on Node. From the
repository root:

```sh
bun install --frozen-lockfile
bun run test:inventory
bun run typecheck
bun run lint
bun run format:check
bun run test:file tests/integration/organizations.test.ts
bun run test:affected packages/domain/src/ingress.ts
```

A licensed source build requires the official HeroUI Pro installer, using local
CLI login or an environment-provided CI credential. Never put its value in source,
build arguments or application runtime configuration. Run the pinned installer
from `apps/web` as documented in the CI workflow, then return to the root for
`bun run web:build` or `bun run web:dev` with the operator-owned development
configuration. Build prepares the standalone CSS, fonts and public assets.

Use disposable PostgreSQL/SMTP/HTTP fixtures for tests; the registered runner
creates them with Docker and synthetic data. `bun run db:push` is for an explicitly
selected disposable development database. Feature branches do not generate release
SQL. Master CI creates the coordinated migration after approved merge.

## Operator deployment

[Operator installation](../../docs/deployment/README.md) describes the prebuilt-only
`deploy/compose.yml`, configuration, restricted runtime database credentials,
SMTP, initial owner setup, network reachability and update order. No host Node/Bun
or Docker socket is required. The default executor mode is ordinary restricted
Docker/runc; optional runsc requires host installation and container recreation.
An unavailable explicitly selected runtime fails instead of silently falling back.

The Compose definition requires image references from one coordinated published
release. Those image digests and release SQL are not available on this branch yet;
do not substitute preview schema push or historical test SQL for a release.

## Owning validation lanes

Use scoped owners for local changes, then affected/final owners when justified:

```sh
bun run test:unit
bun run test:integration --collect-coverage
bun run test:executor --collect-coverage
bun run test:browser
bun run test:deployment --collect-coverage
bun run test:performance
bun run test:coverage
```

Next-consuming owners share the local standalone directory and must run serially.
Freeze runtime source through their build and test invocation. Different CI owners
have isolated runners/databases/ports and explicit concurrency budgets. Preserve
failures and reuse actual reports; do not silently increase deadlines or weaken
coverage thresholds. The performance owner stays uninstrumented.

Filtered source-mapped LCOV and Istanbul JSON can be collected from Node owners.
The standard function-location merger has real complementary/duplicate-report
canaries, but full-product/browser aggregation is not complete. The unit per-file
80% gate still fails and must not be represented as passing aggregate coverage.

## Release acceptance

- Verify exactly one owner bootstrap, real email-code sign-in, disabled default
  registration and inherited instance/organization/workspace/project boundaries.
- Verify original binary requests, exact protocol replies, rejection visibility,
  transaction rollback and acceptance only after durable work commits.
- Verify managed HTTP delivery, bounded retry/exhaustion, pause/resume, immutable
  code/secret pins, uncertain outcomes and replay with receiver deduplication.
- Verify scoped event/attempt visibility, live reconnect/revocation, local API
  documentation and scoped API-key access without owner-cookie fallback.
- Verify cleanup preserves active/reference-linked work, audit, usage and code.
- Measure the declared critical/bulk contention scenario with counts, hardware,
  cold-start policy and retained failures. A measured pass is not an SLA.
- Verify the published coordinated images, migration locking, restricted runtime
  roles, pending jobs across upgrade and complete backup/restore/rollback limits.

[Database recovery](../../docs/deployment/backup.md) documents archive, original
roles/grantor identity, external encryption keys and replay/rollback limits.
Historical migration fixtures, fresh-cluster mechanism tests and compatibility
startup checks do not certify published release upgrades. See the
[release checklist](../../docs/releases/alpha.md) for the remaining gates.

Organization foundation scenarios F01–F12 are implemented and recorded in
preflight: verified customer onboarding, two-organization isolation, scoped tokens,
lineage, local usage/capacity and commercially unlimited self-hosted defaults.
Payments, enterprise activation and hostile public-tenant hosting remain future
H01 work; no commercial quota or billing integration is claimed.
