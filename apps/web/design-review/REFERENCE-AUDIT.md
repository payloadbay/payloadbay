# Reference composition audit, 2026-10-20

The reference uses installed Pro 1.0.0-beta.10, with its stylesheet imported.
The official live documentation was also opened in Chromium: 50 Pro component
pages, including their iframe demos. The gallery has 52 entries because Tooltip
is public HeroUI and the generic Chart entry uses the chart composition.
Documentation and the installed release can differ; neither a green render sweep
nor this audit certifies every upstream variant or constitutes visual approval.

## Corrections

| Area                 | Reference and independent implementation                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bar chart            | Verified computed cursor fill and 0.05 opacity in both columns; the local tooltip no longer uses a bright generic cursor.                                                                                                                                            |
| Agenda               | Real controlled create/move/resize callbacks, shared events and add-event modal. Day/week/month examples match, view controls are segmented, Today sits between the navigation arrows. Local calendar uses weekend shading, compact weekday headings and 60px hours. |
| Floating TOC         | Both examples have real article context, adjacent labels and bars, matched hover/press and left/right placement examples.                                                                                                                                            |
| Timeline             | Shared meaningful titles/details/statuses/times. Default, centered milestones, studio review, compact log, incident, version history, repository activity and split-content compositions appear in both columns. Fixed narrow-screen reference overflow.             |
| Widget and content   | Widget header separates title and description; code blocks identify their language and use a matching highlighting theme. Local Markdown tables fill their container.                                                                                                |
| Numbers and resizing | Locale-aware decimal/currency/percentage/compact examples; matching disabled and currency stepper examples. Resize line/pill/drag/vertical handles are selectable in both columns.                                                                                   |
| Cell fields          | Fixed selectors against actual public HeroUI classes. Aligned trailing select values, color canvas/hue widths, slider hover indication and compact field geometry. Matched optional hex input in the reference.                                                      |
| Drop zone            | Visible dashed border, cloud upload icon and ghost browse action; matched disabled example.                                                                                                                                                                          |
| Editor               | Real matched slash-command and read-only examples. Local suggestion menu portals to the document and clamps to the viewport, rather than inheriting the transformed comparison container.                                                                            |
| Layout and navbar    | Shared navigation groups, icons and surfaces. Local mobile navbar expands beneath its header with animated presence, hamburger/close state and scroll locking. It no longer opens an unrelated bottom sheet.                                                         |
| Context actions      | Tested long-press and action selection with touch events and mobile platform detection, plus existing keyboard/right-click checks.                                                                                                                                   |
| Emoji                | Reference selection now updates its trigger. Local selection, filtering and tone handling continue to use the Unicode dataset and public selection primitives.                                                                                                       |

## Review controls

The gallery remains one synchronized scrolling page. The **Example** selector
changes the corresponding example in both columns. Each selector includes a link
to the official component page. Additional independent regression fixtures are
separate (`catalog.html?fixture=…`), rather than mixed into one comparison column.
The reference retains its own component CSS; no blanket motion suppression is
used. Motion checks retain the documented per-component policy.

## Verification

- `verify-catalog.mjs`: all 52 entries, both columns, 390px and 1024px; runtime errors, overflow and accessible-name warnings.
- `verify-reference-parity.mjs`: matching selected variants, real calendar creation, slash-command placement/application, slider hover and synchronized variant selection.
- `verify-review-interactions.mjs`: paired bar-hover opacity, TOC placement, mobile navbar open/close, touch context actions and emoji selection. Chromium's platform detection is explicitly emulated for the iOS long-press path; this is not a Safari device test.
- `verify-catalog-interactions.mjs`, `verify-source-contracts.mjs`, `verify-parity-gaps.mjs`: default and advanced control, drag, virtualization, keyboard, clipboard and scrolling contracts.
- Original preview/regression/motion checks and content safety checks remain in place.
- Scoped ESLint, TypeScript, formatting and diff whitespace checks.

Live-doc screenshots/accessibility snapshots and paired render screenshots are
kept under `/tmp/pab-live-browser/`, `/tmp/pab-matched-*` and
`/tmp/pab-mock-current/` for this review session. The mock server stays on port 4173. Physical-device Safari/Android behavior and production integration are not
established by these checks. Pro remains installed pending review and migration.

## Maintainer review follow-up

The next hands-on review found discrepancies that the checks above had not
covered. The earlier passing results did **not** establish behavioral parity.
The failure was translating source inspection into too few acceptance checks:

- A callback firing was treated as proof of the interaction. The calendar had
  per-hour buttons, while the reference selects an interval by dragging.
- CSS overrides accumulated. A later 1px resize width could not defeat its earlier
  10px minimum width; inline selects retained a content-width override.
- Approximate theme choices were accepted without comparing computed styles.
  The list hover, radar grid and stepper therefore used different surfaces.
- Closed-state screenshots did not cover thumbnail proportions, open tone
  controls, arrow alignment, emoji grapheme layout or the exact hover target.
- Desktop geometry was used in calendar calculations, although installed Pro
  changes its hour height from 60px to 48px on narrow screens.

The follow-up removes conflicting rules for the affected controls and consolidates
calendar declarations. It adds `verify-review-feedback.mjs`: paired computed-style
and geometry checks plus forward/reverse range creation, click creation, cancel,
header scrolling, skin-tone selection and joined-emoji rendering. Calendar
keyboard entry remains available without introducing visible clickable tiles.
The calendar keeps actual scrolling through the day, with hidden scrollbars as
in the reference; its day headings remain outside that scrolling surface.

The default navbar now exposes the menu toggle on desktop too, matching the
installed reference. Its open menu is constrained to the space below the header.
The independent TOC's pointer hover target is the line stack; keyboard focus and
press activation remain available. Native emoji font fallback and unbroken
Unicode sequences are supplied as caller content in both columns.

