# Approved backend decision — 2026-10-13

Maintainer accepted an integrated Next.js/Node.js application with PostgreSQL, Better Auth and Graphile Worker, Bun package manager, and prebuilt published Docker releases. Supabase is no longer the active foundation. The existing Supabase runtime probe is retained as historical evidence, not claimed impossible or erased.

The product owns dashboard/API, durable event semantics, programmable scripts, attempts/replay and administration. Established libraries provide identity and job execution. User-code isolation, fast hard-crash recovery and live transport require explicit verification. Current selection does not claim those tests have passed. No backend migration or implementation has run.
