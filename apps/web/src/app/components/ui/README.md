# Payload Bay UI component catalog

Check this catalog **before designing a screen or writing a new UI composition**.
Reuse public HeroUI first, then these project components. If a matching component
is planned below, implement/extend it here and exercise it in the review gallery;
do not create a competing page-local version. Planned entries are not implemented
components. Do not import Pro implementations into this directory.

## Available local components

These are independent public-HeroUI/React-Aria/Recharts compositions. They are
used by the app for layout, navigation, search, setup, empty states and charts,
and by the review gallery for the remaining reusable patterns. This is not a claim
of complete upstream API equivalence.

| Component           | Import                                 | Contract                                                                                                                                          |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SetupSteps          | `@components/ui/setup-steps`           | Required labels and current step; size, motion preference and style hooks. Fractional connector progress supported.                               |
| ResourceEmptyState  | `@components/ui/resource-empty-state`  | Title, description, optional icon and action; use a caller-owned dashed container where appropriate.                                              |
| MetricLineChart     | `@components/ui/metric-line-chart`     | Hour-labelled numeric count points and explicit metric definitions. Integer/compact axes, matching tooltip rows, animation off.                   |
| CommandSearch       | `@components/ui/command-search`        | Controlled open state, actual items and selection callback; virtual-focus keyboard filtering and clear. One instance owns Mod+K.                  |
| DashboardLayout     | `@components/ui/dashboard-layout`      | Brand/page slots, navigation render function, controlled mobile open state, close lifecycle, side/width/surface/motion. Desktop rail via Mod+B.   |
| SidebarNavigation   | `@components/ui/sidebar-navigation`    | Groups, links/icons, current item, contextual back action; collapsed accessible links and tooltips. Caller owns authorization and routing guards. |
| useNavigationSearch | `@components/ui/use-navigation-search` | Coordinates layout and search. Search waits for navigation to finish closing; navigation shortcuts cannot replace an open search dialog.          |

`useTableReorder` (`@components/ui/use-table-reorder`) combines handle-only pointer
and touch sorting with React Aria keyboard drag/drop. The caller owns the ordered
items and persistence, supplies stable IDs and a unique table group, and attaches
the returned handle bindings plus row `data-reorder-id`/`data-reorder-group`.

Request-protection screens share `ConditionBuilder`
(`@components/request-condition-builder`): a controlled bounded AND/OR/NOT tree,
field-specific operators and a read-only expression preview. Persist and execute
the validated contract tree, never the preview text.

Each component imports its scoped stylesheet as needed. Classes use `pb-`, CSS
custom properties use `--pb-`; theme defaults come from public HeroUI tokens.
`SetupSteps` accepts paired `--pb-step-accent` and `--pb-step-foreground` values.
Never change only the background token when customizing the completed state.

Example composition (provide your resource data and routing handler):

```tsx
const overlays = useNavigationSearch();

<DashboardLayout
  brand={brand}
  navigationLabel='Project navigation'
  open={overlays.navigationOpen}
  onOpenChange={overlays.onNavigationOpenChange}
  onClosed={overlays.onNavigationClosed}
  navigation={(collapsed) => (
    <SidebarNavigation
      label='Project navigation'
      title={project.name}
      collapsed={collapsed}
      groups={groups}
      activeId={activeId}
      onNavigate={guardedNavigate}
    />
  )}
>
  {page}
</DashboardLayout>
<CommandSearch
  items={searchItems}
  open={overlays.searchOpen}
  onOpenChange={overlays.onSearchOpenChange}
  onAction={navigateFromSearch}
/>
```

Keep permission filtering, Next.js navigation, the existing cancelable navigation
event, and unsaved-change protection at the application boundary. The components
must not invent access rights or silently bypass those checks. `onAction` reports
an item id, not a trusted URL. Render only items the current user may access.

## Extended component library

The requested selection now has **52 review entries**, including existing shared
components and the public HeroUI Tooltip. Kanban is excluded. Each entry has a
licensed reference and an independent/public implementation in the live gallery.
These are functional local implementations for review; advanced Pro feature/API
parity and production adoption are separate acceptance steps.

