# Forkable notification channels and email configuration

Authorized for implementation on 2026-10-16, after the outstanding dashboard
review fixes. This document describes the intended contract, not shipped behavior.
It extends the earlier notification-inbox proposal: its statement that no custom
notification runtime was required described the earlier alpha scope, which the
maintainer has now expanded.

## Ownership and configuration

Instance administrators manage a channel catalog in instance settings. Built-in
channels appear alongside custom channels. Built-ins are versioned and read-only;
Copy and customize creates an independently versioned instance-owned adapter.
Changing a copy never mutates the built-in or another installation. Email is the
first shipped channel. An administrator can write a Discord or WAHA adapter
without waiting for a bundled provider integration; this is a notification channel
system, not an unrestricted application plugin marketplace.

Personal Notification settings selects enabled channels/preferences. Workspace
and project notification rules remain scoped to their resources and inherited
permissions. No failure thresholds are enabled by default. Publishing adapters
requires instance administration; merely managing a project does not grant it.

## Runtime and delivery

Use the existing isolated script executor, bounded network capabilities and
secret references. Never evaluate adapter source in Next.js or the trusted mail
worker. Adapters receive a typed, redacted notification context, recipient/config
and allowed secrets; they return a checked delivery result. Notifications never
include stored webhook payloads by default. Queue delivery with durable attempts,
current-recipient permission checks, deduplication and bounded retries. A failed
channel must not recursively notify itself forever. Preserve delivery uncertainty:
external sends cannot be promised exactly once.

The catalog, published versions, copies, credentials and user subscriptions need
real persistence, API authorization and usable UI. Do not ship placeholder buttons
for unavailable providers. Selecting a new adapter version must be explicit;
queued deliveries pin the version they were created with.

## Shared email body

Clipify's `src/server/notifications/templates/layout.tsx` uses React Email for a
shared branded wrapper with subject/preheader/title/content/code/action slots,
a plain-text alternative, email-safe inline styles and dark-mode treatment.
Reuse that approach with Payload Bay's own brand tokens and assets, not Clipify's
purple visual identity.

Proposed structure: responsive single-column card (maximum 600px), compact brand
header, clear title, body text, optional prominent selectable login code or one
primary action, fallback action URL, then a concise reason-for-receiving footer.
OTP, invitations and notification alerts all use this same wrapper. Render a
plain-text alternative. Links use the configured installation URL. Layout must
remain legible with images blocked and on a narrow phone screen.

Instance settings owns branding, shared presentation and per-message templates,
with preview, test-send, validation and reset to the shipped version. Template
content cannot change OTP generation, verification, expiry, recipients or access
policy. SMTP transport credentials stay in deployment secrets initially. Adapter
credentials remain separate secret references and must not be embedded in source,
HTML, test output or audit diffs. Template previews use synthetic values; actual
codes are never shown in administrative template previews.

## Verification gates

Verify catalog/copy/version permissions; custom adapter execution and limits;
secret redaction; retry/deduplication and revoked recipients; safe email escaping;
plain-text fallback; mobile previews; actual Mailpit OTP/invitation/alert flows;
and the self-hosted Docker path. Update schema source with Drizzle push for
fixtures; release migrations remain CI-owned.

## Implemented contract under verification (2026-10-16)

The implementation is on the alpha branch and remains under verification until
its commit and deployed revision are recorded. The administrator surfaces are
`/admin/notification-channels` and `/admin/email`; personal opt-in remains under
`/account/notifications`. There is no general-purpose plugin loader.

The shipped `smtp` module is immutable trusted platform code. Its displayed source
returns `ctx.email(ctx.message)`; a fork compiles and executes the same typed
contract in the existing workerd service. Custom modules are never evaluated in
the Next.js process or the Graphile Worker process. Instance settings permission
and code read/edit/publish permissions are required to publish. Project/workspace
administrators do not gain instance publishing rights from those scopes.

A module exports `sendNotification(ctx: NotificationContext)` and returns one of
`ctx.email(message)`, `ctx.complete()`, `ctx.retry({ reason, delayMs? })`, or
`ctx.fail({ reason })`. `ctx.kind` distinguishes login codes, invitations, delivery
alerts and synthetic tests, so a fork can customize each email without another
provider subsystem. The context includes a delivery ID, attempt number, fixed
recipient, structured message, logs and explicitly bound instance secrets.
Custom HTTP modules can use Web APIs and `fetch` for Discord, WAHA or another
service. Those providers are not presented as shipped integrations.

Every queued message pins an immutable module revision and shared-branding
snapshot. Publishing changes affects new jobs. Selecting an older version changes
future jobs without rewriting history. Disabling a custom module prevents queued
sends; the selected transactional email module must be replaced before it can be
paused. Retries use the existing durable platform queue and current recipient /
subscription / admission checks. HTTP side effects remain at-least-once; modules
can use `ctx.deliveryId` as the receiver's idempotency key.

Dry tests use synthetic messages and secret placeholders, block external fetch,
and do not send email. Explicit published tests queue real effects and are capped
at five per administrator per minute; SMTP recipients are fixed to that
administrator's current verified account email. Authentication codes and invitation
URLs are redacted from runtime logs. SMTP transport credentials are never exposed
to module source or the browser. Custom email modules intentionally receive the
message's real authentication content during delivery; only trusted instance
administrators can select that code. Reset restores shipped branding and the
shipped email adapter without deleting custom modules or their versions.

The shared wrapper uses React Email, inline email-safe styles, a plain-text
alternative and Payload Bay branding. The email header asset is copied unchanged
from [the central brand repository](https://github.com/payloadbay/brand/blob/master/dist/logo/payloadbay-logo-light-rounded-512w.png).
Preview HTML is placed in a sandboxed iframe with a restrictive content policy;
remote images are allowed, while scripts, forms and navigation are not. Shared
presentation previews use synthetic content, not current OTPs or invitation URLs.
SMTP host, sender and credentials remain deployment configuration. No extra mail
provider, Redis, plugin process or Docker socket is introduced.
