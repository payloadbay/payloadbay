# Payload Bay web application

Plain Next.js App Router/TypeScript app, Node production runtime and Bun workspace tooling. HeroUI Pro and its required base styles are installed; Pro Sheet is wired in the shell.

From repository root: `bun run web:dev`, `bun run web:typecheck`, `bun run web:lint`, `bun run web:build`. All aliases root at src/app: `@/components/example` resolves to src/app/components/example; `@types` resolves to src/app/types.ts. Additional application type modules use `@/types/...`; published DefinitelyTyped packages keep their normal names.

CSS order is Tailwind → HeroUI base → HeroUI Pro → exported custom theme. Saved theme exported into the canonical brand repository and copied to `src/app/styles/brand-theme.css`, with SHA-256/source metadata. Do not invent a replacement theme; canonical brand reference is https://github.com/payloadbay/brand/blob/master/DESIGN.md . Runtime activates the exported dark mode and bundles Inter locally.

This is a development shell, not an authenticated or deployed alpha. Full Docker/database/worker/executor setup belongs to the SpecKit plan. No remote fonts/CDN assets or licensed library source are vendored.

Scripts explicitly run the app on Node; Bun manages dependencies/workspace commands. Webpack is selected because Turbopack’s internal port-binding failed in this workspace. Build prepares static assets beside the standalone entrypoint; start runs that entrypoint. Set PORT/HOSTNAME for deployment.

Theme source: https://github.com/payloadbay/brand/blob/master/theme.css . The application snapshot is byte-identical; changes originate in brand, then refresh this snapshot/provenance. No sibling checkout or live HeroUI request is required to build the app.
