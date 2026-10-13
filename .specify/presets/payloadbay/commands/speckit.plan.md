# Payload Bay planning guidance

Explain component roles, data flow and material tradeoffs in plain language.
Inspect actual source and tests before choosing tools or commands. Use the resolved
plan template's inner-loop, affected-feedback and final-validation levels.
Map acceptance and material failure cases to executable evidence with one owning
execution route per test. Missing tooling or unverified commands are gaps to
resolve, never invented capabilities. Keep test commands and architecture local.
Do not install a second reporting or test framework simply to satisfy terminology.

For broad architecture and dependency discovery, query an existing Graphify graph
using the installed Graphify skill when available. Check freshness and verify
source locations against current files. Use `rg` for exact searches and as the
fallback for missing, stale or incomplete graph coverage. Do not require a full
graph build before planning a small change.

{CORE_TEMPLATE}
