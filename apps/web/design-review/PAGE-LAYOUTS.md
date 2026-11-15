# Subpage layout comparison

The default `/page-layouts.html` now compares three source-based dashboard
subpage fixtures: Organization security, Account settings and Request protection.
Choose side-by-side, current only or proposed only; open either at full width.
Desktop frames render at 1100px and scale to fit the review columns; mobile
frames render at 390px. At narrow review widths columns stack.

Gray dotted outlines mark the existing shared top bar, desktop sidebar and
breadcrumbs. Blue dashed outlines mark proposed page and AppSection headings.
Turning boundaries off removes annotations without changing geometry.
Both versions retain their controls. Proposed cards use the production
`AppSection` component owning Card, Header, Content and optional Footer. Its
`icon`, `title`, `description` and `children` props are required; `actions` and
`footer` are optional. Every proposed settings card displays the same 20px icon,
title, aligned description and spacing. Profile now has an icon and description,
as do Security and passkeys and each protection section. Card-specific controls
are passed as children. This is a React composition below the existing shell,
not a new Next.js route layout or a change to account/security behavior.

Fixtures copy the relevant current source compositions, with synthetic account
and empty protection data. They are not live production screenshots or a full
application shell integration. Non-layout actions are disabled; there are no
invented Save example workflows. Neither version saves data. Account, Organization security and Request protection now use the same AppSection.
The surrounding shell is unchanged; no nested-route migration is involved.

Run `bun apps/web/design-review/verify-subpage-comparison.mjs` for current/proposed
checks at 390px and 1100px, annotation and example selectors, overflow, and common
section structure. Screenshots go to `/tmp/payloadbay-subpages`. Physical-device
behavior is not certified by these browser checks.
