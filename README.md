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

## What Payload Bay does

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

Payload Bay is in early development. This repository currently establishes the
product workspace and does not yet contain an installable implementation.

The first work proves the self-hosted ingress, durable persistence, delivery,
retry, and recovery path before public interfaces are stabilized.

## Development workflow

Core uses the shared [Payload Bay SpecKit setup](.github/speckit/README.md) with
Python helpers, Codex skills and the TDD extension. The
[project constitution](.specify/memory/constitution.md) records the current
architecture and test-first delivery rules. Feature specifications, plans and
tasks stay in this repository.

The shared preset arrives through Repository Baseline CI. Installing or refreshing
it is a separate local SpecKit step. The product test runner and verified TDD
profile are not established yet; those must be scoped and verified before the
first behavioral implementation. This setup does not implement webhook delivery.

## Architecture and development status

The approved foundation is an integrated Next.js/Node.js application,
PostgreSQL, Graphile Worker and Better Auth, using HeroUI for the dashboard and
Bun for dependency management. Operators will deploy prebuilt published Docker
images; web and trusted worker roles share one coordinated release. Configured
script execution requires a separately validated executor boundary.

A plain Next.js/HeroUI Pro web scaffold now lives in `apps/web/src/app`; use
`bun run web:dev`, `bun run web:typecheck`, `bun run web:lint` and
`bun run web:build`. Published images, database/worker/executor flows and the
product test suite are not implemented. Verified bootstrap checks are available
through `bun run test`, `test:file`, `test:affected` and `test:coverage`; see
[tooling bootstrap](docs/deployment/bootstrap.md). Optional gVisor execution is unverified; clean CI Pro
build prerequisites remain unresolved. Existing Supabase package scripts
are legacy experiment tooling, not the supported product startup path. See the
[current planning draft](specs/001-releasable-alpha/plan.md) for open decisions,
validation gates and migration scope.

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

This is the canonical product repository. It is intended to contain the
integrated web application, worker, shared API contract, public SDK, and official
integrations that ship as the Payload Bay product.

```text
apps/web/                  Integrated dashboard and HTTP API
apps/worker/               Trusted background job processing
packages/api-contract/     Versioned API and generated types
packages/sdk-node/         Public Node.js SDK
packages/integration-sdk/  Integration authoring contract
packages/integrations/     Official provider integrations
deploy/                    Self-hosting and deployment material
scripts/                   Product build and release tooling
```

The Payload Bay Runner is intentionally a separate repository. It is a CLI and
native-binary product with independent releases and a tested compatibility
relationship to Payload Bay server releases.

## Related resources

- [Payload Bay organization](https://github.com/payloadbay)
- [Payload Bay Discussions](https://github.com/orgs/payloadbay/discussions)
- [Brand guide](https://github.com/payloadbay/brand/blob/master/BRAND.md)
- [Organization standards](https://github.com/payloadbay/.github)

Public documentation, website, and Runner repositories will be linked here when
they are activated.
