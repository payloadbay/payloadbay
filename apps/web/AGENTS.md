<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HeroUI workflow

Read [Payload Bay UI/UX rules](../../docs/ui-ux-rules.md) before UI work. They
contain the agreed reusable design principles. Feature requirements belong in
the relevant specification.

Use the project-scoped [official HeroUI React skill](../../.agents/skills/heroui-react/SKILL.md)
for web UI work. It is vendored unchanged with its Apache-2.0 license from
`heroui-inc/heroui`, revision `7a6cbbd6f6622f2562d26349f4728033b626706b`.
Review upstream changes before refreshing this copy. The skill is available to
Codex from `.agents/skills/`; Claude Code can read the same file via this link.

Read these guides before UI implementation or audit:

- [Design principles](https://heroui.com/en/docs/react/getting-started/design-principles)
- [Styling](https://heroui.com/en/docs/react/getting-started/styling)
- [Composition](https://heroui.com/en/docs/react/getting-started/composition)

Discover suitable public controls in the HeroUI MCP catalog before coding;
use its component docs for `@heroui/react`. The vendored skill covers public HeroUI. Reuse the project UI catalog for composed
patterns; do not reintroduce a commercial UI dependency for ordinary contributors.
Check installed TypeScript declarations when documentation differs. Prefer the
library's default composition and semantic variants over recreating its styles.
Use secondary inputs on cards/surfaces, InputOTP for verification codes, and
appropriate select/number/checkbox controls. Keep one clear primary action per
context and use project brand assets and theme tokens.

Model multi-step flows as distinct states: email entry advances to code entry,
with a destination reminder and change-email action. Do not leave irrelevant
fields on screen or toast a normal step transition. Actual action failures use
toasts; field validation stays associated with the control. Test real task flows,
keyboard/paste behavior, and desktop/mobile layout before calling a page ready.

## Shared UI catalog

Before designing UI or adding a composition, read the
[local component catalog](src/app/components/ui/README.md). Reuse an available
component or public HeroUI control. Consult its roadmap for planned patterns;
if a planned pattern is needed, implement it in the shared UI folder with review
fixtures instead of creating a competing page-local implementation. Distinguish
implemented components from proposals and retain the documented motion policy.

A component comparison needs a valid reference: inspect the official live demo,
installed composition, styles and interaction behavior before changing the local
implementation. Pair the same data, dimensions and selected variant in both
columns. Test the state that reveals the behavior (hover, keyboard, touch, open
menu, drag), not only the initial render. Check emitted DOM classes before writing
CSS selectors; a documented slot is not necessarily a public `data-slot` attribute.
Viewport width alone does not emulate touch-platform behavior.

Turn reference inspection into acceptance checks for the actual input gesture,
resulting state and computed layout. A callback firing is not proof that the
intended gesture works. Compare resolved theme tokens and responsive dimensions;
check minimum sizes and later overrides before adding another CSS correction.
Keep approved visual presets distinct from unverified component API coverage.

For dense and multi-column variants, compare row dimensions, spacing and content
placement as well as markers or borders. Semantic control choice does not imply
visual equivalence: inspect default, hover, selected and keyboard-focus surfaces.
A demo must exercise exposed callbacks through a visible result, including edit
and save flows; exported callback types alone are not integration evidence.

When replacing a layout, preserve its routing provider, document landmarks, scroll
ownership and navigation guards as well as its visible slots. Check controls at
viewport edges: a document-width check alone can pass when overflow clips them.
Scope action tests to the page or navigation landmark when both contain the same
link; do not rely on a vendor's private classes or collection roles.
