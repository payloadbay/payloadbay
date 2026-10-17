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

## Search and command navigation

Cross-application search is a dedicated command palette: a focused overlay with
its own input, results and available actions. A search field or icon is a launcher,
not an inline filter that replaces the navigation menu with a search list. Make
application search accessible independently of the navigation drawer, especially
on mobile. Keep its search interaction and results outside the menu. If launched
while navigation is open, close the drawer before opening the palette rather
than stacking competing overlays.

Make result intent explicit, such as Jump to a resource or Run an action. Show
enough resource type and context to distinguish destinations, provide clear/reset
and dismiss controls, and support keyboard selection. Preserve the working page
when search is dismissed and apply unsaved-change protection before navigation.
Collection-local filters remain beside their collection; they are a different
interaction from cross-application command search.

## Collections and editing

Choose layout from the task: tables for scanning/comparing repeated records,
cards for summaries, and dedicated working areas for complex editing. Keep
collection search, filters and actions together; use consistent row actions.

Use a modal for a bounded create/edit task that should preserve the surrounding
context. Center ordinary dialogs on desktop; use deliberate responsive placement
on phones. Use the library’s modal primitive for these tasks rather than a
bottom sheet on every screen. Navigation drawers retain their navigation role. Use a page for substantial ongoing work. Avoid inserting forms that
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

## Workflow coherence

Keep closely related work in one coherent working context. Do not turn a natural
step within a task into a prerequisite configuration screen merely because the
implementation stores it separately. Reveal supporting tools where the task
needs them, with clear transitions and a way back.

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
For a preview handoff, push the changes, confirm the deployed revision and verify
the actual preview before describing it as ready. State device/emulation limits
and remaining work explicitly.

## Applying review feedback

Translate feedback into reusable principles and complete task flows, rather than
only fixing the named control cosmetically. Carry an already-clear requested
direction through implementation, verification and deployment; do not invent a
new confirmation gate. Ask only when a material ambiguity remains. Keep concrete
screen requirements and unfinished findings in the feature/audit documents,
separate from these general principles.

## Reference findings

The maintainer approved the Coolify-derived principles and mobile hierarchy
drilldown on 2026-10-15. The regression-review learnings and dedicated command
palette distinction were approved for persistence on 2026-10-16. Exact screen
structure and feature behavior belong in the relevant specification. Generalize new review findings here only when they
apply beyond one feature; keep individual fixes in the audit backlog.

Linear mirror: [Payload Bay UI/UX principles](https://linear.app/thedannicraft/document/payload-bay-uiux-principles-2d0a0ebce882). Keep general principles here; keep screen-specific acceptance criteria in the feature specification and audit.

## Loading feedback

Center pending-state feedback within the surface being loaded. Use a HeroUI
spinner and a short accessible label; screen startup fills the viewport, while
panel loading stays local and preserves useful surrounding controls. Keep loading,
empty and failed states distinct. Stop the spinner on failure and offer recovery.
Respect reduced-motion preferences and avoid moving the working surface when an
editor or other embedded tool becomes ready.
