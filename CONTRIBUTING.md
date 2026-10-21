# Contributing to Payload Bay

Follow the organization [contribution guidelines](https://github.com/payloadbay/.github/blob/master/CONTRIBUTING.md)
for issues, branches, pull requests, review and AI disclosure. This repository
adds the following preview testing guidance.

## Local push checks

Run `bun install --frozen-lockfile` after cloning. Its `prepare` lifecycle installs
Husky's repository-local hooks. Commit or stash local changes before pushing so
checks validate the committed source. Every push runs `bun run check:push`: test inventory,
web/tooling type checks, lint, formatting and all registered test lanes. A failed
check blocks the push; the hook does not rewrite files. The complete suite requires
Docker, Node.js, Bun, ripgrep and Playwright Chromium (`bun x --no-install playwright
install chromium`). Allow several minutes for builds and integration tests.

Hook installation is skipped in CI, production and source archives without Git. CI remains the required merge
gate, including coverage checks and clean dependency installation; local hooks
cannot prevent deliberate bypasses or predict remote service failures.

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
the ephemeral database and seeds known synthetic accounts across two unrelated
organizations, their workspaces, projects and ingress routes. Edits within a PR are shared among its reviewers and
are intentionally lost on the next deployment.

Choose an account from the preview details below and enter its email normally.
An operator may configure `PAYLOADBAY_LOGIN_HINT` as plain explanatory text on
the email-entry step; there is no account dropdown or email prefill. All accounts
use normal email-code login through Mailpit:

| Account                                  | Access                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `reviewer@preview.payloadbay.test`       | Instance owner; all organizations, projects and instance administration.         |
| `organization-owner@preview.payloadbay.test` | Owns Example customer only; its workspace, project, members, code and usage. |
| `project-admin@preview.payloadbay.test`  | Administrator of Demo integrations only; no workspace or instance administration. |
| `project-viewer@preview.payloadbay.test` | Read-only metadata for Demo integrations; no payload reading or mutations.        |

An Admin-only example project is visible only to the instance owner. These shared
accounts exercise real permission boundaries; they do not isolate public reviewers
from one another, because anyone can also choose the demo owner.

Mailpit captures login
and other preview emails; no production SMTP provider is configured. Reviewers do
not need GitHub maintainer access. Mailpit is publicly accessible without a separate login on disposable previews. Email codes remain real,
expiring Better Auth codes; no fixed password or authentication bypass is added.

The fixed reviewer identity and its instance-owner access must remain usable.
Preview-only protections prevent demoting that account even after adding another
owner. Better Auth email changes are not enabled. Runtime encryption/authentication
keys and SMTP routing belong to deployment configuration and
are not editable through the product dashboard. Reviewers may edit project test
secrets, routes, scripts, destinations and other demo data.

Use provider test-mode webhooks and synthetic payloads only. Do not connect real
Stripe payments, use production API keys, send private customer data or rely on
preview data retention. Preview mode shows this warning at runtime. A warning is
not a sandbox guarantee: configured code currently assumes trusted publishers.
The goal is an openly usable browser demo for contributors and reviewers, without
GitHub maintainer requirements. Before privileged demo access is made public, verify
the executor sandbox, preview outbound network restrictions and resource limits.
No anonymous hostile-tenant security claim is made by the current version.

For deployment details and the observed verification limits, see
[Coolify previews](docs/coolify-previews.md).
