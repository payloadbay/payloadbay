# Application UX audit — 2026-10-15

Reviewed: web routes and shared UI source, official HeroUI design/styling/composition
references, local desktop/mobile Chromium authentication checks, and real PR #13
email delivery through Mailpit and sign-in to the authenticated root dashboard.
This is a source audit plus scoped browser verification, not a claim that every
management operation has passed end-to-end browser acceptance.

## Changes from this review

- Root application instead of bootstrap landing page; no unshipped legacy route.
- Canonical logo, editable preview identity, secondary inputs on surfaces.
- Separate email and OTP stages; no success toast for advancing the form.
- HeroUI InputOTP with numeric input, paste, keyboard editing and incomplete-code guard.
- Bottom toasts with mobile safe-area spacing; errors preserve the current form stage.
- Compact brand/navigation header and avatar account menu instead of permanent email/logout controls; account settings edits the display name through the existing Better Auth endpoint.
- Scannable project table, with workspace detail collapsed into the project cell on mobile, and HeroUI Pro NativeSelect workspace filters.
- Project-local official HeroUI skill and web instructions; central library-neutral AGENTS baseline PR.

- Event and member initial-load failures now show unavailable/retry instead of false empty states.
- Notification inbox distinguishes initial loading, unavailable/retry, and a successful empty response.

- Mobile navigation now mounts HeroUI Sidebar.Mobile as well as the desktop sidebar; browser coverage opens, dismisses and navigates through the drawer.
- Dashboard scope/settings structure is drafted in [dashboard-navigation.md](dashboard-navigation.md), with existing coverage and missing pages distinguished.

## Remaining findings

| Priority | Source | Finding and recommended change |
| --- | --- | --- |
| Medium | Code/middleware, shared/secret bindings, notification rules and route test forms | Hand-styled native selects, number fields, checkbox and textareas bypass matching HeroUI controls. Review Select/NativeSelect, NumberField, Checkbox/Switch, TextArea and TextField per interaction. Native elements are not inherently inaccessible; preserve constraints and controlled behavior during replacement. |
| Medium | `apps/web/src/app/components/shared-bindings.tsx` and route/replay controls | Short internal IDs and implementation terms often carry primary context. Lead with resource names and plain-language outcomes, keeping IDs in secondary details. |
| Medium | `apps/web/src/app/components/secret-bindings.tsx` | Unsaved binding changes are announced only through an expiring toast. Show persistent unsaved/published state near editor actions. |
| Medium | `apps/web/src/app/(dashboard)/projects/[projectId]/events/page.tsx` | Five-column hand-styled event table depends on horizontal overflow at small widths. Review HeroUI Table/DataGrid and readable mobile status/inspect actions. |

These findings are follow-up implementation work under the existing alpha scope,
not already completed fixes. Verify error, empty, loading and populated states for
each affected route when addressing them.

## Guidance ownership

The official skill is vendored unchanged under `.agents/skills/heroui-react`,
with its Apache-2.0 license, from `heroui-inc/heroui` revision
`7a6cbbd6f6622f2562d26349f4728033b626706b`. `apps/web/AGENTS.md` links it
and requires catalog discovery, component docs, installed-type checks and actual
interaction testing. Use the unified Pro MCP for Pro-specific controls. Central
baseline PR https://github.com/payloadbay/.github/pull/28 stays library-neutral
and uses the existing AGENTS distribution path. It was merged as `ae400620`; distribution is owned by the baseline workflow.

References:

- https://heroui.com/en/docs/react/getting-started/design-principles
- https://heroui.com/en/docs/react/getting-started/styling
- https://heroui.com/en/docs/react/getting-started/composition
- https://heroui.com/en/docs/react/getting-started/agent-skills
