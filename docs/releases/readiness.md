# Release readiness

The initial implementation is reviewed in PR #13 and has not been released. A working preview is
not a published installation or a completed coverage gate.

Verified mechanisms include real SMTP owner/login flows, tenant/permission
boundaries, durable acceptance and delivery/retry/replay, actual workerd
execution, scoped live UI, local usage/policy and retention. The test ledger and
preflight record exact source checkpoints and counts.

Release packaging now includes a separate non-root one-shot migrator and an
operator Compose definition using published-image references. Migration tests
explicitly mount historical synthetic SQL; missing CI-generated release SQL
fails. PostgreSQL17 archive tests preserve binary events, pinned publications,
pending jobs, encrypted secrets and original security-definer ownership/ACLs.
A separate fresh-cluster exercise restores roles before owned database objects.
These are mechanism tests, not a published-image installation certificate.

## Verified source checkpoint

PR #13 source commit `098a7b764765191c997f5a0453b392c673bde9d9`
completed [CI run 41569541003](https://github.com/payloadbay/payloadbay/actions/runs/41569541003)
with all 589 checks passing and 310 of 310 executable source files meeting the
unchanged 80% line/function minima. This is the last verified source checkpoint;
subsequent dependency changes require their own complete checks. Current status
is available on [PR #13](https://github.com/payloadbay/payloadbay/pull/13).

The maintainer has requested merge preparation only. Keep the PR open, with
automatic merge disabled; do not publish images, create a release or deploy the
persistent instance without renewed approval.

## Dependency review (2026-11-14)

The dependency audit is separate from functional CI. This review found advisories
that predate the last successful CI; that run did not establish dependency-audit
clearance. Compatible updates now pin Nodemailer 10.1.4, DOMPurify 3.4.18 and
Undici 7.30.1. Root overrides cover the exact transitive versions pinned by
Monaco and Scalar; remove them when upstream requirements include the fixes.
The refreshed audit reports no high or critical advisories.

Four lower-severity findings remain visible, without an audit-ignore rule:

| Dependency | Current path and exposure | Follow-up |
| --- | --- | --- |
| [deepmerge 4.3.1](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Low severity; React Email → html-to-text merges formatter options. `email-renderer.tsx` passes only rendered HTML to `toPlainText`, never caller-supplied merge options. No patched upstream release is available in this review. | Update when fixed; re-evaluate before adding configurable formatter options. |
| [esbuild 0.18.20](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | Moderate severity; Drizzle's legacy development loader uses transform APIs, not the affected HTTP development server. The executor uses the separate patched 0.28.2 version. | Update the loader through Drizzle; never expose this legacy esbuild server. |
| [glob 13.0.6](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Moderate severity; c8/test-exclude uses repository-controlled paths in the coverage process. No customer request or script supplies its patterns or cancellation signal. | Adopt the upstream coverage dependency update; avoid an unverified major override. |
| [minimatch 10.2.6](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Moderate severity; coverage and TypeScript lint tooling consume developer-controlled repository globs. Customer input does not reach these patterns. | Adopt compatible upstream tooling updates; re-evaluate if this becomes a runtime matcher. |

These are scoped exposure assessments, not a claim of a vulnerability-free
application. Re-run the audit before publishing the actual release candidate.

## Remaining release gates

Before merge/publication:

- Product licensing is the unchanged GNU AGPLv3 (`AGPL-3.0-only`), with its
  license included in runtime images. Commercial redistribution remains allowed
  under the license's source-sharing obligations.
- The [release policy](policy.md) defines versioning, support, security fixes,
  publication ownership and first-alpha acceptance.
- Migration authentication was configured on 2026-11-03: `DEPLOY_KEY` is an
  encrypted secret in the master-only `migration-generation` environment, with
  one dedicated repository write key. The maintainer approved enabling deploy
  keys for the organization and the ruleset retains its other protections.
  Generated SQL commits may bypass that ruleset and trigger complete CI. The
  local private key was deleted. The actual first master workflow run remains
  the end-to-end verification of this configuration.

After approved merge:

- Produce the master-CI-owned release SQL after approved merge; never generate an
  ordinary release migration locally or replace it with development push.
- Publish coordinated app, worker, executor and migrator image digests without
  credentials or proprietary UI sources in final artifacts.
- Prove clean installation, one-time bootstrap and first delivery using those
  published digests and restricted runtime database logins.
- Prove pending-job/code-revision upgrade and complete backup/restore against the
  actual release; document rollback compatibility rather than promising downgrade.
- Record exact schema, SDK, executor protocol/date, image and host-runtime evidence
  in the release manifest. Historical bootstrap images are not release digests.

Ordinary restricted Docker is the approved trusted-publisher default. Optional
runsc remains a separate operator-host validation; no hostile-tenant sandbox or
physical Android keyboard certification is claimed. Hosted billing/licensing and
commercial plan integration remain separate future work.

## Coordinated candidate images

The manual **Build Release Candidate** workflow is prepared for use after the
implementation is approved and merged. Select the master workflow and provide the full
master commit SHA. It rejects unmerged source, absent release SQL/journal,
database-source changes after migration generation, and any SHA without a
complete successful master CI run. The branch preview remains
separate; no candidate workflow has been executed yet.

The workflow builds app, worker, executor and migrator together on Linux amd64.
All UI dependencies are public; no UI installer credential is used.
All four final images must use the non-root node identity. The packaged real
release SQL must install and repeat successfully on disposable PostgreSQL17
before any images are pushed. This cannot run against the current unmerged
implementation, which deliberately has no CI-generated release SQL.

Successful runs push unique candidate tags and export `candidate/images.env`
with the exact source SHA and immutable image digest for each service, together
with the operator Compose and repository source manifest. The source manifest
is a template/readiness record; `images.env` records that run's actual published
coordinates. A partial push can leave some images behind but cannot produce a
successful candidate run. No floating version tag or GitHub release is created.

Use those four digests for the independent operator install, real owner/email
bootstrap, first HTTP delivery, pending-job/code-pin upgrade and backup/restore
acceptance. Candidate publication and repeated SQL alone do not certify those
flows, optional host runsc or a hostile public multi-tenant service. ARM image
publication and multi-platform certification are not claimed by this workflow.
