# Operator installation

The operator definition is `deploy/compose.yml`: PostgreSQL, Payload Bay app,
worker and executor, plus a one-shot migrator. It uses prebuilt images and a
persistent database volume. It does not build source, install host Node/Bun,
mount the Docker socket or require gVisor for the default mode.

This branch is an unreleased candidate. Published coordinated image digests and
the master-CI-generated migration are not available yet. Do not substitute the
preview schema-push service for the release migrator. The release checklist in
[alpha readiness](../releases/alpha.md) distinguishes tested mechanisms from
published installation evidence.

## Configuration

Use one operator-owned environment file with Docker Compose's `--env-file` flag.
Store it outside Git with permissions limited to the operator. Configure:

| Setting | Purpose |
| --- | --- |
| `PAYLOADBAY_APP_IMAGE`, `PAYLOADBAY_WORKER_IMAGE`, `PAYLOADBAY_EXECUTOR_IMAGE`, `PAYLOADBAY_MIGRATOR_IMAGE` | Digests from one coordinated release |
| `PUBLIC_URL` | The externally reachable HTTPS origin used for links/authentication |
| `POSTGRES_PASSWORD` | Privileged database credential, supplied to PostgreSQL and the migrator only |
| `PAYLOADBAY_APP_DATABASE_PASSWORD`, `PAYLOADBAY_WORKER_DATABASE_PASSWORD` | Distinct runtime credentials of at least 32 characters |
| `BETTER_AUTH_SECRET`, `PAYLOADBAY_ENCRYPTION_KEY`, `PAYLOADBAY_BOOTSTRAP_SECRET` | Independent secrets of at least 32 characters; retain the encryption key with recovery configuration |
| `PAYLOADBAY_EXECUTOR_TOKEN`, `PAYLOADBAY_BROKER_SECRET` | Independent internal capability credentials of at least 32 characters |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Real SMTP transport for passwordless sign-in and notification email |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | Optional SMTP authentication and implicit TLS selection |

The release migrator provisions `payloadbay_web` and `payloadbay_jobs` logins
with the existing app/worker role privileges. Runtime processes receive their own
password through `PGPASSWORD`, keeping it out of connection URLs. The executor
receives neither a database login nor authentication/SMTP secrets. Do not reuse
the database administrator password for runtime credentials.

`SMTP_SECURE=true` selects implicit TLS, typically port 465. With port 587,
`SMTP_SECURE=false` uses the SMTP transport's STARTTLS negotiation. Development
Mailpit is intentionally absent from the operator stack.

`PAYLOADBAY_REGISTRATION_POLICY` defaults to `invite_only`. The optional
`organization` policy enables verified customer onboarding without granting
instance administration. `PAYLOADBAY_EVENT_RETENTION_DAYS=0` keeps event retention
disabled. `PAYLOADBAY_LOGIN_HINT` is optional plain sign-in information and grants
no privileges or authentication bypass.

## Startup and access

Once a coordinated release is available, run Docker Compose with that release's
operator environment file. PostgreSQL readiness precedes the single migration
service; the app and worker require its successful completion. The worker also
validates executor protocol/SDK/date readiness before starting jobs. A failed
migration or incompatible executor prevents job startup rather than silently
continuing with an unsupported stack.

Port 3000 binds to loopback by default for a local reverse proxy. Set
`PAYLOADBAY_BIND_ADDRESS`/`PAYLOADBAY_PORT` for a different published binding;
Coolify can proxy the app's exposed port 3000 on the service network. Configure the
proxy for the public URL, forwarded request headers and long-lived SSE responses.
The executor, worker broker and database are not published host ports.

Open `/setup` for the one-time owner flow and supply the bootstrap secret. Email
codes must arrive through the configured SMTP transport. After verification, the
instance creates its default organization/workspace; public signup remains off
unless organization onboarding was explicitly selected.

Destinations are reached from the worker's network. A destination's `localhost`
refers to the worker container, not the Docker host or another application. Use a
reachable service DNS name, LAN address or host routing configured by the
operator. Private destinations are supported; ingress data cannot choose a
configured destination's URL and redirects remain disabled.

## Updates and recovery

Use one coordinated app/worker/executor/migrator release. Stop ingress and worker
consumption before a schema/image transition, take a complete backup, run the
release migrator, then verify readiness before reopening traffic. Do not assume
an arbitrary old image supports a new schema. At-least-once delivery and receiver
deduplication still apply after replay or restore.

See [database recovery](backup.md), [executor modes](executor.md) and
[retention](retention.md). Optional `PAYLOADBAY_EXECUTOR_RUNTIME=runsc` needs a
host-installed Docker runtime and container recreation. Selecting it on an
unsupported host fails container creation; the default remains ordinary
restricted Docker. Configured mode is not host isolation attestation.
