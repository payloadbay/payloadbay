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

Discover suitable controls in the unified HeroUI Pro MCP catalog before coding;
use its component docs for both `@heroui/react` and `@heroui-pro/react`. The
vendored skill covers base HeroUI, so use Pro MCP for Pro-specific components.
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
