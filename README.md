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

## Project status

Payload Bay is in early development. This repository currently establishes the
product workspace and does not yet contain an installable implementation.

The first work proves the self-hosted ingress, durable persistence, delivery,
retry, and recovery path before public interfaces are stabilized.

## Community and Enterprise

Payload Bay is an open-source project first. It is being built to be a capable,
reliable webhook platform that people can run in their own infrastructure.

Community is not a trial tier. It is the core product.

A Community installation is intended to run without a Payload Bay account,
activation server, central Community cloud, or external license validation. Its
operator controls the installation, infrastructure, data, domains, secrets, and
operational decisions.

The Community direction includes the reliability-focused core: receiving,
verifying, storing, inspecting, routing, delivering, retrying, and replaying
events; HTTP and runner delivery; provider integrations; API access; rate
limits; abuse protection; alerts; and self-hosting deployment options.

Payload Bay does not intend to create artificial limits for events, workspaces,
sources, targets, or runners merely to make people upgrade. Hobby projects,
independent developers, small teams, and small businesses should be able to use
the core platform without paying to remove deliberately imposed constraints.

Capacity is determined by the infrastructure an operator chooses to run. Payload
Bay does not promise that every installation can handle every workload.

Donations and sponsorship are voluntary ways to support the project.

Enterprise is planned for organizations with genuine governance and operational
requirements, such as workspace isolation, granular permissions, teams, scoped
service accounts, auditability, identity integrations, external secret
management, managed operations, support, and commercial terms.

Enterprise helps fund continued development and makes Payload Bay easier to run
in those environments. It is not intended to sell fundamental webhook
reliability. Retries, replay, runners, and core provider integrations remain
part of the Community direction.

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
Supabase backend, dashboard, shared API contract, public SDK, and official
integrations that ship as the Payload Bay product.

```text
supabase/                  Backend schema, Edge Functions, queues, and Cron
apps/dashboard/            Dashboard application
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
