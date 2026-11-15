# Payload Bay web application

Integrated Next.js App Router/TypeScript dashboard and HTTP API, running on Node.js
with Bun workspace tooling. HeroUI Pro owns native controls, navigation overlays
and charts. The application is implemented; published operator release verification remains separate.

From the repository root, use `bun run web:dev`, `bun run web:typecheck`,
`bun run web:lint` and `bun run web:build`. Page-specific state lives in the route's
`page.tsx`; reusable controls live in `components/`. Entry-point aliases include
`@components`, `@api`, `@lib`, `@styles`, `@types`, `@contracts`, `@domain` and
`@sdk`; see `tsconfig.json` for their actual targets.

CSS order is Tailwind → HeroUI base → HeroUI Pro → exported custom theme. Saved theme exported into the canonical brand repository and copied to `src/app/styles/brand-theme.css`, with SHA-256/source metadata. Do not invent a replacement theme; canonical brand reference is https://github.com/payloadbay/brand/blob/master/DESIGN.md . Runtime activates the exported dark mode and bundles Inter locally.

Better Auth provides OTP/passkey sign-in; authenticated Route Handlers call shared
domain services. One SSE stream updates authorized dashboard views. The local
Scalar API console is at `/docs/api`. See root preflight and bootstrap docs for
current CI evidence and remaining published-release gates. Fonts and API console
assets are bundled locally; licensed library source is not vendored.

Scripts explicitly run the app on Node; Bun manages dependencies/workspace commands. Webpack is selected because Turbopack’s internal port-binding failed in this workspace. Build prepares static assets beside the standalone entrypoint; start runs that entrypoint. Set PORT/HOSTNAME for deployment.

Theme source: https://github.com/payloadbay/brand/blob/master/theme.css . The application snapshot is byte-identical; changes originate in brand, then refresh this snapshot/provenance. No sibling checkout or live HeroUI request is required to build the app.
