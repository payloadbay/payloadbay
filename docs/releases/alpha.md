# Alpha release readiness

The alpha remains in draft PR #13 and has not been released. A working preview is
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
  installer credentials or raw licensed sources in final artifacts.
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