### Additional code-audit findings

The confirmed caller-class and inline-style defects are now fixed. Widget slots
retain supplied classes; field wrappers compose classes through React Aria's
render-prop helper where supported. ColorPicker accepts a static class name,
matching its public primitive API. ListView retains static and state-based classes
and styles, including item render props and children. Virtualized mode owns height,
overflow, display and padding while preserving other caller styles. NativeSelect
retains caller styles; full-width mode owns only width on the select and wrapper.

`verify-styling-props.mjs` exercises these contracts at 390px and 1024px using the
separate styling fixture, including state changes and virtualized rows. The
approved comparison presets are unchanged.

The installed Pro skin-tone trigger also nests a native button inside the public
popover trigger's button-role wrapper. The independent version uses a direct
React Aria button with DialogTrigger context, preserving one semantic control.
The reference retains its installed implementation; vendor internals were not
patched or copied into the independent library.

### Focused library audit

What this code does: The independent components provide interactive dashboard
controls for the local review gallery. This audit assumed ordinary desktop and
mobile use, including virtualized collections of about 500 rows and the Unicode
emoji dataset. Backend delivery, tenancy, billing and authentication were outside
this follow-up.

The two confirmed customization findings (caller classes and caller layout styles
being overwritten) are resolved by the follow-up above. The shared wrapper scan
also covered existing forwarding in charts, feedback controls, resizable panels,
setup steps and navigation; no additional dropped class/style props were found.
This does not establish complete upstream API equivalence.

Not checked: Physical Safari/Android rendering, complete upstream API coverage,
production integration, or backend behavior. No unused-code/dependency deletion
is proposed by this focused audit.

The emoji follow-up also restores its short scale/fade opening and closing
transitions. `verify-emoji-motion.mjs` samples intermediate frames in both columns
and verifies that the device's reduced-motion preference suppresses that motion.
Calendar creation, dragging, resizing, time labels and the current-time indicator
now use the responsive hour scale, with a 58px time-label gutter. Rendered event
intervals include their end time; resize indicators appear only at their edge.

The final open-state pass found an additional composition error shared by both
emoji examples: the search input kept its intrinsic minimum width and pushed the
skin-tone action past the group's clipped edge. Both caller compositions now use
`min-w-0` on that input and reserve space for the trailing action. The regression
check verifies both axes and that the action remains inside the visible group.

At the narrow gallery width, the reference's weekday/date pairs also overlapped.
The reference now composes its public `Agenda.DayHeader` slots inside WeekHeader
with a stacked small-screen layout. The independent example uses the same layout;
no vendor stylesheet is edited. Each heading's children are checked against their
column bounds. Larger milestone markers now match both border weight and their
semantic border color.

Latest follow-up evidence: paired behavior/style checks pass at 390px and 1024px,
including responsive hour scales, forward/reverse drag intervals, single-click
creation, Escape cancellation, visible inline tone controls, joined Unicode
sequences, and actual resize keyboard behavior. Original approved-preset
regressions, catalog interactions, content safety, typechecking, lint and
formatting were also run. The full 52-entry render sweep passed in both columns;
it remains a render check, not a replacement for those state-specific assertions.

The thumbnail screenshot pass also exposed arrows positioned against the full
carousel height. The image now owns the arrow-positioning container, so adding
thumbnails cannot shift its navigation. Thumbnail spacing, inactive opacity and
selection rings were corrected alongside the square geometry. The paired check
asserts arrow centering against the actual viewport; existing carousel selection,
keyboard and RTL interaction checks also passed after that change.

## Final visual-review corrections

The remaining mismatches came from incomplete assertions, not missing access to
the reference. Timeline checks covered marker borders and renderability, but not
row heights, connector continuity or both content columns. A minimum-height flex
connector forced compact rows taller; fixing all content to grid row one also
collapsed the reference's staggered split layout. The connector is now a 2px rail
that spans the row gap, and compact sizing and split placement match the paired
reference geometry.

The skin-tone control used a public ToggleButton's default variant. Correct radio
semantics and working selection did not prove that its unhovered appearance was
correct: default button surfaces remained around every tone. It now uses the
public ghost variant, retaining selected/hover/focus affordances. The navbar used
the surrounding surface token instead of the reference's background token, so
its background blended into the gallery card.

Agenda exposed change and press callbacks, but the local demo connected only
creation and change. Event presses now open its controlled edit dialog in both
columns; saving updates the named event. The component continues to expose date,
view, create, event-press and event-change callbacks for application integration.

`verify-final-review.mjs` checks every displayed timeline variant's row geometry
at mobile and desktop widths, line width/continuity, unselected tone backgrounds,
navbar background and the full event-click/edit/save flow. Earlier tests remain
necessary for dragging, resizing, keyboard edits and motion. These checks do not
establish every possible application composition or physical-device rendering.

The edit-flow regression additionally caught a desktop week-view defect hidden by
callback-only checks: a wrapping time label consumed a short, narrow event's
flex height and shrank its title to zero. Event titles now retain their line
height and time ranges truncate within the available width. The edit test clicks
the rendered title, so a zero-height title cannot pass as a working callback.

### Event-handler correction before integration

The maintainer clarified that event handling means an externally owned callback
contract, not a title-editing interaction. The previous follow-up mistook a
visible demo effect for the required API and combined move/resize into one change
callback. Agenda now exposes separate create, move, resize, select and delete
handlers and caller-controlled selection. No editor opens from event selection;
the explicit Add event example remains caller-owned. The dedicated callback
fixture verifies zoned payloads, selection, independent resize and delete
requests. Current time also has a thin cross-calendar rule and a leading marker
on today's thicker segment.
