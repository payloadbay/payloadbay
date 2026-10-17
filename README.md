<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/payloadbay/brand/master/dist/logo/payloadbay-logo-dark-rounded.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/payloadbay/brand/master/dist/logo/payloadbay-logo-light-rounded.svg">
    <img src="https://raw.githubusercontent.com/payloadbay/brand/master/dist/logo/payloadbay-logo-light-rounded.svg" alt="Payload Bay" width="640">
  </picture>
</p>

<p align="center">
  <strong>A safe landing place for every event.</strong>
  <br>
  Receive instantly. Deliver reliably.
</p>

<p align="center">
  <a href="https://payloadbay.dev">Website</a>
  ·
  <a href="https://github.com/orgs/payloadbay/discussions">Discussions</a>
  ·
  <a href="https://github.com/payloadbay">GitHub organization</a>
</p>

# Payload Bay

Payload Bay is an open-source, self-hosted platform for receiving, verifying,
storing, routing, delivering, retrying, replaying, and inspecting events.

External providers send to a stable endpoint. Payload Bay verifies and stores
the original request, creates durable deliveries, and makes attempts, failures,
and recovery visible before an event reaches an HTTP target or private
application runner.

## Why Payload Bay

Webhook providers should not need to be coupled directly to every application
they notify. Payload Bay is being built as the controlled layer in between.

It receives an event at a stable endpoint, verifies the original request,
stores it durably, routes it to the right destination, and makes delivery
outcomes visible. Applications can then receive events through HTTP targets or
outbound runners without exposing every destination directly to providers.

## Product direction

- **Receive** webhooks through stable canonical URLs and custom aliases.
- **Verify** provider signatures against the unchanged request body.
- **Persist** events and receipts before acknowledging the provider.
- **Route** events to HTTP targets or outbound application runners.
- **Deliver** asynchronously with honest at-least-once semantics.
- **Retry and replay** failed or previously received events.
- **Inspect** payloads, deliveries, attempts, responses, and incidents.
- **Reach private applications** without exposing inbound webhook endpoints.

## Mission

> A safe landing place for every event.

Payload Bay is being built to give webhooks and other events a reliable place to
arrive before they reach an application.

It should receive the original request, verify it, retain it, deliver it through
a controlled path, and make failures visible. The goal is a platform that lets
applications depend on events without being directly coupled to every provider's
availability or delivery behavior.

## Community

Payload Bay is an open-source project first. We want Community to be a capable,
self-hosted product that people can use because it is good software, not because
a limited free tier happens to fit their current quota.

A self-hosted project should not become less useful because it receives more
events, adds another source, connects another runner, or reaches an arbitrary
product limit. Hobby projects, independent developers, small teams, and small
businesses should be able to use the core platform without paying to remove
constraints deliberately placed in their way.

Donations and sponsorship are optional ways to support the project.

## Project status

Payload Bay has an implemented, unreleased alpha in [draft PR #13](https://github.com/payloadbay/payloadbay/pull/13).
The dashboard and API support organization/workspace/project setup, passwordless
sign-in, editable ingress/processing, helpers, middleware, secrets, publication,
queued HTTP delivery, retries/replay, live inspection and opt-in notifications.
Self-hosted usage is locally measured without default commercial quotas. Pull
runners, payments and enterprise activation remain later work.

This is not a published operator release. Coverage, coordinated release images,
clean operator installation, upgrade and backup/restore gates remain open. See
[preflight](specs/001-releasable-alpha/preflight.md) for exact evidence rather than
treating the product direction above as a list of shipped guarantees.

## Development workflow

Core uses the centrally distributed [Payload Bay SpecKit setup](.github/speckit/README.md)
with Python helpers, Codex skills and the TDD extension. The
[constitution](.specify/memory/constitution.md), feature specification, tasks and
verification ledger remain project-owned. Shared presets arrive through Repository
Baseline CI; local SpecKit initialization/refresh is a separate step.

The stack is Next.js/React on Node.js, HeroUI Pro, Better Auth, PostgreSQL/Drizzle,
Graphile Worker and a separate workerd executor. Bun manages packages and unit
feedback. Restricted Docker/runc is the default executor mode; optional runsc
requires host setup and has not been attested on this installation.

Use [development bootstrap](docs/deployment/bootstrap.md) for prerequisites and
isolated test owners. `bun run web:dev` starts the web development server;
`bun run test:file <registered-file>` and `bun run test:affected <changed-path>`
provide scoped feedback. Static checks are `bun run typecheck`, `bun run lint`
and `bun run format:check`. `bun run test:coverage` still fails its per-file gate;
passing tests alone are not coverage certification. No Supabase tooling is needed.

Published Docker images are the intended operator interface. Source-built
[Coolify previews](docs/coolify-previews.md) already exercise the app, worker,
executor and disposable database, but are not a production installation guide.
Master CI generates release migrations; feature branches never generate them
locally or substitute development schema push for a production upgrade.

## Contributing

Contributions, feedback, and real-world requirements are welcome.

Before starting non-trivial work, read the
[contribution guidelines](https://github.com/payloadbay/.github/blob/master/CONTRIBUTING.md),
search existing Issues and Discussions, and coordinate the intended outcome.

- Use [Q&A](https://github.com/orgs/payloadbay/discussions/categories/q-a) for
  installation, configuration, troubleshooting, and usage help.
- Use [Ideas](https://github.com/orgs/payloadbay/discussions/categories/ideas)
  for early product proposals and feedback.
- Use [GitHub Issues](https://github.com/payloadbay/payloadbay/issues) for
  reproducible bugs and concrete feature requests ready for review.
- Use the [private Security Policy process](https://github.com/payloadbay/.github/security/policy)
  for suspected vulnerabilities.

## Repository boundaries

This is the canonical product repository. Its implemented source boundaries are:

```text
apps/web/                  Integrated dashboard and HTTP API
apps/worker/               Trusted background job processing
apps/executor/             Bounded TypeScript compilation and workerd execution
packages/contracts/        Public Zod/OpenAPI and internal typed contracts
packages/domain/           Authorization, persistence, queue and delivery services
packages/script-sdk/       Configured script lifecycle types
deploy/                    Self-hosting and deployment material
scripts/                   Product build and release tooling
```

The future pulling Runner remains a separate repository and release boundary;
this alpha does not ship that product or claim tested server compatibility.

## Related resources

- [Payload Bay organization](https://github.com/payloadbay)
- [Payload Bay Discussions](https://github.com/orgs/payloadbay/discussions)
- [Brand guide](https://github.com/payloadbay/brand/blob/master/BRAND.md)
- [Organization standards](https://github.com/payloadbay/.github)

Public documentation, website, and Runner repositories will be linked here when
they are activated.
