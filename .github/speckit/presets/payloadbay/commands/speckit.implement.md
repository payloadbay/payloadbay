# Payload Bay implementation guidance

The following requirements govern behavioral task execution wherever the core
workflow permits parallel or optional test tasks:

- Explain the next coherent change and its purpose before substantial edits.
- Use an available, current Graphify graph for broad impact/dependency discovery,
  following the installed skill. Verify findings in source; use `rg` for exact
  lookups or missing/stale coverage. Do not rebuild a graph for each edit.
- Observe a failing behavior test before production changes. Missing dependencies,
  broken setup or zero selected tests do not establish a meaningful Red.
- Make the smallest passing change, rerun the evidence and refactor while green.
  Finish this cycle before starting another behavior. Independent work may run
  concurrently only when each behavior retains its own Red/Green evidence.
- Use verified scoped commands for feedback; broaden uncertain selection.
- Run every applicable final gate from the plan before declaring completion.
  Preserve thresholds and scenario inventory. Report blocked/unexecuted gates.
- Use the TDD extension's loop when installed, and reuse its evidence artifacts.
  Do not treat an installed extension or disabled hook as proof the loop ran.
- Do not weaken, skip or delete tests to achieve a pass. Track unexpected failures
  and fix them within scope or explain the unresolved blocker.
- State what changed, why, what was verified and what remains uncertain. Check
  tasks only after their required work and evidence are complete.

{CORE_TEMPLATE}
