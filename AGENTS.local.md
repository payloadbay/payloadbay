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

Payload Bay uses Supabase as its backend foundation:

- PostgreSQL for domain data, migrations, RLS, database functions, and RPCs.
- Supabase Auth, Data API, Edge Functions, Queues (PGMQ), Cron, Realtime,
  Storage, Vault, and Gateway where the product needs them.
- Shared TypeScript modules for Payload Bay-specific logic.

Do not introduce an additional general backend server or substitute a separate
general-purpose infrastructure layer. In particular, do not add Hono, Express,
Drizzle, Better Auth, NATS JetStream, a transactional outbox, or required
Valkey as an alternative foundation.

The first delivery path must remain understandable as one product flow:

```text
Provider -> Ingress Edge Function -> ingest_event RPC -> PostgreSQL + PGMQ
-> worker wake-up -> Delivery Worker -> HTTP target -> attempt result
```

Payload Bay promises at-least-once delivery. Do not imply exactly-once delivery
or make a receiver's deduplication responsibility disappear.

## Structure and ownership

The root package uses Bun workspaces. Use Bun for dependency and script work;
do not add npm, pnpm, or Yarn lockfiles.

These paths are created when their work begins:

- `supabase/` for migrations, functions, shared backend modules, queue and
  cron configuration.
- `apps/dashboard/` for the dashboard.
- `packages/` for product packages such as API contract, SDK, and
  integration packages.
- `deploy/` for self-hosting and deployment material.
- `scripts/` for product build and release tooling.

The Runner is a separate repository. Do not move Runner CLI or native-binary
work into this repository without an explicit decision.

## Implementation rules

- Keep domain data, authorization, and business commands in the Supabase
  boundary. Do not bypass RLS or expose service-role credentials to the
  dashboard, SDK, or Runner.
- Preserve incoming webhook bodies as bytes when verification, storage, or
  delivery semantics require the original request.
- Treat migrations as append-only history. Do not rewrite applied migrations or
  make destructive schema changes without an explicit migration and rollback
  plan.
- Keep public API contracts separate from internal table layout. Do not make
  internal tables an accidental public SDK contract.
- Inspect existing package scripts before proposing validation commands. Once
  local Supabase tooling exists, use the smallest relevant Supabase, migration,
  function, and integration tests for the change.

## Task-specific context

Read additional material only when the task requires it:

- For product behavior or public wording, use the README and the central Brand
  and Product references from the root baseline.
- For database, RLS, Edge Function, queue, or deployment work, inspect the
  relevant `supabase/` or `deploy/` files that exist.
- For a new subsystem, document the decision in the relevant issue or
  architecture documentation before spreading the assumption across packages.
