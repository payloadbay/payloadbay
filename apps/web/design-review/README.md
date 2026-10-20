# HeroUI replacement review

A local, synthetic-data comparison. It does not change the product or remove Pro.

Run from the repository root: `bun apps/web/design-review/serve.mjs`
Open http://localhost:4173. Requires the existing installed dependencies (including
licensed Pro for the reference column). Built output stays in `/tmp`.

The reference imports the licensed package normally. The replacement uses public HeroUI and open-source engines listed below;
no Pro source or styles are copied. Separate
iframe documents and dependency builds prevent Pro CSS from influencing the
replacement. This is a visual/interaction prototype, not vendor legal approval.

Revision 4 includes comparison controls for motion, accent, navigation surface
and side. Use **Open full layout** in either column to compare navigation outside
the gallery iframe. The header burger is mobile-only; Mod+B controls desktop
collapse. Read `BEHAVIOR.md` for the source-study findings and remaining gaps.

With the server running, reproduce the interaction checks:
`bun apps/web/design-review/verify.mjs`.

Revision 5 adds real viewport presets (Fit, Desktop 1024×768, Mobile 390×844)
and a Components / Full navigation layout switch. Both columns receive the same
viewport. The preview scales that viewport to fit; it does not substitute desktop
CSS for mobile CSS.

`bun apps/web/design-review/verify-preview.mjs` checks viewport dimensions and
intermediate opening/closing motion. Mobile panel motion uses React Aria's
`onEnter`/`onExit` lifecycle promises so the panel stays mounted while closing.
The review waits for a settings popover to close before changing motion rules.

Revision 6 fixes the reported search, overlay, collapsed-rail, chart-contract,
semantic-color and option-transfer gaps, and consolidates the stylesheet.
`bun apps/web/design-review/verify-regressions.mjs` checks those contracts plus
retry/no-icon/dashed empty states and synthetic contextual/guarded navigation.
The full candidate component list and extraction rules are in
[COMPONENT-ROADMAP.md](./COMPONENT-ROADMAP.md). Nothing has been extracted into the
product yet; Pro remains installed and used by the app.

Validated on 2026-10-20: web TypeScript check; scoped ESLint and Prettier checks;
`verify.mjs`, `verify-preview.mjs`, and `verify-regressions.mjs` all passed in
Chromium. Intermediate drawer positions and search opacity were sampled; screenshots
of the mobile/full desktop layouts were inspected. Physical-device browser chrome,
Full production-shell integration remains outside this review.

Component-specific motion policy is recorded in [MOTION.md](./MOTION.md).
`bun apps/web/design-review/verify-motion.mjs` checks retained connector and public
popover effects as well as suppressed completion/sidebar movement, with both
explicit and device-driven reduced motion. The reference no longer has a blanket
animation/transition override.

The replacement now consumes shared components from `src/app/components/ui/`.
See [the catalog](../src/app/components/ui/README.md) before adding another UI
composition. The gallery retains synthetic data and application-boundary fixtures;
the shared components do not contain demo routes or sample project names.

## Full component library

The page opens with **all 52 components** in one continuous catalog. Scrolling
either column synchronizes the other by section and relative offset. The grouped
selector still opens one component for focused inspection; choose **All components**
to return. Both columns use the same selected entry and viewport.
The independent implementation is `catalog.html?component=…`, the licensed
reference is `catalog-pro.html?component=…`. Kanban is excluded.

The server now watches gallery and shared-component source, stages each successful
build before publishing it, and refreshes frames. Build errors preserve the last
working output. Build status is available at `__revision`. Do not run a second
server on the same port. `REVIEW_BUILD_ONLY=1 bun apps/web/design-review/serve.mjs`
validates the complete build without opening the listener.

`verify-catalog.mjs` covers all 52 entries in both columns at 390px and 1024px.
`verify-catalog-interactions.mjs` covers actual controls, sorting/selection, files,
editor operations, hover/context menus, gesture cancellation, calendar and emoji.
Reference-only extra peers are development dependencies; shared Markdown plugins are runtime dependencies. Independent components
use public HeroUI, React Aria, Recharts, Embla, Tiptap, React Markdown, Shiki,
NumberFlow and react-resizable-panels; the builder verifies that their
entry-point dependency graphs do not reach Pro.

Latest validation: all 52 entries rendered in both columns at mobile (390px)
and desktop (1024px) widths without runtime errors or page overflow. Control
interaction checks, the original regression/motion checks, content safety checks,
TypeScript and scoped ESLint passed. The watch/reload check also verified that a
failed build preserves the last working preview. Physical-device testing and
production integration remain pending.

## Source-level follow-up

Read [SOURCE-REVIEW.md](./SOURCE-REVIEW.md) for the actual installed-source findings,
corrected compositions and explicit feature/API differences. A render pass does
not approve interaction fidelity or every variant. The installed Pro baseline is
1.0.0-beta.10; this is separate from the CLI installer version.

`node apps/web/design-review/verify-source-contracts.mjs` exercises delayed hover,
pointer transit, keyboard dismissal, touch long press, TOC hover, intermediate
selection-indicator movement, reduced motion, full-width cells, actual KPI
sparklines, tree guides, clipboard completion animation, sustained ripple feedback,
sheet dragging and immediate bidirectional scrolling through the full catalog.

The catalog now has matching **Example** selectors in both columns. Choosing a
variant updates both sides. Timeline, agenda, resize handles, number formats,
editor commands, fields and other selected variants share fixture data. Additional
local API regression fixtures are kept outside the comparison at
`catalog.html?fixture=agenda` (substitute a fixture component name).
Run `node apps/web/design-review/verify-parity-gaps.mjs` for those behaviors.
Run `node apps/web/design-review/verify-reference-parity.mjs` for matched variants
and `node apps/web/design-review/verify-review-interactions.mjs` for paired hover,
TOC geometry, mobile menus, touch context actions and emoji selection.
See [the reference audit](./REFERENCE-AUDIT.md) for the latest review evidence.
Local descriptor APIs need not use Pro's compound slot spelling. Keep Pro in
production until the new components have been reviewed and approved.

`node apps/web/design-review/verify-review-feedback.mjs` records paired state
measurements for the maintainer's follow-up findings. It checks actual calendar
range creation and responsive time scaling, hover colors, resize geometry,
thumbnail proportions, field alignment, skin-tone selection and joined emoji.
The source-audit follow-up and remaining customization limitations are recorded
in [REFERENCE-AUDIT.md](./REFERENCE-AUDIT.md).

`node apps/web/design-review/verify-emoji-motion.mjs` samples actual opening
frames in both columns and checks their device-level reduced-motion behavior.
