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
actual browser flows are required; this list does not declare the entire release
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

## Maintainer review follow-up — 2026-10-15

Approved reusable principles are in [ui-ux-rules.md](ui-ux-rules.md), also recorded
in Linear's project document. This section tracks concrete corrections separately
from those principles. Coolify source inspection informed the navigation grouping,
collection toolbars and viewport-bounded dialog composition; it was not a browser
verification of Coolify.

Changes implemented and exercised in scoped validation:

- Home is a traffic overview: exact authorized hourly aggregates, ingress
  accept/reject/response-only totals, processing executions, outgoing attempt
  outcomes, a graph, recent executions and project links. Project management has
  its own page. Statistics count outgoing retries individually.
- Global navigation is separate from grouped resource settings. Hierarchy browsing
  in the mobile drawer preserves the working page; search can open authorized
  projects/workspaces/pages directly. Ancestor breadcrumbs provide direct return.
- Preview notice and opaque brand header share the fixed application shell.
  Brand uses unchanged dark-transparent assets from merged brand PR #14; headers supply their own spacing. Account menu is personal, with a
  danger-colored sign-out; instance administration stays in global navigation.
- Resource creation and notification-rule editing use bounded overlays. Routes,
  destinations and secret inventory use collection tables. Secret creation and
  binding are separate overlay tasks rather than appended forms.
- Helper bindings insert visible imports into full ingress source. New helper
  names update untouched starter functions; middleware starts with indentation.
  Sheet actions sit outside the scrolling editor body; wheel scrolling can leave
  Monaco at the boundary. Scoped browser checks cover mobile editor save/close and narrow dialog bounds; real-device touch behavior remains a manual review item.
- Incoming request history records reject/response-only outcomes and bounded handler failures without
  delivery jobs. Requests and outgoing delivery attempts have separate views;
  each attempt row opens its original request history. Both refresh through SSE.
- Replay explains original/current published code and is available only for
  accepted requests. Rejected requests cannot bypass ingress through replay.

Ingress persistence here covers bounded requests to an active route, including
handler/executor failures and invalid outcomes as non-accepted error records.
Unknown/unpublished routes and transport size rejection are not retained. A
pre-handler ledger surviving a process crash before outcome recording is not
implemented by this change. Accepted-event and
job creation remain atomic, including rollback on database/queue failure.

The navigation guard remains a custom shared hook for linked navigation, editor
closure and beforeunload; it is not the next-navigation-guard package. Browser
back interception is not claimed by that hook.

Verification is recorded after each actual run. Earlier acceptance counts above
refer to the prior pushed baseline, not automatic approval of this working tree.


### Verification for this review pass

- Full dashboard acceptance: 27 passed. A subsequent five-case rerun passed after
  the final dialog-heading changes (resource configuration, event inspection,
  helpers/middleware, notification rules and mobile hierarchy/search).
- Mobile/editor/bootstrap acceptance: 8 passed.
- Final chart follow-up uses HeroUI Pro LineChart and its existing Recharts peer.
  Focused mobile navigation/overview acceptance passed again, asserting actual
  12px tick text, readable rendered bounds and no page overflow at 320px.
- Ingress integration: 20 passed, followed by the additional handler-error-history
  case passing separately. Rejected and response-only requests retain history
  without dispatch; queue failures still roll accepted work back atomically.
- Delivery/replay: 15 passed. Live API/SSE: 18 passed. Contracts: 27 passed.
- Preview seed/runtime notices/reviewer protection: 3 passed.
- ESLint, TypeScript, Prettier, test inventory and diff whitespace checks passed.

These are scoped runs, not a full release certification. Generated OpenAPI/Scalar
screen parity, published-image installation/upgrade, complete recovery/performance
and optional host runsc release gates remain separate work. Preview verification
is recorded with the pushed revision in Linear PAB-66.


## Second mobile review — 2026-10-16

The maintainer's new findings, refreshed Coolify source index, confirmed defects,
and proposed coherent navigation/editor pass are in
[ux-review-2026-10-16.md](ux-review-2026-10-16.md). The maintainer clarified the
scope/native-import changes were already requested; that implementation and its
verification are now recorded there separately from remaining review follow-ups.

## Current reconciliation — 2026-10-17

See [the chat-feedback reconciliation](ux-review-2026-10-17.md). Later R01–R06
work supersedes earlier snapshots that still describe separate helper-import or
request/attempt screens. Personal and organization API-key settings are newly
tracked gaps, not previously implemented UI. Physical Android viewport behavior
and the independent release gates remain unverified.

