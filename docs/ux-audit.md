# Application UX audit — 2026-10-15

Reviewed: web routes and shared UI source, official HeroUI design/styling/composition
references, local desktop/mobile Chromium authentication checks, and real PR #13
email delivery through Mailpit and sign-in to the authenticated root dashboard.
This is a source audit plus scoped browser verification, not a claim that every
management operation has passed end-to-end browser acceptance.

## Changes from this review

- Root application instead of bootstrap landing page; no unshipped legacy route.
- Canonical logo, editable preview identity, secondary inputs on surfaces.
- Separate email and OTP stages; no success toast for advancing the form.
- HeroUI InputOTP with numeric input, paste, keyboard editing and incomplete-code guard.
- Bottom toasts with mobile safe-area spacing; errors preserve the current form stage.
- Compact brand/navigation header and avatar account menu instead of permanent email/logout controls; account settings edits the display name through the existing Better Auth endpoint.
- Scannable project table, with workspace detail collapsed into the project cell on mobile, and HeroUI Pro NativeSelect workspace filters.
- Project-local official HeroUI skill and web instructions; central library-neutral AGENTS baseline PR.

- Event and member initial-load failures now show unavailable/retry instead of false empty states.
- Notification inbox distinguishes initial loading, unavailable/retry, and a successful empty response.

- Mobile navigation now mounts HeroUI Sidebar.Mobile as well as the desktop sidebar; browser coverage opens, dismisses and navigates through the drawer.
- Dashboard scope/settings structure is drafted in [dashboard-navigation.md](dashboard-navigation.md), with existing coverage and missing pages distinguished.

## Completed follow-up from the maintainer's review

- Login uses the canonical transparent logo inside its card. OTP paste strips
  non-digits, including surrounding whitespace. Normal email → code progression
  does not toast. Action feedback remains at the bottom of the viewport.
- The header has an opaque background. Desktop keeps the contextual sidebar;
  mobile uses its drawer. Route navigation separates scripts, middleware, helper
  imports, secrets, dry testing, published-request playground, events and history.
  Workspace views expose their own projects, members, code and notification rules.
- Receiving URL labels sit outside the URL/copy row. The URL scrolls horizontally
  within that row. Save/publish actions center on narrow screens.
- Editable ingress files export named uppercase HTTP methods; unsupported methods
  return 405. Processing and middleware keep protected lifecycle signatures.
  Monaco uses Web Worker/ES libraries, horizontally scrolling source, SDK hover
  information and bound helper source. A scripting guide explains the lifecycle.
- Template selection stays visible after applying its editable code. Saving runs
  the repository Prettier settings. Shared-code and route editors warn before
  linked navigation, reload, or editor closure discards changed source.
- Helpers have real source files and pinned bindings (`@shared/ImportName`). The
  preview includes DemoHelpers. Secret and helper bindings use tables; empty
  secret inventories explain that a version must be created before binding.
- A real playground sends the selected HTTP method to the published ingress URL.
  Dry tests select stage/method and use synthetic secrets with simulated managed
  delivery. The two paths are explicitly distinguished in the UI.
- Event tables work across authorized projects, with workspace/project/state
  filters, authenticated SSE, and route-specific inspection. Metadata visibility
  does not grant payload visibility. Preview seeding publishes the sample route
  and runs two synthetic events through real ingress, receipts and queued jobs.
- Membership tables include inherited access. Instance views list admitted users;
  workspace/project views list applicable memberships. Invitations retain chosen
  scope, roles and customized permissions while pending, support cancellation,
  and apply access only after verified sign-in and acceptance. New admission
  requires instance permission; project invitations do not grant workspace access.
- Personal SMTP subscriptions are separate from workspace/project failure rules.
  Workspace rules aggregate descendant failures; project rules can target a route
  or destination. No failure rule or email subscription is enabled by default.
  Forms use HeroUI NumberField, NativeSelect and Checkbox controls.
- Account security supports actual Better Auth passkey registration, sign-in,
  listing and removal, with email-code recovery. Authentication checks active
  admission when creating sessions, including passkey sessions.

Verification is recorded with the implementing PR. Unit/integration checks and
actual browser flows are required; this list does not declare the entire alpha
release complete. Update/version alerts and endpoint health checks remain
explicitly deferred product features, as agreed with the maintainer.

## Guidance ownership

The official skill is vendored unchanged under `.agents/skills/heroui-react`,
with its Apache-2.0 license, from `heroui-inc/heroui` revision
`7a6cbbd6f6622f2562d26349f4728033b626706b`. `apps/web/AGENTS.md` links it
and requires catalog discovery, component docs, installed-type checks and actual
interaction testing. Use the unified Pro MCP for Pro-specific controls. Central
baseline PR https://github.com/payloadbay/.github/pull/28 stays library-neutral
and uses the existing AGENTS distribution path. It was merged as `ae400620`; distribution is owned by the baseline workflow.

References:

- https://heroui.com/en/docs/react/getting-started/design-principles
- https://heroui.com/en/docs/react/getting-started/styling
- https://heroui.com/en/docs/react/getting-started/composition
- https://heroui.com/en/docs/react/getting-started/agent-skills
