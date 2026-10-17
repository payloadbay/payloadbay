# CI-owned release migrations

Feature branches change `../src/schema.ts` and, when necessary, `../sql/runtime.sql`.
Use `bun run db:push` against a development database.

The master Generate Migrations workflow creates one SQL migration and its Drizzle
metadata after a merged source change, then commits them here. Agents do not run
release generation locally. Production applies these artifacts through
`bun run db:migrate` (inside the published migration image for operators).

No alpha release migration has been generated yet. An image without generated
release migrations must fail migration readiness; it must not bootstrap from
development source or the test-only history fixtures.