| Module (`@components/ui/…`) | Exports                                                                                                                               | Implemented behavior                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charts`                    | Chart, AreaChart, BarChart, ComposedChart, LineChart, PieChart, RadarChart, RadialChart, ChartTooltip, ChartTooltipRow                | Responsive frames, public-theme axes, metric-independent tooltip formatting, Cartesian/polar series and Recharts configuration.                                                                                     |
| `tooltip`                   | Tooltip                                                                                                                               | Public HeroUI Tooltip, including its existing keyboard/pointer and motion behavior.                                                                                                                                 |
| `agenda`                    | Agenda                                                                                                                                | Day/week/month/list browsing, overlapping timed-event lanes, all-day events, selection/create callbacks, date navigation. Locale and timezone-aware Date instants; drag/resize, keyboard edits and spanning events. |
| `action-bar`                | ActionBar                                                                                                                             | Selection count, caller-provided actions, clear, animated floating toolbar.                                                                                                                                         |
| `carousel`                  | Carousel                                                                                                                              | Embla touch dragging, previous/next, indicators, loop configuration, inactive-slide focus protection and announcements.                                                                                             |
| `data-grid`                 | DataGrid                                                                                                                              | Public HeroUI table with search, numeric/text sorting, selection, column resizing, custom cell renderers and row-action callback.                                                                                   |
| `file-tree`                 | FileTree                                                                                                                              | React Aria hierarchy, selection and keyboard behavior; actual-height expansion/collapse and row opacity transitions; reduced-motion bypass, selection and reorder handles.                                          |
| `floating-toc`              | FloatingToc                                                                                                                           | Section links, intersection-based current location, popover navigation and reduced-motion-aware scrolling.                                                                                                          |
| `hover-card`                | HoverCard                                                                                                                             | Delayed pointer/focus disclosure, interactive content, close delay, keyboard/click access and public-popover dismissal.                                                                                             |
| `display`                   | ItemCard, ItemCardGroup, KPI, KPIGroup, ListView, Timeline, Widget                                                                    | Resource rows and actions; formatted values, gradient sparklines, trends/progress; selectable keyboard lists; timestamped timeline; public Card composition.                                                        |
| `content`                   | CodeBlock, Markdown                                                                                                                   | Escaped Shiki highlighting, copy feedback, optional line numbers; GFM Markdown with raw HTML disabled and safe default URL handling.                                                                                |
| `feedback`                  | TextShimmer, NumberValue, PressableFeedback, TrendChip                                                                                | Theme-aware shimmer, localized number formatting, press ripple and cancellable hold confirmation, semantic trend states.                                                                                            |
| `resizable`                 | Resizable                                                                                                                             | Installed react-resizable-panels engine, keyboard/touch/pointer handles and native panel sizing props.                                                                                                              |
| `cell-controls`             | CellColorPicker, CellSelect, CellSlider, CellSwitch, CheckboxButtonGroup, InlineSelect, NativeSelect, NumberStepper, RadioButtonGroup | Public HeroUI controls and compact compositions; labelled state, selection, bounds and disabled behavior. NativeSelect is the explicitly requested native browser control.                                          |
| `drop-zone`                 | DropZone                                                                                                                              | Keyboard file chooser, drag/drop, type/size/count checks, duplicate prevention, per-file removal and associated errors. File contents/upload permissions remain application responsibilities.                       |
| `rich-text-editor`          | RichTextEditor                                                                                                                        | Tiptap structured JSON, bold/italic/strike, headings, lists, code blocks, undo/redo, selection-aware toolbar and read-only mode.                                                                                    |
| `context-menu`              | ContextMenu                                                                                                                           | Pointer context action, touch long press with movement cancellation, Shift+F10, disabled/destructive actions and focus restoration.                                                                                 |
| `navbar`                    | Navbar                                                                                                                                | Brand, links/current page and action slots; mobile navigation sheet.                                                                                                                                                |
| `segment`                   | Segment                                                                                                                               | Public radio semantics and arrow-key selection with a shared moving indicator.                                                                                                                                      |
| `emoji-picker`              | EmojiPicker                                                                                                                           | Public React Aria search/grid, bundled emoji data or caller-provided items, skin tones and selection callback. No third-party picker UI or React adapter.                                                           |
| `sheet`                     | Sheet                                                                                                                                 | Public modal focus/dismissal, animated bottom panel, scrollable body/footer, drag-handle dismissal and cancelled-short-drag recovery.                                                                               |

Existing `DashboardLayout`, `SidebarNavigation`, `CommandSearch`, `SetupSteps`,
`ResourceEmptyState` and `MetricLineChart` remain in the initial table above.

Example chart composition:

```tsx
import { AreaChart } from "@components/ui/charts";

