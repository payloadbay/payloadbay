# Database recovery

Payload Bay keeps domain records, authentication, immutable code/publications and
Graphile jobs in PostgreSQL. A backup must retain all of these schemas together.
Backing up event rows alone cannot recover accepted deliveries.

The migration-image and archive tests are registered in
`tests/deployment/migrator.test.ts`. They exercise a real PostgreSQL 17 custom
archive, including binary request bytes, original publication references, queued
jobs, encrypted secrets, immutable-code triggers and the restricted retention
function's ownership/execute privileges. The restore target is an empty database
in the disposable test cluster, where the original roles already exist. This is
mechanism evidence; cross-host published-release recovery remains a release gate.

## Backup contents

Use the PostgreSQL 17 client supplied by the PostgreSQL container. `pg_dump
--format=custom` creates a consistent database archive without needing a host
PostgreSQL, Node or Bun installation. Check its exit status before treating the
archive as a usable backup. Keep the archive outside the database volume and
protect it as private application data.

Keep the matching release/image digests, database role definitions, runtime
configuration and encryption key separately in the operator's secret storage.
The database archive does not contain the environment encryption key. Losing it
makes stored encrypted credentials unusable; changing it is not a recovery step.
Authentication secrets and external SMTP configuration are also operator-owned.

A database dump does not include PostgreSQL cluster roles. A fresh host needs the
original owners and runtime roles provisioned before restoring object ownership
and ACLs. Never substitute `--no-owner` or `--no-acl` to hide missing-role errors:
that can broaden SECURITY DEFINER authority or remove access restrictions.

## Restore order and rollback limits

1. Stop ingress and workers. Keep the previous volume and backup untouched.
2. Provision a separate empty PostgreSQL 17 target with the matching roles.
3. Restore the archive using `pg_restore --dbname <target> --exit-on-error
   --single-transaction`, retaining object ownership and ACLs.
4. Restore the matching encryption/configuration secrets and coordinated app,
   worker and executor versions. Check migration history and readiness before
   reopening ingress or allowing workers to claim pending jobs.
5. Inspect a queued event, its pinned publication and encrypted credentials, then
   verify controlled delivery before switching traffic.

An archive cannot undo HTTP effects already performed after it was taken. Restored
pending work may repeat delivery; receivers must deduplicate. An application image
rollback is not a destructive database downgrade. After a schema change, use only
an explicitly tested compatible image or recover the complete earlier database
snapshot into a separate target. Published upgrade/rollback compatibility is not
established by the historical migration fixtures.
