# Payload Bay UI/UX principles

These are reusable composition principles, not a feature checklist or a claim
that the current app satisfies them. The concrete dashboard findings remain in
`ux-audit.md`; the navigation direction below was approved by the maintainer.

## Context and hierarchy

Use breadcrumbs for navigable ancestors so users can return directly to a parent
resource. Give breadcrumbs the available width; preserve the first and nearest
levels, collapsing middle ancestors into a navigable menu when space is tight.
Global navigation stays separate from resource settings. Group settings
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
not an inline filter that replaces the navigation menu with a search list. Keep the search launcher clearly visible on its own contrasting surface in navigation,
including on mobile. Keep the command overlay and results separate from the menu. If launched
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
Bulk-selection presets choose records without unexpectedly changing the visible
collection filters. Keep selection criteria and the eventual action distinct.
Use category tabs only when there is a choice between working areas; a single
category needs a direct heading.

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
screens. Form inputs, selects, checkboxes and other controls that support
surface variants use `secondary` inside cards, papers and modals; the primary
variant still identifies the main action button. Put optional explanations behind
contextual help instead of filling a task screen with implementation details.
Safety-relevant effects should remain clear in concise labels and confirmations.

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

## Control behavior and consistent chrome

Use the same interaction primitive across equivalent forms. HeroUI NativeSelect
still opens a browser-native menu; use HeroUI Select/ListBox for the application's
selection controls, and ComboBox when users need suggestions or custom values.
A themed appearance alone does not prove library behavior. Audit rendered menus,
focus, keyboard selection and accessible names, not imports alone.

Place resource search consistently above the context/back controls with deliberate
spacing. Provide a discoverable keyboard shortcut for command search. Avoid
repeating the product identity in adjacent desktop chrome. Preserve a clear
full-width primary action in compact authentication forms on wide screens too;
secondary actions share a separate balanced row.

Use one trailing chevron in the final column to indicate row navigation. Repeated
row actions sit at the right edge, use consistent icon-only controls with
accessible names/tooltips, and keep destructive actions visually distinct.
Clickable rows must preserve independent child actions. A drag handle must be the
actual gesture start, show grab/grabbing cursors and retain keyboard alternatives.

Anchor account popovers to their header control, constrain them to the viewport,
and preserve focus when their contents change. Status labels use semantic chips.
Keep comparable working areas on consistent surfaces and verify stacked mobile
layouts rather than assuming desktop column layouts shrink correctly.

Explain user outcomes in plain language. Avoid raw scope terminology where the
resource name is available; emphasize that name when it helps orientation.
Distinguish configured credentials, a verified service connection and proven
end-to-end delivery. Describe retention by the deletion policy (keep indefinitely
or delete completed history after a period). Put implementation and security detail
in contextual help; keep concise effect labels beside potentially real actions.
Use ordinary punctuation for explanatory copy instead of decorative separators.

Verify live views through real domain actions, not only a connected indicator or
manually dispatched test event. Map subscriptions to every relevant outcome,
including acceptance and retention, and test recovery after a failed read or
stream gap. A live indicator must correspond to an actually refreshed view.

Configuration controls must have one authoritative source per setting. Show
whether a setting is deployment-managed or editable; never offer a dashboard
change that is silently shadowed elsewhere. Stored credentials use blank
replacement fields with explicit preservation behavior, never secret read-back.
Security policies must describe exactly what they enforce (for example,
enrollment versus a fresh authentication challenge) and keep enrollment/recovery
actions reachable when resource access is restricted.
