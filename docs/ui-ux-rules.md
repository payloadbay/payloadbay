# Payload Bay UI/UX principles

These are reusable composition principles, not a feature checklist or a claim
that the current app satisfies them. The concrete dashboard findings remain in
`ux-audit.md`; the navigation direction below was approved by the maintainer.

## Context and hierarchy

Use breadcrumbs for navigable ancestors so users can return directly to a parent
resource. Global navigation stays separate from resource settings. Group settings
by task; keep the active group expanded and expose in-page subsections only for
the active page. Search must support direct navigation across authorized pages
and resources, as well as contextual settings; label its scope explicitly.

Make the current scope obvious. Place settings beside the resource they affect,
and distinguish personal preferences from shared administration. Reveal relevant
choices progressively instead of mixing every scope into a flat menu. A resource
context replaces irrelevant global controls; do not repeat its ancestry as a
second navigation block when breadcrumbs already provide that path. Default
resource task groups open and distinguish menu Back from page navigation.

Browsing a navigation hierarchy, opening a destination and jumping within a page
are different actions. Give them distinct controls and predictable back behavior.
Keep the same information architecture across desktop and mobile, adapting its
presentation rather than removing capabilities.

## Collections and editing

Choose layout from the task: tables for scanning/comparing repeated records,
cards for summaries, and dedicated working areas for complex editing. Keep
collection search, filters and actions together; use consistent row actions.

Use a modal for a bounded create/edit task that should preserve the surrounding
context. Use a page for substantial ongoing work. Avoid inserting forms that
unexpectedly move the content the user was interacting with.

## Flow and feedback

Show the current step and its relevant inputs. Carry context forward and provide
a clear way back without repeating completed steps. Do not require the user to
infer the state from unrelated controls or redundant status messages.

Give each task one clear primary action. Use bottom toasts for transient action
feedback, local messages for field validation, and durable notification surfaces
for issues that need later attention. Do not use inline success/error banners.
A visible resulting state often needs no additional success toast.

## Controls and language

Inspect HeroUI's available components and composition guidance before choosing
controls. Use semantic library variants and the established brand tokens rather
than hand-styling substitutes. Keep control choices consistent across similar
screens.

Name things by what the user can do or understand. Explain consequential choices
where they occur. Make configuration, simulation and real execution visibly
distinct. Show inputs and their resulting output in a connected layout.

## Mobile and working surfaces

Keep orientation and essential actions reachable. Constrain overlays to the
actual viewport; allow their content to scroll without hiding their controls.
Avoid competing scroll regions and test editors with touch interaction.

Treat persistent chrome as a coordinated layout: account for stacked notices,
headers and content offsets. Prevent overlap and preserve useful working space.
Do not assume desktop spacing or library defaults work unchanged on a phone.

## Source editing

Make the displayed source match the executable model. Provide useful types,
formatting, discoverable guidance and visible dependencies. Protect lifecycle
contracts without making the editor feel like disconnected form fragments. Prefer
native language imports and real exported symbols over separate forms that invent
a different dependency model. Explain and preserve immutable version pins.

## Verification

Review complete tasks, not isolated screenshots. Verify narrow mobile and desktop
layouts, keyboard/paste, focus, back/cancel behavior, unsaved changes, scrolling,
and loading/empty/error states. Report actual verification separately from source
inspection. Do not call a flow complete merely because its controls render.

## Reference findings

The maintainer approved the Coolify-derived principles and mobile hierarchy
drilldown on 2026-10-15. Exact screen structure and feature behavior belong in
the relevant specification. Generalize new review findings here only when they
apply beyond one feature; keep individual fixes in the audit backlog.

Linear mirror: [Payload Bay UI/UX principles](https://linear.app/thedannicraft/document/payload-bay-uiux-principles-2d0a0ebce882). Keep general principles here; keep screen-specific acceptance criteria in the feature specification and audit.
