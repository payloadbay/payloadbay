# Contributing to Payload Bay

Follow the organization [contribution guidelines](https://github.com/payloadbay/.github/blob/master/CONTRIBUTING.md)
for issues, branches, pull requests, review and AI disclosure. This repository
adds the following preview testing guidance.

## Preview deployment approval

Maintainer/team PRs deploy automatically under Coolify's repository-members-only
policy. External PRs need a maintainer to inspect the current commit and explicitly
trigger its preview in Coolify. New commits must be reviewed before another
maintainer-triggered deployment. Approval concerns running submitted code, not
who may functionally review the resulting preview. No custom approval service is
required.

## Disposable PR demos

Each PR preview has its own PostgreSQL container and synthetic dataset. The
preview stack builds directly from the PR branch; no merge to master or published
product images is required. Preview deployment recreates the containers, resets
the ephemeral database and seeds the same known demo identity and sample workspace,
project and ingress route. Edits within a PR are shared among its reviewers and
are intentionally lost on the next deployment.

Use `reviewer@preview.payloadbay.test` for email-code login. Mailpit captures login
and other preview emails; no production SMTP provider is configured. Reviewers do
not need GitHub maintainer access. The preview operator shares the Mailpit access
credential with reviewers outside source control. Email codes remain real,
expiring Better Auth codes; no fixed password or authentication bypass is added.

The fixed reviewer identity and its instance-owner access must remain usable.
Preview-only protections prevent demoting that account even after adding another
owner. Better Auth email changes are not enabled. Runtime encryption/authentication
keys, SMTP routing and Mailpit credentials belong to deployment configuration and
are not editable through the product dashboard. Reviewers may edit project test
secrets, routes, scripts, destinations and other demo data.

Use provider test-mode webhooks and synthetic payloads only. Do not connect real
Stripe payments, use production API keys, send private customer data or rely on
preview data retention. Preview mode shows this warning at runtime. A warning is
not a sandbox guarantee: configured code currently assumes trusted publishers.
The goal is an openly usable browser demo for contributors and reviewers, without
GitHub maintainer requirements. Before privileged demo access is made public, verify
the executor sandbox, preview outbound network restrictions and resource limits.
No anonymous hostile-tenant security claim is made by the current alpha.

For deployment details and the observed verification limits, see
[Coolify previews](docs/coolify-previews.md).
