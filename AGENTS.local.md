# Payload Bay Core repository guidance

The root `AGENTS.md` provides the organization baseline. This file adds only
Core product guidance.

## Current repository state

Payload Bay is in early implementation. The README describes intended product
capabilities and target repository boundaries; it does not prove that a feature,
directory, API, table, or command already exists.

Use the current code, the scoped GitHub issue when one exists, and relevant
repository documentation as the source of truth for the task at hand. Do not
create empty architecture scaffolding merely because a future path is listed in
the README.

## Architecture boundaries

The maintainer approved replacing the Supabase foundation on 2026-10-13.

- Next.js/React owns the integrated dashboard and HTTP API, running on Node.js.
- PostgreSQL owns domain data, append-only migrations and durable jobs.
- Graphile Worker processes trusted background jobs with retries and priorities.
- Better Auth owns authentication; application authorization owns domain access.
- Published Docker images are the supported operator deployment interface.
- Configured scripts use self-hosted workerd with an independently validated host sandbox (ordinary restricted Docker default, optional gVisor/runsc); never
  grant the Next.js application a Docker socket or treat node:vm as isolation.
- HeroUI, API-first Route Handlers, authenticated SSE and Zod/OpenAPI are selected.
- Instance access, workspace ownership and project-scoped roles are distinct.
  Ordinary admission is not global administration; granted roles inherit
  instance → workspace → project. Endpoints have separate ingress/processing scripts.

The request path runs bounded ingress code, commits event plus processing job
atomically, then acknowledges. Destination delivery happens asynchronously.
Do not add Supabase as a second supported backend or migrate experimental code
into production without the revised SpecKit plan and scoped implementation work.

Payload Bay promises at-least-once delivery. Do not imply exactly-once delivery
or make a receiver's deduplication responsibility disappear.

## Structure and ownership

The root package uses Bun workspaces. Use Bun for dependency and script work;
do not add npm, pnpm, or Yarn lockfiles.

These paths are created when their work begins:

- `apps/web/` for the integrated Next.js dashboard and API.
- `apps/worker/` for the trusted Graphile Worker entrypoint.
- `packages/` for product packages such as API contract, SDK, and
  integration packages.
- `deploy/` for self-hosting and deployment material.
- `scripts/` for product build and release tooling.

The Runner is a separate repository. Do not move Runner CLI or native-binary
work into this repository without an explicit decision.

## Implementation rules

- Keep authorization and business commands in shared server-only services,
  called by API routes and later MCP tools.
- Preserve incoming webhook bodies as bytes when verification, storage, or
  delivery semantics require the original request.
- Treat migrations as append-only history. Do not rewrite applied migrations or
  make destructive schema changes without an explicit migration and rollback
  plan.
- Keep public API contracts separate from internal table layout. Do not make
  internal tables an accidental public SDK contract.
- Inspect existing package scripts before proposing validation commands. Once
  product tooling exists, use the smallest relevant unit, migration,
  worker, and integration tests for the change.

## SpecKit development

Core is initialized with Python helpers, Codex skills and the centrally distributed
Payload Bay preset. Shared source is under `.github/speckit/`; read its setup guide
for initialization, dependency requirements, refresh and Claude switching.

The project constitution lives in `.specify/memory/constitution.md`. Feature specs,
plans, tasks, verified test commands and graph artifacts remain Core-owned. Use
an available Graphify graph for broad navigation and verify findings in source;
use `rg` for exact searches or missing/stale graph coverage.

The TDD extension has a verified root bootstrap runner/profile and alpha test list.
Bootstrap checks pass; domain/application suites remain unimplemented. Register
new test files and source-coverage ownership before meaningful Red cycles. Optional host
runsc execution is unavailable and clean licensed CI build is unverified; keep those limits
explicit. Do not count infrastructure smoke as passing product acceptance. SpecKit
initialization does not implement the planned ingress/delivery flow.

## Task-specific context

Read additional material only when the task requires it:

- For product behavior or public wording, use the README and the central Brand
  and Product references from the root baseline.
- For database, authorization, queue, or deployment work, inspect the
  relevant application, package, or `deploy/` files that exist.
- For a new subsystem, document the decision in the relevant issue or
  architecture documentation before spreading the assumption across packages.

## Dashboard source organization

Before implementing UI, inspect HeroUI's component catalog and the documentation
for the matching interaction. Prefer purpose-built controls (for example InputOTP
for sign-in codes), use secondary fields on surfaces, and verify the installed
package types as well as the docs. Check actual desktop/mobile behavior before
publishing; a successful HTTP response alone is not a functional UI check.

Page-specific presentation and state live directly in that route's `page.tsx`.
Use a client page when it owns browser interaction; do not extract a one-use
component merely to put `use client` on it. Reserve `components/` for reusable
UI such as the dashboard shell, auth flow, membership editor, Monaco editor,
secret binding controls and notification inbox. A real server/client split
requires a separate client boundary because the directive covers the module;
use that split only when the page actually needs server-only work.

## Database and formatting workflow

Drizzle schema source owns all tables, defaults, keys, indexes and checks. Use
`bun run db:push` for disposable development databases. Feature branches never
generate or commit ordinary release migration files; master CI creates one
migration after merge. Database behavior (roles, functions, immutable-history
triggers) lives in `packages/domain/sql/runtime.sql` and CI includes it in the
same generated migration. Applied release history stays immutable.
`tests/fixtures/schema-history/` contains explicit mechanism/upgrade fixtures,
not operator release migrations.

Import the centrally managed ESLint and Prettier presets from `.github/tooling/`.
They match Clipify's settings: tabs, JSX single quotes, printWidth 500.
Keep schema object declarations multiline for readability. Run `bun run lint`,
`bun run typecheck` and `bun run format:check`; do not disable rules to hide
findings. `bun run format` regenerates the SDK declaration snapshot afterward.

ESLint enforces a blank line after module directives and the import block,
between functions and logical hook/type sections, and before returns. Use one
declaration per statement, including a separate `const [value, setValue] =
useState(...)` for each hook. Expand objects with four or more properties.
Group related state declarations together; separate effects and handlers.

Use meaningful TypeScript entry-point aliases in the web app: `@api/*` for
shared server API helpers, `@lib/*` for utilities, `@components/*` for reusable
UI, `@styles/*` for styles, and `@types` for shared app types in
`src/app/types.ts`. Keep page-local types in their page. The web app uses
`@contracts/*`, `@domain/*`, and `@sdk/*` for shared package entry points.
Workers, executors and other Node tooling use the corresponding `@payloadbay/*`
workspace exports so production Node resolves them without an alias loader.
Do not traverse parent directories in web application imports.

Async action success/error feedback must use HeroUI toasts. Do not render inline
success/error boxes. Keep field validation and code diagnostics associated with
inputs; loading/empty/unavailable views and the durable notification inbox are
separate product states. Test-only SQL under tests/fixtures/schema-history is not
release migration history; CI owns packages/domain/drizzle artifacts.
