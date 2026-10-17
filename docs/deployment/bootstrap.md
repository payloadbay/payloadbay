# Development bootstrap and verification

The alpha branch contains the Next.js dashboard/API, Better Auth, PostgreSQL,
Graphile Worker and a workerd executor. It is still an unreleased alpha; a working
preview and scoped tests do not complete the published-image/upgrade gates.

Use Bun from the repository root:

```sh
bun install --frozen-lockfile
bun run test:inventory
bun run typecheck
bun run lint
bun run format:check
bun run test:file tests/integration/organizations.test.ts
bun run test:affected packages/domain/src/ingress.ts
```

Use `bun run test` for the complete registered suite at a verification milestone.
Run Next-consuming browser/deployment lanes sequentially: they share one local
standalone build directory. Development PostgreSQL/SMTP/HTTP fixtures use Docker,
synthetic data, random loopback ports and isolated databases. Tests never need a
production database or real SMTP account. Ignored run evidence lives under
`test-results/<run-id>`.

`bun run db:push` applies the authoritative Drizzle schema to a disposable
development database. Feature branches do not generate ordinary release migration
files; master CI composes one merged migration from schema plus runtime behavior.
The organization upgrade hook maps legacy workspaces before enforcing required
lineage. Historical mechanism fixtures are separate from current-source seeds.
Back up retained installations and use the released migration path for upgrades;
a development push is not a production upgrade mechanism.

## Identity and organization setup

One-time secret-protected owner setup creates an instance owner, a default
organization and a default workspace in one transaction. Admission alone is not
an instance role. Organization/workspace/project grants inherit downward.

`PAYLOADBAY_REGISTRATION_POLICY` defaults to `invite_only`. An operator can select
`organization` to test verified-customer registration: email code → organization
setup → default workspace → first project/route. Provisioning is idempotent and
does not grant instance administration. Existing invitees enter their assigned
scope; inactive instance admission must be restored by an operator.

Self-hosted standard operation does not require a cloud account, license heartbeat
or payment provider. Future hosted commercial rollout remains a separate gate.
Usage facts are local operational measurements, not a selected pricing model.

## Runtime and UI packages

Published images are the intended operator installation interface. Source builds
use HeroUI Pro's official installer credential as a BuildKit secret; a local CLI
login is not a remote build credential. Do not place licensed installer tokens in
source, Docker build arguments or runtime application configuration.

The executor defaults to ordinary restricted Docker (`runc`). Optional
`PAYLOADBAY_EXECUTOR_RUNTIME=runsc` requires host-installed/configured gVisor; an
unavailable explicitly selected runtime fails rather than silently downgrading.
The web app does not receive the Docker socket. `bun run sandbox:check` verifies
the selected host capability. Host gVisor validation and complete release-image
installation/upgrade evidence remain separately tracked acceptance gates.

## Verification artifacts and retention

`bun run test:coverage` runs the unit owners with fresh LCOV under that run's
`test-results/<run-id>/unit/coverage/` directory. The explicit checker reads the
per-file line/function minima from `bunfig.toml`, verifies required source files loaded,
and rejects missing reports or failing/empty tests. This measures unit-loaded
sources; it does not certify the application's complete production coverage.
Node, executor and deployment owners accept `--collect-coverage` for source-mapped
V8 LCOV, for example `bun run test:executor --collect-coverage`. This collects the
owning invocation once and removes raw V8 source-map caches before artifacts are
uploaded. It is collection evidence, not an aggregate threshold pass. Bun LCOV
does not identify individual functions, so summing its function counts with V8
would be invalid; cross-engine function merging remains an open gate. Compiler
children intentionally do not inherit diagnostic environment variables. Coverage
does not weaken that boundary.

Integration files that use Next share one parent-built standalone fixture before
parallel Node execution. Keep separate Next-consuming commands sequential.

Event retention defaults to disabled. See [event retention](retention.md) for
opt-in configuration, preserved unfinished work, irreversible deletion and the
remaining alpha verification limits.

## Alpha CI and external contribution review

The Alpha Validation workflow checks an immutable source SHA on fresh GitHub-hosted
runners, with separate static, unit, backend, executor, browser, performance and
deployment owners. The unit coverage command deliberately fails if a loaded file
misses the configured minimum; passing unit tests alone are not a coverage pass.
The current remaining coverage aggregation and published-release checks remain
release gates rather than being waived by this workflow.

Same-repository maintainer branches run automatically. External pull requests use
the trusted base `pull_request_target` workflow, which first verifies that
`alpha-ci-external` has required reviewers, without checking out the contribution.
A native GitHub environment review then authorizes the exact source SHA before
any check runner starts. That review authorizes running the whole contribution
with the installer credential; BuildKit and secret masking do not make malicious
approved code safe. New head commits require a new workflow authorization.
The external path becomes available once this workflow exists on master.

The source-controlled environment declaration lives in the central repository
baseline ([policy PR #30](https://github.com/payloadbay/.github/pull/30)); the
existing baseline workflow applies it after source approval. Missing or unreadable
protection fails closed. No new required branch-protection check is enabled until
the workflow has been validated. Coolify still owns PR previews separately;
this does not introduce a replacement deployment pipeline.

Configure `HEROUI_AUTH_TOKEN` as an encrypted repository Actions secret. Only the
licensed installer step receives it. Public dependency downloads are cached before
licensed installation; the licensed CLI uses a separate uncached directory.
Neither cache nor uploaded test evidence should contain the installer credential
or licensed dependency archives. Test runners receive no production credentials.

## Release migration container

`deploy/Dockerfile.migrator` builds a separate non-root, one-shot migration
image without HeroUI credentials or a host Node/Bun requirement. It includes the
CI-generated `packages/domain/drizzle` directory and runs the existing locked,
digest-checked release migrator. `MIGRATION_DATABASE_URL` is supplied only to
that privileged one-shot service, not to the executor. A branch with no generated
release SQL fails safely; it never substitutes development schema push.

The registered migration-container test uses an explicitly mounted synthetic
historical fixture directory. It proves packaging, auth/queue initialization and
idempotence, not installation of a published alpha. The production Compose and
published coordinated image gates remain open. See [database recovery](backup.md)
for the data, role, encryption-key and rollback boundaries.