<AreaChart data={points} label='Accepted requests' height={240}>
	<AreaChart.Grid />
	<AreaChart.XAxis dataKey='hour' />
	<AreaChart.YAxis allowDecimals={false} />
	<AreaChart.Area dataKey='accepted' name='Accepted' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.12} isAnimationActive={false} />
	<AreaChart.Tooltip />
</AreaChart>;
```

Do not confuse a shared primitive with an application subsystem. The agenda does
not persist bookings, the rich editor does not send email, and the grid does not
fetch or authorize rows. Callers supply those behaviors. The grid supports measured pinned columns, tree rows, virtualization and reorder callbacks; callers persist the resulting changes. The agenda reports created, moved and resized instants through `onEventCreate`, `onEventMove` and `onEventResize`; callers own persistence.

## Evidence and motion

The comparison imports these exact components through `@components/ui/*`; there
is no second replacement implementation in the gallery. The standalone builder
rejects Pro code in their dependency graph. Browser checks cover mobile/desktop,
keyboard, overlays, guards, chart contracts, contrast and actual motion frames.
Run the existing regression/motion/preview scripts plus `verify-catalog.mjs` and
`verify-catalog-interactions.mjs` against the review server after
changing a contract. See [motion policy](../../../../design-review/MOTION.md): match
component-specific reduced motion; never blanket-disable every descendant.

Approved gallery presets are integrated where the product currently uses them.
Physical-device testing and advanced API acceptance remain separate checks.

The registered `tests/acceptance/ui-catalog.spec.ts` suite exercises public gallery
variants, selection, keyboard navigation, drag/resize callbacks and editor commands.
Its private source maps feed the same per-file coverage gate as application tests;
manual comparison checks complement that evidence.

## Source review and approval boundary

The [source review matrix](../../../../design-review/SOURCE-REVIEW.md) records
what the installed Pro components actually do and which features these local APIs
cover. Reuse must respect that boundary: the local descriptor APIs deliberately differ from Pro compound slot names.
Match state ownership, event handling, focus, layout and motion as well as the
visible preset. Exercise the interaction that owns the behavior, including hover,
held presses, keyboard navigation, resizing and touch, before marking it verified.

`KPI.Chart` supplies a themed gradient sparkline. `KPIGroup` accepts horizontal or
vertical orientation and an explicit `KPIGroup.Separator`. Generic `NumberValue`
is localized static text; the animated display belongs to `NumberStepper`.
Markdown fenced blocks use the shared highlighted/copyable `CodeBlock`.

## Optional behavior fixtures

Expand **Additional interaction cases** in the review catalog to exercise RTL
thumbnails, virtual collections, persisted panels, nested actions/sheets, contextual
sidebar pages, vertical steps, streaming Markdown and editor slash commands.
`verify-parity-gaps.mjs` checks these paths. Resizable numeric sizes mean percentages;
use explicit `px` strings for pixel sizes. `Agenda.timeZone` defaults to the browser
zone, and callbacks retain real instants. `RichTextEditor` accepts extensions,
placeholder/length options, suggestions and optional bubble/floating content.
`Markdown.streaming` uses Streamdown with raw HTML disabled. Emoji picker uses
React Aria with caller-provided items or the bundled public emoji dataset.

### Caller styling

Wrappers retain the className/style props their public types accept, including
React Aria state-based render props. Widget classes are appended on each slot.
ListView virtualization reserves height, overflow, display and padding; other
caller styles survive. NativeSelect fullWidth reserves width but retains other
select styles. Regression fixtures are separate from the visual comparisons.

### Agenda event ownership

Agenda renders caller-supplied events and emits `onEventCreate({start, end})`,
`onEventMove(id, start, end)`, `onEventResize(id, start, end)`,
`onEventDelete(id)` and `onEventSelect(id | null)`. Dates are absolute instants,
converted through the supplied timeZone for display. Selection supports controlled
selectedEventId or defaultSelectedEventId. The component does not save events or
open an editor; the caller chooses how to handle these actions. Move and resize
are independently enabled by their callbacks. Delete/Backspace requests deletion
of the selected event; Escape clears selection. The review fixture records callback
payloads and leaves persistence to its caller.

Emoji categories filter the grid using the bundled dataset. Search spans all
categories; All also keeps caller-provided items reachable. Skin tones apply to
both category browsing and search results.
