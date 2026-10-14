# Graph Report - payloadbay  (2026-10-13)

## Corpus Check
- Corpus is ~2,308 words - fits in a single context window. You may not need a graph.

## Summary
- 44 nodes · 44 edges · 9 communities (6 shown, 3 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Project Governance and Testing
- Product Package Configuration
- Ingress and Delivery Contract
- Product and Repository Boundaries
- Local Supabase Commands
- Database Security and Migrations
- Durable Queue and Wakeups
- Supabase Status Helper
- Atomic Durable Acceptance

## God Nodes (most connected - your core abstractions)
1. `Payload Bay — early development, intended event platform` - 6 edges
2. `Planned ingress Edge Function and delivery worker` - 6 edges
3. `scripts` - 5 edges
4. `PostgreSQL domain, migrations, RLS and atomic commands` - 4 edges
5. `Planned ingest_event RPC` - 4 edges
6. `Supabase backend foundation` - 3 edges
7. `Planned PGMQ durable delivery queue` - 3 edges
8. `Understandable small working flows` - 3 edges
9. `Issue → specification → plan → test-first tasks → CI` - 3 edges
10. `Self-hosted Community product` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Self-hosted Community product` --semantically_similar_to--> `Understandable small working flows`  [INFERRED] [semantically similar]
  README.md → .specify/memory/constitution.md
- `Preserve original request bytes` --rationale_for--> `Planned ingress Edge Function and delivery worker`  [EXTRACTED]
  .specify/memory/constitution.md → AGENTS.local.md
- `Planned stable webhook ingress` --conceptually_related_to--> `Planned ingress Edge Function and delivery worker`  [INFERRED]
  README.md → AGENTS.local.md
- `Append-only applied migration history` --rationale_for--> `PostgreSQL domain, migrations, RLS and atomic commands`  [EXTRACTED]
  .specify/memory/constitution.md → AGENTS.local.md
- `Backend-owned authorization and secret boundary` --rationale_for--> `PostgreSQL domain, migrations, RLS and atomic commands`  [EXTRACTED]
  .specify/memory/constitution.md → AGENTS.local.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Central policy with locally owned executable project workflow** — _specify_memory_constitution_shared_preset, _specify_memory_constitution_local_project_state, _specify_memory_constitution_python_speckit, _specify_memory_constitution_spec_workflow [EXTRACTED 1.00]
- **Intended delivery flow; not implemented by initialization** — agents_local_edge_functions, agents_local_ingest_event, agents_local_postgresql, agents_local_pgmq, agents_local_worker_wakeup, agents_local_http_target [EXTRACTED 1.00]

## Communities (9 total, 3 thin omitted)

### Community 0 - "Project Governance and Testing"
Cohesion: 0.20
Nodes (6): Source-verified Graphify navigation, Core-owned constitution, specs, plans, tests and graph state, Python SpecKit helpers, Codex and Claude switching, Central preset distributed through Repository Baseline, Product test runner and verified TDD profile not established, Self-hosted Community product

### Community 1 - "Product Package Configuration"
Cohesion: 0.25
Nodes (7): devDependencies, supabase, name, packageManager, private, workspaces, supabase

### Community 2 - "Ingress and Delivery Contract"
Cohesion: 0.40
Nodes (3): Planned ingress Edge Function and delivery worker, Planned HTTP target and attempt result, Planned stable webhook ingress

### Community 3 - "Product and Repository Boundaries"
Cohesion: 0.40
Nodes (5): Bun product workspaces, Planned event, delivery and incident inspection, Documented Supabase CLI and container development, Payload Bay — early development, intended event platform, Separately released private application Runner

### Community 4 - "Local Supabase Commands"
Cohesion: 0.40
Nodes (5): scripts, supabase:reset, supabase:start, supabase:status, supabase:stop

### Community 6 - "Durable Queue and Wakeups"
Cohesion: 0.67
Nodes (3): Planned PGMQ durable delivery queue, Supabase backend foundation, Planned worker wake-up

## Knowledge Gaps
- **7 isolated node(s):** `supabase`, `Planned event, delivery and incident inspection`, `Separately released private application Runner`, `Documented Supabase CLI and container development`, `Bun product workspaces` (+2 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 24 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Payload Bay — early development, intended event platform` connect `Product and Repository Boundaries` to `Project Governance and Testing`, `Ingress and Delivery Contract`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **What connects `supabase`, `Planned event, delivery and incident inspection`, `Separately released private application Runner` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Why does `Planned ingress Edge Function and delivery worker` connect `Ingress and Delivery Contract` to `Atomic Durable Acceptance`, `Durable Queue and Wakeups`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `Planned stable webhook ingress` connect `Ingress and Delivery Contract` to `Product and Repository Boundaries`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
## Index scope and accounting

This first index covers five existing Core source/document files at commit 6223754b529999e1f188f0e8d91f4974618484e0. README and architecture nodes describe intended behavior, not implemented runtime. New alpha planning documents were written after this snapshot and are not indexed yet. Generated agent/SpecKit copies, central baseline copies and local deployment data were excluded. The TOML runtime configuration is not supported by this extraction pass. Host-agent semantic extraction usage is not exposed by the collaboration tool: zero token fields are placeholders, not a zero-cost claim. Source references for semantic nodes are file-level rather than exact line locations.
