# Event retention

Event retention is disabled by default. Operators may set
`PAYLOADBAY_EVENT_RETENTION_DAYS` to an integer from 1 to 36500 in the trusted worker
configuration; 0 disables automatic pruning. Keep this setting consistent across
worker replicas. The current preview does not enable retention.

The existing worker checks on startup and once per minute. PostgreSQL deduplicates
one scheduled maintenance job per installation, configured window and UTC hour.
Cleanup uses a reserved maintenance slot, separate from email and event-delivery
capacity. Each transaction removes at most 100 events and queues a durable
continuation when that batch is full. Recovery and retry preserve maintenance
priority. No extra service, Docker socket or operator command is required.

An arrival timestamp alone is not sufficient to delete an accepted event. Every
associated execution must be terminal with an immutable terminal usage fact older
than the configured window. Recent receipts, pending or uncertain HTTP operations,
unended attempts, derived events and external replay references prevent deletion.
Accepted events missing their processing record are preserved for investigation.
Legacy terminal records without trustworthy completion facts are also preserved.
The window currently uses PostgreSQL whole-day intervals in the worker database
session's timezone; configure PostgreSQL sessions to UTC for consistent elapsed-day
behavior.

Eligible event bodies, receipts, execution/replay records and delivery attempts
are removed together. Publications, code, usage facts/counters and audit history
are retained. Cleanup writes an aggregate instance audit record without request
bodies. It does not erase backups, SMTP messages or externally delivered data.
Take and test backups before enabling irreversible deletion.

The database deletion capability belongs to a dedicated NOLOGIN role. Application
roles cannot use it; the trusted worker can invoke only the bounded function.
Ordinary immutable-history guards remain active. Replay locks the event before
creating work. Cleanup locks candidates, then rechecks eligibility in a fresh READ
COMMITTED statement; a concurrent replay cannot be removed using a stale snapshot.
Deletion, continuation, audit and lease-fenced completion commit or roll back
together.

Current verification covers actual PostgreSQL role boundaries, both replay race
orders, lease-expiry rollback, bounded continuation, peer scheduling and reserved
Graphile capacity. This is not yet published-release install/upgrade/restore
certification. Retention setting display and scoped live deletion updates remain
follow-up work before the alpha retention gate is closed.
