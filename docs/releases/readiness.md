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

Before release:

- Complete source-mapped cross-owner coverage with the unchanged per-file minima
  and a complete executable-source inventory.
- Complete the affected final owners and reconcile original acceptance evidence.
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
