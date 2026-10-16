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