## Maintainer review — 2026-10-17

The current follow-up covers mobile breadcrumb context, coherent workspace
navigation actions, secondary form controls on surfaces, secret-field autofill
hints and mobile search layout, an editor-backed HTTP playground, optional
script-test help, removal of the route's single-category tab strip, independent
bulk-selection presets, publication history as a table, and delivery-attempt
selection with response inspection. Validation evidence is recorded separately;
this list alone is not a completion claim.

### Additional findings and follow-up direction

These are source-audit findings, not newly implemented behavior:

- A bare endpoint middleware deep link (`/code/endpoint/:id`) without its
  project-context query crashes the shell. Normal contextual navigation includes
  the query and passes. Confirmed on the pre-review source as well; resolve the
  endpoint ancestry rather than assuming a project object exists.
- The mobile request-client toolbar leaves too little width for its URL input.
  The separate receiving URL remains available, but the client itself should
  give the editable URL its own usable row.

- The approved confidentiality follow-up now starts customer authorization and
  code inheritance at the organization boundary in both deployment modes.
  Instance roles cannot read customer audit or install inherited customer code;
  explicit customer memberships remain independent. See docs/permissions.md.

- The HTTP playground has no cancellation control or explicit response-size
  boundary. A slow or unusually large response can leave a reviewer waiting or
  consume browser memory. Consider bounded capture plus Cancel, retaining the
  actual HTTP result and clearly marking truncation.
- Synthetic testing exercises one handler, not the effective middleware chain.
  The main screen now keeps the explanation behind contextual help. A separate
  full-flow simulation would need to pin the same middleware/helpers as a live
  publication and show which stage stopped execution; it must preserve the
  synthetic secret and network-effect boundary.
- Code-editor load/format failures still render inline error text. This differs
  from the agreed toast policy; a follow-up should distinguish retryable editor
  availability from field syntax diagnostics rather than treating both as banners.
- Publication history remains immutable. Archiving should be presentation
  metadata, and deletion must preserve every publication referenced by stored
  events/executions. The current follow-up adds activation, not destructive
  version removal.
- Helper collections still use cards. Converting these management collections
  to comparable table rows is a separate composition change, with the editor
  remaining the working surface.

Browser emulation does not establish physical Android keyboard/pull-to-refresh
behavior. Those interactions still need a real-device check.

### Verification for the 2026-10-17 follow-up

ESLint, web/tooling TypeScript and changed-source Prettier pass. Scoped backend
runs pass authorization20/20, organizations23/23 and organization policy7/7.
Eleven distinct browser flows pass: U116, U83, U300, U157b, UX54, U265, U301,
U292, mobile overview/hierarchy, UX53 and K01. Final mobile geometry checks the
current breadcrumb itself, not just its container. Native clipboard paste sends
edited JSON body and headers through the real receiving endpoint. Publication
activation preserves queued version pins; response inspection switches attempts
and refreshes when an open attempt completes. These scoped results do not claim
all release gates or physical-device behavior have passed.

Final screenshot review also exposed wrapped breadcrumb labels. The added
one-line bound failed at40px, and the native-slot selector correction passes
both geometry checks. The final two-flow run and mobile screenshot confirm
single-line ellipses with navigable middle ancestors and real clipboard paste.


## Review follow-up — 2026-10-21

- Event inspection now has consistent HTTP metadata and status chips. Processing
  attempts are persisted separately from delivery attempts, selected newest-first,
  and include interrupted leases. Result text requires payload-reading permission.
- Notification-module forks expose compiler diagnostics and Monaco problems.
  Notification SDK types are available in the editor; overflowing widgets use
  viewport positioning. The module page renders its unsaved-change dialog.
- Forking is an icon action beside module operations, separate from the built-in
  status chip. Route activation uses Publish; the redundant header dirty chip is
  removed while discard protection remains.
- Graphs use the local component catalog and format hourly instants in the viewer's
  timezone. Usage windows likewise display browser-local dates.
- Instance shared-code UI is removed while organization boundaries remain intact.
- Managed HTTP defaults and [request protection](request-protection.md) follow the
  maintainer's clarified design. Project-wide script-triggered notifications and
  stage-specific helper libraries remain proposals, not implemented features.

Registered regression checks exercise these flows. Exact-commit pre-push and CI
results establish branch validation; published-release and deployed acceptance
remain separate gates.
