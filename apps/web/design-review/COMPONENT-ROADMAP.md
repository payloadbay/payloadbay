# Reusable components: review backlog

This is the maintainer's selected component set. The local implementations and
52 live comparison entries now exist; this document records scope and acceptance.
The maintainer approved the replacement presets. Production now uses the shared
components instead of Pro. Local shared implementations are now in `src/app/components/ui/`; the comparison
imports them directly. See the [component catalog](../src/app/components/ui/README.md)
for available components and contracts. The gallery remains available for future changes.
Kanban is excluded. Do not represent an advanced unsupported capability as
implemented merely because a component of the same name exists.

## Implementation order

1. Finish and approve current consumers: setup stepper, empty states, traffic/jobs
   charts, command search, persistent desktop sidebar and mobile navigation.
2. Integrate those consumers with their actual permissions, links, contextual
   menus, notifications and unsaved-change protection. Check mobile and desktop.
3. Add another component only with a concrete product screen and acceptance flow.
   First check the installed public HeroUI catalog, then existing dependencies.

## Candidates by family

| Family                | Requested candidates                                                                                                                                        | Starting point / decision still needed                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts                | Chart, Area chart, Bar chart, Composed chart, Line chart, Pie chart, Radar chart, Radial chart                                                              | Existing Recharts. Share metric definitions, accessible names, formatters, legend and tooltip composition; choose chart type for a real question.                |
| Data and summaries    | Data grid, List View, Item Card, Item Card Group, KPI, KPI Group, Timeline, Agenda                                                                          | Public HeroUI table/card/calendar primitives where applicable; keyboard and touch behavior must be specified before adding drag/drop or a grid.                  |
| Navigation and layout | App layout, Navbar, Sidebar, File tree, File TOC, Action bar, Segment, Resizable, Carousel                                                                  | Public controls and React Aria semantics; installed resizable-panels when required. Distinguish navigation from actions and selection.                           |
| Overlays              | Tooltip, Hover Card, Context menu, Sheet                                                                                                                    | Prefer public HeroUI's existing equivalents. Keep focus ownership, dismissal, portal layering and viewport bounds consistent.                                    |
| Inputs                | Cell color picker, Cell select, Cell slider, Cell switch, Checkbox button group, Drop zone, Inline select, Number stepper, Radio button group, Emoji picker | Compose public HeroUI controls; preserve validation, labels, selection and disabled/read-only behavior. Specialized wrappers require an actual table/editor use. |
| Content and feedback  | Code block, Text Shimmer, Emoji reaction button, Number value, Pressable feedback, Trend chip, Comment, Rich text editor                                    | Use existing editor/typography/chip/button primitives first. Rich text needs a separate sanitization and accessibility decision.                                 |
| Flow                  | Stepper                                                                                                                                                     | Current two-step setup fixture plus arbitrary step counts, progress, semantic colors and reduced-motion coverage.                                                |

## What “consistent with HeroUI” means

Use the public design system's spacing, typography, semantic color pairs and
surface variants. Match the interaction contract as carefully as the appearance:
focus, keyboard typing, disabled states, selection, scrolling, enter/exit motion,
responsive layout and accessible names. Animation checks must observe intermediate
frames and completed dismissal, with a reduced-motion alternative.

Inspect licensed components to characterize behavior, but do not copy or translate
Pro implementation/styles into redistributable code. Independent compositions use
public HeroUI, React Aria, Recharts and platform APIs. The standalone builder rejects
Pro imports in the replacement bundle. That dependency check is useful evidence,
not a legal certification.

Before extraction, record real call sites, supported props and theme tokens,
fixtures for each used state, interaction assertions, and desktop/mobile visual
review. Prefer shared data/metric contracts over demo-specific behavior. No new
public API is implied by a candidate name above.

## Current review implementation

All entries in the latest 52-component selection are represented in the catalog.
Markdown and Widget were added to the earlier selection; Kanban was removed. The
gallery maps “action chart” to Action Bar and “text trimmer” to Text Shimmer, using
the official catalog names. Chart tooltip and public Tooltip are separate entries.

Use **Component library · 52** and the component selector on port 4173. Desktop and
mobile viewport presets still apply to both columns. File watching rebuilds on
UI/gallery changes; a failed rebuild keeps the last working output. Frames refresh
after a successful rebuild. Product screens now use the independent library.

## Optional follow-up

The maintainer approved the emoji picker baseline and suggested category
navigation as a later convenience. It is not part of the Pro-removal acceptance.
