# Release policy

Payload Bay publishes coordinated, versioned releases of the app, worker,
executor, migrator and operator Compose definition. The landing website and the
future Runner are separate release boundaries. A preview deployment is not a
release.

## Versions and support

Use Semantic Versioning with Git tags: the first public prerelease is
`v0.1.0-alpha.1`. Increment the alpha suffix for another candidate in the same
release series. Publish alpha versions as GitHub **prereleases**, never as a
stable release or an unqualified `latest` image. Release notes must identify
breaking changes even before 1.0; alpha APIs, configuration and schemas can change.

During alpha, fixes target the current `master` and the newest published alpha.
Superseded alphas receive no separate maintenance or promised security backports.
Operators should upgrade using the documented path and keep recovery backups.
There is no alpha uptime SLA or guaranteed response deadline. Define stable-line
support and deprecation windows before the first stable release.

## Source and validation

The maintainer approves the implementation PR and its exact commit checks before
merge. Husky's full pre-push gate and GitHub CI retain their existing inventory,
behavior and per-file coverage requirements. Do not lower those gates to release.

Master CI owns append-only release SQL, including runtime database behavior.
Never use development schema push or synthetic historical test fixtures as an
operator migration. The `Generate Migrations` workflow uses the
`migration-generation` environment's `DEPLOY_KEY`; only `master` may access that
environment. Its dedicated repository write key can bypass branch protections
solely to allow the CI-owned generated SQL commit. GitHub applies this bypass to
all repository deploy keys, so do not add unrelated write keys. Keep key access
out of PR workflows. Revoke the repository key and replace the environment secret
together when rotating credentials or investigating compromise; private keys do
not belong in source, workflow artifacts or release assets.

The generated migration commit must complete its own full CI run. Candidate
publication requires that exact immutable master SHA, current real SQL and a
successful complete CI result. A green feature branch is insufficient.

## Build and publish

Run **Build Release Candidate** from `master` for the eligible full SHA. Build
all four Linux amd64 images before publishing any; verify their non-root runtime
identity and apply the packaged release SQL twice to disposable PostgreSQL17.
ARM images are not supported until separately built and certified.

Candidate tags are unique to source SHA, workflow run and attempt. Record all
four immutable image digests from `candidate/images.env`; never combine images
from different candidates. The GitHub Actions run and source SHA establish build
provenance. The current pipeline does not sign images or issue provenance/SBOM
attestations; do not claim cryptographic verification until it is implemented
and verified.

Before promoting a candidate, complete independent acceptance against its exact
published digests:

1. Install on an empty persistent PostgreSQL17 database using the operator
   Compose definition and restricted app/worker logins.
2. Complete one-time owner bootstrap through real SMTP, sign in, publish a route
   and verify a real accepted event reaches a controlled HTTP receiver.
3. Verify failed delivery, retry and inspection, including immutable publication
   references. Upgrade with pending jobs and retained code pins when a previous
   release exists. For the first release, record first-install/idempotent-restart
   evidence and the historical upgrade mechanism evidence separately; do not
   claim an upgrade from a public version that never existed.
4. Back up database and cluster roles, restore to a separate fresh PostgreSQL17
   target with the original encryption key and ownership/ACLs, and verify a
   controlled pending delivery. Preserve the original database until acceptance.
5. Record source, real schema migration, SDK/protocol/date, Docker runtime,
   published digests and observed results in a release-specific manifest.

The candidate also exports a compressed archive of these same four image tags,
its checksum, immutable local image IDs and a no-pull Compose override. Verify
archive installation independently; never replace published-image acceptance with
a local source rebuild. This distribution path needs no GHCR credentials.

Create the version tag on the accepted source SHA, then a GitHub prerelease with
release notes, operator Compose, immutable `images.env`, the image archive/local
coordinates/checksum/override, and the completed
manifest. Include setup, changes, known limitations, required migrations,
recovery guidance and the supported architecture. Versioned image aliases may
point to the accepted digests; operator instructions must retain digest pins.
Do not rewrite an existing version tag or silently replace its release assets.
If a candidate fails, fix source and publish a new candidate/version.

## Operator upgrades and recovery

Follow [operator installation](../deployment/README.md) and
[database recovery](../deployment/backup.md). Take a complete backup before a
schema/image transition, pause ingress and job consumption, run the coordinated
migrator and verify readiness before resuming traffic. List supported upgrade
origins explicitly in each release. Release history is append-only.

A prior image is not automatically compatible with a newer schema. Roll back
only to an explicitly certified compatible image, or restore the complete prior
database into a separate target with its matching configuration and encryption
key. HTTP effects cannot be undone by database restore. At-least-once delivery
requires receiver deduplication, including after retry, replay and recovery.

## Hosted alpha

Start invitation-only with trusted script publishers and operational backups.
Platform administration must not grant access to customer project contents;
customer membership remains explicit. Ordinary restricted Docker is the approved
trusted-publisher runtime. Optional gVisor/runsc and hostile public multi-tenant
execution are separate validation gates. Do not advertise unrestricted public
registration, paid plans, enterprise activation or an enterprise-grade sandbox
until those systems and operational checks are complete.

Production SMTP, database credentials and encryption/signing secrets remain in
operator secret storage. Disposable preview data, accounts, Mailpit and preview
credentials must never be reused for the hosted instance. Publish no real
customer events in examples or release evidence.

## Security and deprecation

Report vulnerabilities through the
[private security process](https://github.com/payloadbay/.github/security/policy).
Assess affected versions privately and release the fix on the latest supported
line; coordinate disclosure and describe operator action once safe. Do not place
undisclosed exploits or credentials in public release notes.

Document removals and configuration changes in release notes with the exact
replacement and operator action. During alpha, notice may arrive with the next
prerelease; no compatibility or long-term support promise is implied. Stable
policy changes require an explicit maintainer decision before a stable release.
