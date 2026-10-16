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
