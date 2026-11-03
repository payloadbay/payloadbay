# Pro replacement review: behavior contracts

This is an implementation study for the comparison, not approval to remove Pro.
Reviewed the installed Pro Stepper, AppLayout, Sidebar, their CSS and public
TypeScript interfaces, and the actual Payload Bay dashboard composition.
Pro remains imported normally in the reference; its implementation is not copied
into replacement code. The replacement bundle rejects Pro dependencies.

## What the source inspection established

- The header menu toggle only opens **mobile** navigation. Desktop collapse is a
  separate sidebar control/keyboard action. Showing a desktop burger in the
  replacement was incorrect.
- Desktop navigation is part of the shell layout, outside its header/content
  column. It stays present as the content changes. Desktop and mobile open state
  are separate. The breakpoint is 768px.
- Mobile navigation is a viewport portal. Its dimmed/blurred backdrop covers the
  viewport; the navigation panel is a side sheet, without card margins or rounded
  corners. Comparing this inside a small gallery can hide that distinction.
  Both columns now have a full-layout link.
- Pro provides contextual navigation primitives, close-on-action behavior,
  keyboard shortcuts, motion preferences and styling hooks. These are behavioral
  contracts, not just a screenshot to reproduce.
- Step connectors transition continuously between progress values; the default
  indicator completion also animates. Fractional progress is supported. A sampled
  final state is insufficient evidence of animation.
- Reduced-motion behavior needs explicit testing. The review lets the maintainer
  choose Animated, Follow device, or Reduced motion. Animated is the deliberate
  default for visual comparison; that is not a proposed production preference.

## Replacement options exercised by this prototype

Stepper: `currentStep`, `items`, `size`, `reduceMotion`, `className`, `style`.
Its accent is `--review-step-accent`, defaulting to the public HeroUI accent.
The progress connector works for any number of labels and fractional steps.

Navigation: `side`, desktop `width`, `mobileWidth`, `background`, `reduceMotion`
and `fullscreen` for the review. Public theme variables supply all surface colors.
The review controls demonstrate accent, surface, side and motion in both columns.
Menu selection closes mobile navigation; desktop navigation remains persistent.
Mod+B toggles navigation independently of the mobile-only header button.

## Verified and still outside this mockup

Browser checks exercise intermediate animation frames, explicit/system reduced
motion, keyboard selection, focus restoration, close-on-selection, viewport
coverage, side changes, colors, desktop persistence and overflow. TypeScript,
ESLint and formatting are checked separately.

This does not implement every Pro option. Full production integration, nested
resource-navigation parity, touch swipe physics, resizable panels, right-to-left
layout and physical-device keyboard/viewport behavior remain unapproved. The
existing production application is unchanged. Do not call the mockup a drop-in
replacement or treat it as a legal opinion.

## Revision 5 viewport and motion checks

Both columns have real desktop/mobile viewport presets and a full-navigation
screen. The mobile drawer keeps its positioning wrapper transparent and full
viewport width; only the panel receives a surface and a constrained width. This
also corrects right-edge placement.

With the pinned React Aria version, transitions only on a descendant did not
produce the intended panel entry/exit. The replacement now uses the public
`onEnter`/`onExit` promise hooks to animate the panel and backdrop and wait before
unmounting. Checks sample intermediate positions on both entry and exit, not just
state attributes. Command opening and viewport breakpoints are checked separately.

Revision 5 alone did not close the audit. Revision 6 below addresses the remaining
reported behavior gaps.

## Revision 6 regression work

The revision-5 gaps above are addressed in the review implementation:

- Search uses public React Aria Autocomplete with a Menu and keeps DOM focus in
  the input while keyboard selection changes. One overlay state coordinates search
  and navigation; callbacks dismiss only their own overlay.
- Desktop collapse hides labels completely and retains distinct icons, link names,
  current-page semantics and public HeroUI tooltips. The contextual back control
  changes the menu without navigating the page. Synthetic links exercise the app's
  cancelable before-navigate event and an unsaved-edit confirmation fixture.
- Traffic includes rejected requests; jobs uses succeeded/failed metrics. Tooltip
  rows come from supplied metric definitions, with integer and compact count axes.
- Accent background and foreground use matching public semantic tokens. Explicit
  reduced motion covers layout and portals; the licensed reference has a scoped
  review override so its connector/navigation also obey the chosen policy.
- Both comparison frames synchronize options. Full-layout links and the screen
  switch carry those options via the URL. Reference overrides stay in the reference
  stylesheet and are not imported into the replacement.
- Retry, no-icon and dashed empty-state fixtures supplement the approved preset.
  They are synthetic actions, not production data loaders.
- Obsolete connector styles and repeated breakpoint implementations were removed.

`verify-regressions.mjs` asserts keyboard filtering/selection/clear/dismiss,
exclusive settled overlays, right anchoring at 700px, rail tooltips and geometry,
context navigation, cancelable/unsaved navigation, semantic foreground contrast,
both real metric sets and low counts, empty-state actions and configuration transfer.
`verify-preview.mjs` additionally samples actual entry and exit motion and viewport
presets. These checks characterize this mockup, not the full product shell.

## Component-specific reduced motion correction

See [MOTION.md](./MOTION.md). The earlier blanket reference override and the
replacement's connector/tooltip/select suppression were too broad. Reduced motion
now preserves the reference stepper connector and the public tooltip/select
popover effects. Completion flourish, navigation movement and command-dialog
movement still stop. This intentionally updates the earlier connector assertion.

## Shared component extraction

The replacement gallery imports six implementations plus the overlay-coordination
hook from `src/app/components/ui/`. Shared components accept caller-owned items,
content and callbacks. Synthetic context, routes, permission fixtures and the demo
unsaved-edit prompt remain in the gallery. CSS uses a scoped `pb-` namespace.
Mobile drawer width and background are passed to the actual panel rather than
mutating document-wide variables. The mobile menu receives expanded navigation
even when the desktop rail was collapsed. Product screens now use the shared library; Pro and its installer have been removed.
