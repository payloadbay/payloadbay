# Published candidate acceptance

After an approved merge, download the release-candidate artifact containing
`images.env`, `compose.yml` and `source-manifest.json`. From the matching source
checkout, run:

```sh
node scripts/release/accept.mjs /absolute/path/to/candidate --validate-only
node scripts/release/accept.mjs /absolute/path/to/candidate
```

Validation alone checks immutable coordinates and cannot certify installation.
The full runner pulls the four published GHCR digests, verifies their common OCI
source revision and non-root users, then starts a unique disposable Compose
project. It uses real email-code bootstrap through Mailpit, creates and publishes
a route through the HTTP API, checks durable binary acceptance, forces a receiver
503 followed by success, checks retained failed-attempt history, and restarts the
worker/executor before checking the stored event again.

All three HTTP ports bind to loopback. The runner generates fresh credentials in
memory and removes only its own Compose project, volumes and temporary files.
It never receives an existing database URL or runs development schema push.
It prints a bounded summary without passwords, codes or session cookies. Failure
returns a nonzero exit status without printing potentially secret-bearing Docker
output. Run on a trusted Docker host with sufficient memory and registry access.

The successful result deliberately says `installation-and-delivery-passed`, not
release-ready. Fresh-cluster backup/restore and upgrade compatibility remain
separate release gates in [readiness](readiness.md). Source fixture tests do not
substitute for executing this runner against the actual published candidate.
