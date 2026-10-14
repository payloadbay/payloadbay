# Cycle Log: First Releasable Payload Bay Alpha

Append only. No alpha implementation cycles have started.

## Baseline

- suite: `bun run test` →13 passed,0 failed across5 bootstrap files
- wall time: 20.94 seconds
- commit: `6223754` plus uncommitted tooling bootstrap
- scope: tooling inventory/coverage, disposable PG/Graphile/SMTP/HTTP, local workerd feasibility, Pro shell browser, non-root image smoke
- product acceptance: all18 scenarios pending; gVisor isolation unverified
- recorded: cycle0 before alpha domain behavior work

## Notes and deviations

Bootstrap runner checks are infrastructure evidence, not credited alpha Red/Green cycles. Initial missing-module and fixture/library failures were setup errors. Policy assertions were observed failing against a loadable stub before its implementation; several infrastructure cases were exercised together, so this does not claim one-behavior-at-a-time alpha TDD compliance. Future cycles follow the mandatory loop and append actual single-behavior Red output.

## Implementation session baseline — 2026-10-14

- Mandatory `speckit.tdd.run` hook invoked using its installed skill, default all, uncommitted mode to preserve the known planning/bootstrap worktree. No shared branch commit/push.
- Suite `bun run test`: 18 passed, 0 failed.
- Requirements checklist: 10 checked, 3 verification items open. Maintainer explicitly authorized autonomous implementation; markers left unchanged.
- Foundation prerequisite cycles run inside-out before installation acceptance; complete installation has no implementation seam yet. This ordering deviation is explicit, not a claim of outside-in acceptance evidence.

## Cycle 1: U1 complete SMTP configuration

- test: `tests/unit/contracts.test.ts::U1 complete SMTP configuration is accepted`
- red: `bun run test:file tests/unit/contracts.test.ts --name "U1 complete SMTP configuration is accepted"` -> `error: not implemented` (1 failed). Minimal loadable declaration preceded this test, no SMTP behavior.
- green: configuration maps the complete SMTP fields. `bun run test`: 19 passed, 0 failed.
- refactor: none needed; next boundary will drive validation.
- commit: uncommitted, preserving pre-existing worktree.

## Cycle 2: U2 partial SMTP configuration

- test: `tests/unit/contracts.test.ts::U2 partial SMTP configuration reports a configuration error`
- red: `bun run test:file tests/unit/contracts.test.ts --name "U2 partial SMTP configuration reports a configuration error"` -> `Received function did not throw` (1 failed).
- green: Zod validates required SMTP fields and paired credentials; generic configuration failure excludes values. `bun run test`: 20 passed, 0 failed.
- refactor: none needed.
- commit: uncommitted.

## Cycle U3: U3 partial OAuth configuration reports a configuration error

- test: `tests/unit/contracts.test.ts::U3 partial OAuth configuration reports a configuration error`
- red: `bun run test:file tests/unit/contracts.test.ts --name U3 partial OAuth configuration reports a configuration error` -> `Received function did not throw`; actual exit 1.
- green: smallest production change in `packages/domain/src/config.ts`; `bun run test` -> 21 passed, 0 failed (20.90s); artifact `test-results/cycle-U3.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U4: U4 public errors omit secrets and SQL internals

- test: `tests/unit/contracts.test.ts::U4 public errors omit secrets and SQL internals`
- red: `bun run test:file tests/unit/contracts.test.ts --name U4 public errors omit secrets and SQL internals` -> `error: not implemented`; actual exit 1.
- green: smallest production change in `packages/contracts/src/errors.ts`; `bun run test` -> 22 passed, 0 failed (20.80s); artifact `test-results/cycle-U4.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U5: U5 valid public Zod values retain documented shapes

- test: `tests/unit/contracts.test.ts::U5 valid public Zod values retain documented shapes`
- red: `bun run test:file tests/unit/contracts.test.ts --name U5 valid public Zod values retain documented shapes` -> `error: not implemented`; actual exit 1.
- green: smallest production change in `packages/contracts/src/api.ts`; `bun run test` -> 23 passed, 0 failed (20.84s); artifact `test-results/cycle-U5.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U6: U6 empty installation creates complete domain schema

- test: `tests/integration/database.test.ts::U6 empty installation creates complete domain schema`
- red: `bun run test:file tests/integration/database.test.ts --name U6 empty installation creates complete domain schema` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/db.ts`, `packages/domain/migrations/0001_foundation.sql`; `bun run test` -> 24 passed, 0 failed (22.30s); artifact `test-results/cycle-U6.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U7: U7 acceptance rollback leaves no event or dispatch

- test: `tests/integration/database.test.ts::U7 acceptance rollback leaves no event or dispatch`
- red: `bun run test:file tests/integration/database.test.ts --name U7 acceptance rollback leaves no event or dispatch` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/db.ts`; `bun run test` -> 25 passed, 0 failed (31.13s); artifact `test-results/cycle-U7.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U8: U8 concurrent migrations serialize under migration lock

- test: `tests/integration/database.test.ts::U8 concurrent migrations serialize under migration lock`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/db.ts` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U8 concurrent migrations serialize under migration lock` -> `second migration must wait for advisory lock` (exit 1); original restored exactly.
- restored green: `bun run test` -> 26 passed, 0 failed; artifact `test-results/cycle-U8.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U9: U9 forward migration preserves existing records

- test: `tests/integration/database.test.ts::U9 forward migration preserves existing records`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/db.ts` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U9 forward migration preserves existing records` -> `Expected values to be strictly deep-equal` (exit 1); original restored exactly.
- restored green: `bun run test` -> 27 passed, 0 failed; artifact `test-results/cycle-U9.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U10: U10 wrong-scope dispatch is rejected

- test: `tests/integration/database.test.ts::U10 wrong-scope dispatch is rejected`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/migrations/0001_foundation.sql` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U10 wrong-scope dispatch is rejected` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test` -> 28 passed, 0 failed; artifact `test-results/cycle-U10.txt`.
- refactor: none needed.
- commit: uncommitted.

## Inner-loop execution clarification

The full subsystem baseline is 28 passed / 0 failed. Subsequent cycles use the owning whole-file command without coverage, per Constitution V and the maintainer's confirmed scoped-local-testing requirement; full/affected subsystem and release gates follow milestones. This differs from the upstream extension's literal full-suite-per-cycle wording and is recorded explicitly. No failing test is excluded from its owning file; all tests remain in final inventory. U9 currently proves idempotent migration preservation; a real prior-version-to-new-version upgrade remains an installation release gate, not evidence supplied by that test.

## Cycle U11: U11 body invokes fixed default lifecycle entrypoint

- test: `tests/unit/contracts.test.ts::U11 body invokes fixed default lifecycle entrypoint`
- red: `bun run test:file tests/unit/contracts.test.ts --name U11 body invokes fixed default lifecycle entrypoint` -> `error: not implemented`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`, `packages/script-sdk/src/lifecycle.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 6 passed, 0 failed (0.11s); artifact `test-results/cycle-U11.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U12: raw wrapper replacement is rejected

- test: `tests/unit/contracts.test.ts::U12 raw wrapper replacement is rejected`
- red: `bun run test:file tests/unit/contracts.test.ts --name "U12 raw wrapper replacement is rejected"` -> `Received promise that resolved: Promise { <resolved> }` (1 failed). Temporary evidence helper expected different Bun wording; test failure was valid and preserved.
- green: strict Zod publication input rejects wrapper fields; `bun run test:file tests/unit/contracts.test.ts` -> 7 passed, 0 failed. An initial sandbox-restricted esbuild child timed out; rerun with required workspace execution permission passed.
- refactor: none needed.
- commit: uncommitted.

## Cycle U13: U13 unregistered imports are rejected at publication

- test: `tests/unit/contracts.test.ts::U13 unregistered imports are rejected at publication`
- red: `bun run test:file tests/unit/contracts.test.ts --name U13 unregistered imports are rejected at publication` -> `Expected: "unregistered_import"`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 8 passed, 0 failed (0.66s); artifact `test-results/cycle-U13.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U14: U14 pinned helper binding resolves above wrapper

- test: `tests/unit/contracts.test.ts::U14 pinned helper binding resolves above wrapper`
- red: `bun run test:file tests/unit/contracts.test.ts --name U14 pinned helper binding resolves above wrapper` -> `ReferenceError: helper is not defined`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 9 passed, 0 failed (0.48s); artifact `test-results/cycle-U14.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U15: U15 syntax errors point to editable source line

- test: `tests/unit/contracts.test.ts::U15 syntax errors point to editable source line`
- red: `bun run test:file tests/unit/contracts.test.ts --name U15 syntax errors point to editable source line` -> `error: expect(received).toMatchObject(expected)`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 10 passed, 0 failed (0.39s); artifact `test-results/cycle-U15.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U16: U16 invalid stage outcomes fail typed and runtime validation

- test: `tests/unit/contracts.test.ts::U16 invalid stage outcomes fail typed and runtime validation`
- red: `bun run test:file tests/unit/contracts.test.ts --name U16 invalid stage outcomes fail typed and runtime validation` -> `Received promise that resolved`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`, `packages/contracts/src/lifecycle.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 11 passed, 0 failed (2.34s); artifact `test-results/cycle-U16.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered U182: safe typed application errors

- Existing implementation passed its new test. Deliberately replacing the safe error-code branch with `false` produced `+     "code": "internal_error",` instead of `not_found`; the mutant was caught and the original restored.
- Command: `bun run test:file tests/unit/contracts.test.ts --name "U182 typed application error preserves safe public code"`. Evidence helper expected a different diff heading; no test changed.

## Covered behavior U183: U183 valid binary protocol outcome remains valid

- test: `tests/unit/contracts.test.ts::U183 valid binary protocol outcome remains valid`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/contracts/src/lifecycle.ts` temporarily violated this invariant; `bun run test:file tests/unit/contracts.test.ts --name U183 valid binary protocol outcome remains valid` -> `Invalid stage outcome` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/contracts.test.ts` -> 13 passed, 0 failed; artifact `test-results/cycle-U183.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U17: U17 configured code cannot write host SSH key

- test: `tests/executor/isolation.test.ts::U17 configured code cannot write host SSH key`
- red: `bun run test:file tests/executor/isolation.test.ts --name U17 configured code cannot write host SSH key` -> `not implemented`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 1 passed, 0 failed (2.25s); artifact `test-results/cycle-U17.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U18: U18 configured code cannot spawn native subprocess

- test: `tests/executor/isolation.test.ts::U18 configured code cannot spawn native subprocess`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/executor/src/supervisor.ts` temporarily violated this invariant; `bun run test:file tests/executor/isolation.test.ts --name U18 configured code cannot spawn native subprocess` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/executor/isolation.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U18.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U19: U19 configured code cannot import native addon

- test: `tests/executor/isolation.test.ts::U19 configured code cannot import native addon`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/executor/src/supervisor.ts` temporarily violated this invariant; `bun run test:file tests/executor/isolation.test.ts --name U19 configured code cannot import native addon` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/executor/isolation.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U19.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U20: U20 configured code cannot read unrelated platform credentials

- test: `tests/executor/isolation.test.ts::U20 configured code cannot read unrelated platform credentials`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/executor/src/supervisor.ts` temporarily violated this invariant; `bun run test:file tests/executor/isolation.test.ts --name U20 configured code cannot read unrelated platform credentials` -> `execution_error` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/executor/isolation.test.ts` -> 4 passed, 0 failed; artifact `test-results/cycle-U20.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U21: U21 bounded direct fetch is available to scripts

- test: `tests/executor/isolation.test.ts::U21 bounded direct fetch is available to scripts`
- red: `bun run test:file tests/executor/isolation.test.ts --name U21 bounded direct fetch is available to scripts` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 5 passed, 0 failed (12.00s); artifact `test-results/cycle-U21.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U22: U22 nonyielding script terminates at configured deadline

- test: `tests/executor/isolation.test.ts::U22 nonyielding script terminates at configured deadline`
- red: `bun run test:file tests/executor/isolation.test.ts --name U22 nonyielding script terminates at configured deadline` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 6 passed, 0 failed (13.50s); artifact `test-results/cycle-U22.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U23: U23 RSS quota terminates allocating script

- test: `tests/executor/isolation.test.ts::U23 RSS quota terminates allocating script`
- red: `bun run test:file tests/executor/isolation.test.ts --name U23 RSS quota terminates allocating script` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 7 passed, 0 failed (13.84s); artifact `test-results/cycle-U23.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U24: U24 log burst cannot exceed configured quota

- test: `tests/executor/isolation.test.ts::U24 log burst cannot exceed configured quota`
- red: `bun run test:file tests/executor/isolation.test.ts --name U24 log burst cannot exceed configured quota` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 8 passed, 0 failed (14.09s); artifact `test-results/cycle-U24.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U25: U25 processing failure leaves reserved ingress capacity

- test: `tests/executor/isolation.test.ts::U25 processing failure leaves reserved ingress capacity`
- red: `bun run test:file tests/executor/isolation.test.ts --name U25 processing failure leaves reserved ingress capacity` -> `not implemented`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 9 passed, 0 failed (15.16s); artifact `test-results/cycle-U25.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Contract/compiler subsystem gate

- U182 restored whole-file green: 13 passed, 0 failed after U183; no refactor needed.
- `bun run test:coverage`: 27 unit tests passed; required registered source coverage 100% lines/functions. No threshold lowered. Node integration coverage is not claimed by Bun.
- `bun run tooling:typecheck`: fixture discriminant narrowed with `as const` (no assertion weakened), then passed.
- U11–U16 verified additionally on production Node through executor cases. Fixed wrapper, type/policy validation, pinned shared bindings and editable diagnostic positions implemented; no host/Deno APIs in public SDK.

## Cycle U184: U184 migration coordinates auth and queue schemas

- test: `tests/integration/database.test.ts::U184 migration coordinates auth and queue schemas`
- red: `bun run test:file tests/integration/database.test.ts --name U184 migration coordinates auth and queue schemas` -> `The expression evaluated to a falsy value`; actual exit 1.

## Type-check correction after executor networking

The earlier contract gate's TypeScript pass preceded fetch bridge work. The later executor check required DOM.Iterable/DOM.AsyncIterable library declarations for production Web API iterators. Added those type libraries without changing assertions; rerun passed.
- green: smallest production change in `packages/domain/src/db.ts`; `bun run test:file tests/integration/database.test.ts` -> 6 passed, 0 failed (59.86s); artifact `test-results/cycle-U184.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U185: U185 real forward upgrade preserves retained event bytes

- test: `tests/integration/database.test.ts::U185 real forward upgrade preserves retained event bytes`
- red: `bun run test:file tests/integration/database.test.ts --name U185 real forward upgrade preserves retained event bytes` -> `new migration must be applied`; actual exit 1.
- green: smallest production change in `packages/domain/migrations/0002_runtime_roles.sql`; `bun run test:file tests/integration/database.test.ts` -> 7 passed, 0 failed (67.97s); artifact `test-results/cycle-U185.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U187: U187 cancellation interrupts a nonyielding script

- test: `tests/executor/isolation.test.ts::U187 cancellation interrupts a nonyielding script`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/executor/src/supervisor.ts` temporarily violated this invariant; `bun run test:file tests/executor/isolation.test.ts --name U187 cancellation interrupts a nonyielding script` -> `deadline_exceeded` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/executor/isolation.test.ts` -> 10 passed, 0 failed; artifact `test-results/cycle-U187.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U188: U188 oversized script result is rejected

- test: `tests/executor/isolation.test.ts::U188 oversized script result is rejected`
- red: `bun run test:file tests/executor/isolation.test.ts --name U188 oversized script result is rejected` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 11 passed, 0 failed (16.30s); artifact `test-results/cycle-U188.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U186: U186 app role enqueues atomically without private queue reads

- test: `tests/integration/database.test.ts::U186 app role enqueues atomically without private queue reads`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/migrations/0002_runtime_roles.sql` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U186 app role enqueues atomically without private queue reads` -> `permission denied for schema graphile_worker` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/database.test.ts` -> 8 passed, 0 failed; artifact `test-results/cycle-U186.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U189: U189 standard Docker executor starts without host mounts

- test: `tests/executor/isolation.test.ts::U189 standard Docker executor starts without host mounts`
- red: `bun run test:file tests/executor/isolation.test.ts --name U189 standard Docker executor starts without host mounts` -> `executor readiness must prove real runtime startup`; actual exit 1.
- green: smallest production change in `apps/executor/src/server.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 12 passed, 0 failed (17.08s); artifact `test-results/cycle-U189.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U190: U190 Drizzle reads retained bytes through typed mappings

- test: `tests/integration/database.test.ts::U190 Drizzle reads retained bytes through typed mappings`
- red: `bun run test:file tests/integration/database.test.ts --name U190 Drizzle reads retained bytes through typed mappings` -> `not implemented`; actual exit 1.

## Covered behavior U26: U26 explicitly unavailable runsc fails at deployment

- test: `tests/executor/isolation.test.ts::U26 explicitly unavailable runsc fails at deployment`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `scripts/tests/runtime.ts` temporarily violated this invariant; `bun run test:file tests/executor/isolation.test.ts --name U26 explicitly unavailable runsc fails at deployment` -> `Missing expected exception` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/executor/isolation.test.ts` -> 13 passed, 0 failed; artifact `test-results/cycle-U26.txt`.
- refactor: none needed.
- commit: uncommitted.
- green: smallest production change in `packages/domain/src/db.ts`, `packages/domain/src/schema.ts`; `bun run test:file tests/integration/database.test.ts` -> 9 passed, 0 failed (88.85s); artifact `test-results/cycle-U190.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Executor configuration refactor and deployment gate

- Extracted platform-generated Cap'n Proto configuration to `apps/executor/src/workerd-config.ts`; no user-owned config or host mounts. Owning executor suite: 11 passed, 0 failed after extraction.
- U189 proves real standard Docker service readiness, authenticated execution, unauthorized request rejection and non-root/read-only/no-host-mount image settings. U26 verifies missing runsc fails at Docker creation on this host; no downgrade. A first intended mutant was unchanged due to a mismatched guard string, so it earned no evidence; corrected mutant caught by the same test and restored exactly.
- Current owning executor suite: 13 passed, 0 failed. Optional actual gVisor execution remains unavailable and unclaimed.
- U8/U9 ledger-count fixtures now derive expected migration count from committed SQL inventory, before adding 0002. This supports the real forward migration without weakening serialization or byte preservation.

## Migration entrypoint setup correction

U191 first execution exposed a tooling setup error: `Top-level await is currently not supported with the "cjs" output format`. This was not meaningful Red. The root package now declares ESM, matching its TypeScript imports and Node migration entrypoint; no assertion was weakened. Retry existing behavior and deliberate mutant before completion.

## Covered behavior U191: U191 Node migration entrypoint applies committed schema

- test: `tests/integration/database.test.ts::U191 Node migration entrypoint applies committed schema`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `scripts/migrate.ts` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U191 Node migration entrypoint applies committed schema` -> `migration entrypoint must create storage` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/database.test.ts` -> 10 passed, 0 failed; artifact `test-results/cycle-U191.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U192: U192 fixture infrastructure reuse preserves database isolation

- test: `tests/integration/database.test.ts::U192 fixture infrastructure reuse preserves database isolation`
- red: `bun run test:file tests/integration/database.test.ts --name U192 fixture infrastructure reuse preserves database isolation` -> `fixture infrastructure should be reused`; actual exit 1.
- green: smallest production change in `scripts/tests/fixtures.ts`; `bun run test:file tests/integration/database.test.ts` -> 11 passed, 0 failed (13.80s); artifact `test-results/cycle-U192.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U193: U193 reused HTTP fixtures expose no earlier receipts

- test: `tests/integration/database.test.ts::U193 reused HTTP fixtures expose no earlier receipts`
- red: `bun run test:file tests/integration/database.test.ts --name U193 reused HTTP fixtures expose no earlier receipts` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `deploy/fixtures/http.mjs`, `scripts/tests/fixtures.ts`; `bun run test:file tests/integration/database.test.ts` -> 12 passed, 0 failed (14.70s); artifact `test-results/cycle-U193.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Database foundation gate

- Owning database file: 12 passed / 0 failed after verified infrastructure reuse and HTTP reset isolation; original U6–U10 plus auth/queue, real forward upgrade, restricted enqueue, typed-byte and CLI cases pass.
- Drizzle configuration targets review-only SQL drafts. Committed numbered SQL owns constraints/history and is applied through the locking/hash-verifying migrator; do not use Drizzle push. Typed column mappings cover implemented domain tables.
- T010–T012 complete; U185 supplies actual forward-upgrade evidence beyond U9's idempotent byte preservation. Runtime database-login credentials remain deployment configuration work.

## Complete foundation verification checkpoint

`bun run test`: 56 passed / 0 failed across all registered owners. `bun run tooling:typecheck` passed. Default Docker proven; optional gVisor execution unverified. No alpha outer acceptance closed. Proceeding to real-PostgreSQL lease/recovery behaviors after T012/T018.

## Cycle U27: U27 live unexpired lease cannot be reclaimed

- test: `tests/integration/recovery.test.ts::U27 live unexpired lease cannot be reclaimed`
- red: `bun run test:file tests/integration/recovery.test.ts --name U27 live unexpired lease cannot be reclaimed` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 1 passed, 0 failed (10.87s); artifact `test-results/cycle-U27.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U28: U28 expired lease becomes recoverable using database time

- test: `tests/integration/recovery.test.ts::U28 expired lease becomes recoverable using database time`
- red: `bun run test:file tests/integration/recovery.test.ts --name U28 expired lease becomes recoverable using database time` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 2 passed, 0 failed (11.06s); artifact `test-results/cycle-U28.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U29: U29 unclaimed offer before deadline is not recovered

- test: `tests/integration/recovery.test.ts::U29 unclaimed offer before deadline is not recovered`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/execution-lease.ts` temporarily violated this invariant; `bun run test:file tests/integration/recovery.test.ts --name U29 unclaimed offer before deadline is not recovered` -> `Expected values to be strictly deep-equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/recovery.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U29.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U30: U30 overdue unclaimed offer gets fresh generation

- test: `tests/integration/recovery.test.ts::U30 overdue unclaimed offer gets fresh generation`
- red: `bun run test:file tests/integration/recovery.test.ts --name U30 overdue unclaimed offer gets fresh generation` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 4 passed, 0 failed (11.30s); artifact `test-results/cycle-U30.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U31: U31 concurrent sweepers create one replacement generation

- test: `tests/integration/recovery.test.ts::U31 concurrent sweepers create one replacement generation`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/execution-lease.ts` temporarily violated this invariant; `bun run test:file tests/integration/recovery.test.ts --name U31 concurrent sweepers create one replacement generation` -> `Expected values to be strictly deep-equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/recovery.test.ts` -> 5 passed, 0 failed; artifact `test-results/cycle-U31.txt`.
- refactor: none needed.
- commit: uncommitted.

## U32 test setup correction

The first test file had a malformed inline JSON SQL literal (`Expected ")" but found "source"`), so that run is not Red evidence. Replaced fixture literal with a bound JSON parameter, preserving the assertion; production implementation remains the loadable not-implemented stub before the genuine Red run.

## Cycle U32: U32 stale generation cannot overwrite newer result

- test: `tests/integration/recovery.test.ts::U32 stale generation cannot overwrite newer result`
- red: `bun run test:file tests/integration/recovery.test.ts --name U32 stale generation cannot overwrite newer result` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 6 passed, 0 failed (12.48s); artifact `test-results/cycle-U32.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U194: U194 live current owner commits completion

- test: `tests/integration/recovery.test.ts::U194 live current owner commits completion`
- red: `bun run test:file tests/integration/recovery.test.ts --name U194 live current owner commits completion` -> `Execution authority expired or changed`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 7 passed, 0 failed (12.14s); artifact `test-results/cycle-U194.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U33: U33 forged broker capability cannot acquire authority

- test: `tests/integration/recovery.test.ts::U33 forged broker capability cannot acquire authority`
- red: `bun run test:file tests/integration/recovery.test.ts --name U33 forged broker capability cannot acquire authority` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/broker-auth.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 8 passed, 0 failed (12.70s); artifact `test-results/cycle-U33.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U195: U195 valid capability preserves pinned execution authority

- test: `tests/integration/recovery.test.ts::U195 valid capability preserves pinned execution authority`
- red: `bun run test:file tests/integration/recovery.test.ts --name U195 valid capability preserves pinned execution authority` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/broker-auth.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 9 passed, 0 failed (13.05s); artifact `test-results/cycle-U195.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U34: U34 cross-route broker authority is rejected

- test: `tests/integration/recovery.test.ts::U34 cross-route broker authority is rejected`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/execution-lease.ts` temporarily violated this invariant; `bun run test:file tests/integration/recovery.test.ts --name U34 cross-route broker authority is rejected` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/recovery.test.ts` -> 10 passed, 0 failed; artifact `test-results/cycle-U34.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U35: U35 suspected live Graphile worker is never unlocked

- test: `tests/integration/recovery.test.ts::U35 suspected live Graphile worker is never unlocked`
- red: `bun run test:file tests/integration/recovery.test.ts --name U35 suspected live Graphile worker is never unlocked` -> `not implemented`; actual exit 1.
- green: smallest production change in `apps/worker/src/recovery.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 11 passed, 0 failed (13.58s); artifact `test-results/cycle-U35.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U196: U196 observed dead child unlocks only exact worker IDs

- test: `tests/integration/recovery.test.ts::U196 observed dead child unlocks only exact worker IDs`
- red: `bun run test:file tests/integration/recovery.test.ts --name U196 observed dead child unlocks only exact worker IDs` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `apps/worker/src/recovery.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 12 passed, 0 failed (13.27s); artifact `test-results/cycle-U196.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U197: U197 queued generation is claimed once

- test: `tests/integration/recovery.test.ts::U197 queued generation is claimed once`
- red: `bun run test:file tests/integration/recovery.test.ts --name U197 queued generation is claimed once` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 13 passed, 0 failed (14.40s); artifact `test-results/cycle-U197.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U198: U198 only live current owner extends database lease

- test: `tests/integration/recovery.test.ts::U198 only live current owner extends database lease`
- red: `bun run test:file tests/integration/recovery.test.ts --name U198 only live current owner extends database lease` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 14 passed, 0 failed (13.50s); artifact `test-results/cycle-U198.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U199: U199 healthy supervisor sweeps expired work automatically

- test: `tests/integration/recovery.test.ts::U199 healthy supervisor sweeps expired work automatically`
- red: `bun run test:file tests/integration/recovery.test.ts --name U199 healthy supervisor sweeps expired work automatically` -> `automatic recovery must offer expired work`; actual exit 1.
- green: smallest production change in `apps/worker/src/recovery.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 15 passed, 0 failed (19.07s); artifact `test-results/cycle-U199.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U200: U200 result authority rechecks expiry after row lock

- test: `tests/integration/recovery.test.ts::U200 result authority rechecks expiry after row lock`
- red: `bun run test:file tests/integration/recovery.test.ts --name U200 result authority rechecks expiry after row lock` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 16 passed, 0 failed (18.90s); artifact `test-results/cycle-U200.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U201: U201 heartbeat cannot revive lease after blocked expiry

- test: `tests/integration/recovery.test.ts::U201 heartbeat cannot revive lease after blocked expiry`
- red: `bun run test:file tests/integration/recovery.test.ts --name U201 heartbeat cannot revive lease after blocked expiry` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 17 passed, 0 failed (19.91s); artifact `test-results/cycle-U201.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U202: U202 abandoned transaction releases locks within timeout

- test: `tests/integration/recovery.test.ts::U202 abandoned transaction releases locks within timeout`
- red: `bun run test:file tests/integration/recovery.test.ts --name U202 abandoned transaction releases locks within timeout` -> `idle transaction must be terminated by PostgreSQL`; actual exit 1.

## U202 fixture event-capture correction

The server-side timeout fired, but the fixture overwrote its first PostgreSQL error with a later transport error, losing the SQLSTATE. Preserve the first error event; the required exact `25P03` assertion and time bound remain unchanged. Production timeout settings are unchanged while rerunning this correction.

## Cycle U203: U203 active worker renews lease on five second cadence

- test: `tests/integration/recovery.test.ts::U203 active worker renews lease on five second cadence`
- red: `bun run test:file tests/integration/recovery.test.ts --name U203 active worker renews lease on five second cadence` -> `heartbeat must renew before lease expiry`; actual exit 1.

## Cycle U36: U36 invalid browser command origin is rejected

- test: `tests/integration/live-api.test.ts::U36 invalid browser command origin is rejected`
- red: `bun run test:file tests/integration/live-api.test.ts --name U36 invalid browser command origin is rejected` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/request-context.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 1 passed, 0 failed (0.33s); artifact `test-results/cycle-U36.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U37: U37 cookie command requires CSRF protection

- test: `tests/integration/live-api.test.ts::U37 cookie command requires CSRF protection`
- red: `bun run test:file tests/integration/live-api.test.ts --name U37 cookie command requires CSRF protection` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/request-context.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 2 passed, 0 failed (0.26s); artifact `test-results/cycle-U37.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U38: U38 unauthenticated command returns no private detail

- test: `tests/integration/live-api.test.ts::U38 unauthenticated command returns no private detail`
- red: `bun run test:file tests/integration/live-api.test.ts --name U38 unauthenticated command returns no private detail` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/request-context.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 3 passed, 0 failed (0.30s); artifact `test-results/cycle-U38.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U39: U39 optimistic conflict cannot silently overwrite

- test: `tests/integration/live-api.test.ts::U39 optimistic conflict cannot silently overwrite`
- red: `bun run test:file tests/integration/live-api.test.ts --name U39 optimistic conflict cannot silently overwrite` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/request-context.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 4 passed, 0 failed (0.25s); artifact `test-results/cycle-U39.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## U202 green and recovery subsystem checkpoint

- Exact timeout test rerun: 1 passed, 0 failed; PostgreSQL emits `25P03` within the original time bound.
- Full registered foundation/recovery inventory at invocation: `bun run test` -> 74 passed, 0 failed. This includes 18 owning recovery cases; newly prepared HTTP-boundary file was added after this invocation and is a separate next slice.
- Production DB connections bound lock waits, statement duration and abandoned transaction lifetime; result/heartbeat authority rechecks occur after row locking.
- Refactor: none needed for U202. Commit: uncommitted.
- green: smallest production change in `apps/worker/src/recovery.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 19 passed, 0 failed (36.45s); artifact `test-results/cycle-U203.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U204: U204 complete server configuration receives bounded defaults

- test: `tests/unit/contracts.test.ts::U204 complete server configuration receives bounded defaults`
- red: `bun run test:file tests/unit/contracts.test.ts --name U204 complete server configuration receives bounded defaults` -> `error: not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/config.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 14 passed, 0 failed (1.88s); artifact `test-results/cycle-U204.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U205: U205 invalid limits expose no configuration secrets

- test: `tests/unit/contracts.test.ts::U205 invalid limits expose no configuration secrets`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/config.ts` temporarily violated this invariant; `bun run test:file tests/unit/contracts.test.ts --name U205 invalid limits expose no configuration secrets` -> `error: expect(received).toEqual(expected)` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/contracts.test.ts` -> 15 passed, 0 failed; artifact `test-results/cycle-U205.txt`.
- refactor: none needed.
- commit: uncommitted.

## Recovery primitive completion

- Owning recovery file after actual five-second heartbeat test: 19 passed, 0 failed. Server time, 30-second lease, five-second heartbeat/sweep, fresh generation keys, stale/broker/scope fencing and observed-death unlock rules verified.
- T019–T021 complete for primitives; whole-container loss, partitions, managed-send recovery and user-story acceptance still require later real entrypoint gates. No instruction-pointer continuation or exactly-once promise.

## U206 module setup correction

The web workspace had no ESM declaration, so production Node could not import the loadable handler declaration by named export. Declared web ESM consistently with the other workspaces and corrected its repository-relative type import. This setup failure is not Red evidence; handler remains not implemented before the rerun.

## Cycle U206: U206 private HTTP command is unauthorized before invocation

- test: `tests/integration/live-api.test.ts::U206 private HTTP command is unauthorized before invocation`
- red: `bun run test:file tests/integration/live-api.test.ts --name U206 private HTTP command is unauthorized before invocation` -> `not implemented`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/_lib/handler.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 5 passed, 0 failed (0.35s); artifact `test-results/cycle-U206.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U207: U207 browser commands send protected same origin JSON

- test: `tests/integration/live-api.test.ts::U207 browser commands send protected same origin JSON`
- red: `bun run test:file tests/integration/live-api.test.ts --name U207 browser commands send protected same origin JSON` -> `not implemented`; actual exit 1.

## U207 green correction

- First Green attempt exposed an incorrect repository-relative contract import, not a failed behavior assertion. Corrected the import without changing the test.
- `bun run test:file tests/integration/live-api.test.ts`: 6 passed, 0 failed; simple typed browser command serializes JSON and supplies same-origin credentials/CSRF protection.
- Refactor: none needed. Commit: uncommitted.

## Cycle U208: U208 invalid SMTP TLS flag cannot silently downgrade

- test: `tests/unit/contracts.test.ts::U208 invalid SMTP TLS flag cannot silently downgrade`
- red: `bun run test:file tests/unit/contracts.test.ts --name U208 invalid SMTP TLS flag cannot silently downgrade` -> `Received function did not throw`; actual exit 1.
- green: smallest production change in `packages/domain/src/config.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 16 passed, 0 failed (1.77s); artifact `test-results/cycle-U208.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U209: U209 oversized JSON body is rejected before parsing

- test: `tests/integration/live-api.test.ts::U209 oversized JSON body is rejected before parsing`
- red: `bun run test:file tests/integration/live-api.test.ts --name U209 oversized JSON body is rejected before parsing` -> `not implemented`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/_lib/handler.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 7 passed, 0 failed (0.33s); artifact `test-results/cycle-U209.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U210: U210 JSON body at limit retains public value

- test: `tests/integration/live-api.test.ts::U210 JSON body at limit retains public value`
- red: `bun run test:file tests/integration/live-api.test.ts --name U210 JSON body at limit retains public value` -> `Request body is too large`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/_lib/handler.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 8 passed, 0 failed (0.37s); artifact `test-results/cycle-U210.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U211: U211 public configuration contains no server credentials

- test: `tests/integration/config.test.ts::U211 public configuration contains no server credentials`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/config.ts` temporarily violated this invariant; `bun run test:file tests/integration/config.test.ts --name U211 public configuration contains no server credentials` -> `Expected values to be strictly deep-equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/config.test.ts` -> 1 passed, 0 failed; artifact `test-results/cycle-U211.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U212: U212 browser bundle excludes private domain code

- test: `tests/integration/config.test.ts::U212 browser bundle excludes private domain code`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/web/src/app/lib/api-client.ts` temporarily violated this invariant; `bun run test:file tests/integration/config.test.ts --name U212 browser bundle excludes private domain code` -> `browser code must not bundle private domain modules` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/config.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U212.txt`.
- refactor: none needed.
- commit: uncommitted.

## HTTP parser type refactor

The broad TypeScript check exhausted its default heap while expanding a recursive `T extends ZodType` boundary. Replaced only its compile-time constraint with the minimal safeParse input/output interface; Zod still performs the identical runtime validation. `bun run tooling:typecheck` now passes without raising heap limits or weakening checks. Removed generated native crash dumps; these are ignored build artifacts. Rerun owning HTTP file and Next checks before task completion.

## Configuration and shared API boundary gate

- Configuration/public-contract owning unit file: 16 passed / 0 failed. Production Node configuration projection and actual browser-bundle domain-exclusion: 2 passed / 0 failed with caught deliberate mutants.
- Shared API/transport owning Node file: 8 passed / 0 failed; origin/CSRF/authentication/conflicts, canonical HTTP envelope, browser ergonomics and bounded JSON parsing implemented.
- Node tooling and Next.js type checks pass after a compile-time generic refactor; runtime assertions unchanged. Web lint passed. Local package exports replace fragile cross-workspace relative imports; app aliases remain @/*→src/app/* and @types→src/app/types.ts.
- T007–T009 and T022–T024 complete for these boundaries. Real authenticated resource routes, Scalar parity and full alpha acceptance remain subsequent tasks.

## Cycle U40: U40 concurrent setup creates exactly one owner

- test: `tests/integration/auth.test.ts::U40 concurrent setup creates exactly one owner`
- red: `bun run test:file tests/integration/auth.test.ts --name U40 concurrent setup creates exactly one owner` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/bootstrap.ts`; `bun run test:file tests/integration/auth.test.ts` -> 1 passed, 0 failed (11.25s); artifact `test-results/cycle-U40.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U41: U41 invalid setup secret cannot create owner

- test: `tests/integration/auth.test.ts::U41 invalid setup secret cannot create owner`
- red: `bun run test:file tests/integration/auth.test.ts --name U41 invalid setup secret cannot create owner` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/bootstrap.ts`; `bun run test:file tests/integration/auth.test.ts` -> 2 passed, 0 failed (11.11s); artifact `test-results/cycle-U41.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U42: U42 unverified email cannot become instance owner

- test: `tests/integration/auth.test.ts::U42 unverified email cannot become instance owner`
- red: `bun run test:file tests/integration/auth.test.ts --name U42 unverified email cannot become instance owner` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/bootstrap.ts`; `bun run test:file tests/integration/auth.test.ts` -> 3 passed, 0 failed (10.93s); artifact `test-results/cycle-U42.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U213: U213 auth migration supports provisioning and durable rate policy

- test: `tests/integration/auth.test.ts::U213 auth migration supports provisioning and durable rate policy`
- red: `bun run test:file tests/integration/auth.test.ts --name U213 auth migration supports provisioning and durable rate policy` -> `The expression evaluated to a falsy value`; actual exit 1.
- green: smallest production change in `packages/domain/src/db.ts`, `packages/domain/src/auth-schema.ts`, `packages/domain/migrations/0003_auth_request_policy.sql`; `bun run test:file tests/integration/auth.test.ts` -> 4 passed, 0 failed (11.90s); artifact `test-results/cycle-U213.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U43: U43 code request responses do not disclose membership

- test: `tests/integration/auth.test.ts::U43 code request responses do not disclose membership`
- red: `bun run test:file tests/integration/auth.test.ts --name U43 code request responses do not disclose membership` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth.ts`; `bun run test:file tests/integration/auth.test.ts` -> 5 passed, 0 failed (12.00s); artifact `test-results/cycle-U43.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U214: U214 active admitted account requests Better Auth code

- test: `tests/integration/auth.test.ts::U214 active admitted account requests Better Auth code`
- red: `bun run test:file tests/integration/auth.test.ts --name U214 active admitted account requests Better Auth code` -> `Expected values to be strictly deep-equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth.ts`; `bun run test:file tests/integration/auth.test.ts` -> 6 passed, 0 failed (12.68s); artifact `test-results/cycle-U214.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U215: U215 per email request quota is durable

- test: `tests/integration/auth.test.ts::U215 per email request quota is durable`
- red: `bun run test:file tests/integration/auth.test.ts --name U215 per email request quota is durable` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth.ts`; `bun run test:file tests/integration/auth.test.ts` -> 7 passed, 0 failed (12.18s); artifact `test-results/cycle-U215.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U216: U216 durable mail payload is encrypted and authenticated

- test: `tests/integration/auth.test.ts::U216 durable mail payload is encrypted and authenticated`
- red: `bun run test:file tests/integration/auth.test.ts --name U216 durable mail payload is encrypted and authenticated` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/private-crypto.ts`; `bun run test:file tests/integration/auth.test.ts` -> 8 passed, 0 failed (12.80s); artifact `test-results/cycle-U216.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U217: U217 OTP mail creates encrypted recoverable dispatch

- test: `tests/integration/auth.test.ts::U217 OTP mail creates encrypted recoverable dispatch`
- red: `bun run test:file tests/integration/auth.test.ts --name U217 OTP mail creates encrypted recoverable dispatch` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/mail-queue.ts`; `bun run test:file tests/integration/auth.test.ts` -> 9 passed, 0 failed (12.34s); artifact `test-results/cycle-U217.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U218: U218 private provisioning creates non admitted identity

- test: `tests/integration/auth.test.ts::U218 private provisioning creates non admitted identity`
- red: `bun run test:file tests/integration/auth.test.ts --name U218 private provisioning creates non admitted identity` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth-runtime.ts`; `bun run test:file tests/integration/auth.test.ts` -> 10 passed, 0 failed (12.93s); artifact `test-results/cycle-U218.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U48: U48 expired queued OTP mail is not sent

- test: `tests/integration/auth.test.ts::U48 expired queued OTP mail is not sent`
- red: `bun run test:file tests/integration/auth.test.ts --name U48 expired queued OTP mail is not sent` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `apps/worker/src/tasks/mail.ts`; `bun run test:file tests/integration/auth.test.ts` -> 11 passed, 0 failed (13.55s); artifact `test-results/cycle-U48.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U219: U219 stored OTP verifier is keyed outside database

- test: `tests/integration/auth.test.ts::U219 stored OTP verifier is keyed outside database`
- red: `bun run test:file tests/integration/auth.test.ts --name U219 stored OTP verifier is keyed outside database` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth-runtime.ts`; `bun run test:file tests/integration/auth.test.ts` -> 12 passed, 0 failed (13.14s); artifact `test-results/cycle-U219.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U44: U44 OTP one millisecond before expiry may verify

- test: `tests/integration/auth.test.ts::U44 OTP one millisecond before expiry may verify`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U44 OTP one millisecond before expiry may verify` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 13 passed, 0 failed; artifact `test-results/cycle-U44.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U45: U45 OTP at five minute expiry is rejected

- test: `tests/integration/auth.test.ts::U45 OTP at five minute expiry is rejected`
- red: `bun run test:file tests/integration/auth.test.ts --name U45 OTP at five minute expiry is rejected` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth-runtime.ts`; `bun run test:file tests/integration/auth.test.ts` -> 14 passed, 0 failed (13.93s); artifact `test-results/cycle-U45.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U220: U220 scheduling failure preserves generic code response

- test: `tests/integration/auth.test.ts::U220 scheduling failure preserves generic code response`
- red: `bun run test:file tests/integration/auth.test.ts --name U220 scheduling failure preserves generic code response` -> `fixture scheduling failure`; actual exit 1.
- green: smallest production change in `packages/domain/src/auth.ts`; `bun run test:file tests/integration/auth.test.ts` -> 15 passed, 0 failed (13.92s); artifact `test-results/cycle-U220.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U46: U46 fifth verification attempt remains within limit

- test: `tests/integration/auth.test.ts::U46 fifth verification attempt remains within limit`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U46 fifth verification attempt remains within limit` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 16 passed, 0 failed; artifact `test-results/cycle-U46.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U47: U47 sixth verification attempt is rejected

- test: `tests/integration/auth.test.ts::U47 sixth verification attempt is rejected`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U47 sixth verification attempt is rejected` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 17 passed, 0 failed; artifact `test-results/cycle-U47.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U221: U221 trusted OTP job sends current code through SMTP

- test: `tests/integration/auth.test.ts::U221 trusted OTP job sends current code through SMTP`
- red: `bun run test:file tests/integration/auth.test.ts --name U221 trusted OTP job sends current code through SMTP` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `apps/worker/src/tasks/mail.ts`; `bun run test:file tests/integration/auth.test.ts` -> 18 passed, 0 failed (15.27s); artifact `test-results/cycle-U221.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior A3: A3 admitted operator signs in through SMTP code

- test: `tests/integration/auth.test.ts::A3 admitted operator signs in through SMTP code`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name A3 admitted operator signs in through SMTP code` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 19 passed, 0 failed; artifact `test-results/cycle-A3.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U222: U222 malformed mail reference fails before SQL

- test: `tests/integration/auth.test.ts::U222 malformed mail reference fails before SQL`
- red: `bun run test:file tests/integration/auth.test.ts --name U222 malformed mail reference fails before SQL` -> `Invalid mail job reference`; actual exit 1.

## Graphile connection teardown correction

U222's behavior passed, but the owning suite caught a real asynchronous PostgreSQL error after teardown. Installed Graphile0.18.0's internally owned pool disposer calls `pgPool.end()` without returning its promise. Use the supported `pgPool` option with explicit caller-owned pools and await their shutdown; no dependency patch, test suppression or error swallowing. Migration coordination now awaits its own queue pool shutdown, and auth fixtures pass their owned pool to runOnce. Rerun all owning auth checks before recording Green.

## U222 green after complete connection teardown

- `bun run test:file tests/integration/auth.test.ts`: 20 passed, 0 failed, no asynchronous teardown error after explicit caller-owned queue pools.
- Malformed references reject before SQL; unchanged valid mail jobs still deliver through SMTP. Refactor: supported pool ownership/shutdown, no error suppression. Commit: uncommitted.
- The same caller-owned pool pattern is applied to the existing Graphile fixture exemplar; its assertions remain unchanged.
- A3 currently proves handler-backed SMTP→session behavior; public Next route wiring and full story checks remain pending, so it is held GREEN until that transport is exercised.

## Cycle U223: U223 Next auth route mounts passwordless service

- test: `tests/integration/auth.test.ts::U223 Next auth route mounts passwordless service`
- red: `bun run test:file tests/integration/auth.test.ts --name U223 Next auth route mounts passwordless service` -> `Expected values to be strictly equal`; actual exit 1.

## U223 build-boundary correction

The real Next production build exposed a packaging problem: importing runtime database helpers also pulled the CLI-only migration-directory URL into Webpack. Moved only migration coordination to `packages/domain/src/migrate.ts`; runtime storage stays in db.ts. Updated test/CLI imports without changing assertions or migration contents. This integration fix is part of making U223 Green, not a claimed new Red for migration behavior.

## U223 transport Green and test ownership refactor

- After separating migration-only assets, the actual production Next route test passes (1 test, 0 failures).
- This build/transport gate now belongs to tests/deployment/installation.test.ts, run once in the deployment lane; pure auth primitive loops no longer rebuild Next on every change. Extracted and reused tests/helpers/auth-fixtures.ts, preserving assertions. Verify both owners after the move.
- No alpha release/prebuilt installation claimed by this source-build transport test.

## Covered behavior U224: U224 superseded queued OTP code is not sent

- test: `tests/integration/auth.test.ts::U224 superseded queued OTP code is not sent`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/worker/src/tasks/mail.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U224 superseded queued OTP code is not sent` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 21 passed, 0 failed; artifact `test-results/cycle-U224.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U50: U50 public registration stays disabled

- test: `tests/integration/auth.test.ts::U50 public registration stays disabled`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U50 public registration stays disabled` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 23 passed, 0 failed; artifact `test-results/cycle-U50.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U49: U49 unverified matching email never links OAuth implicitly

- test: `tests/integration/auth.test.ts::U49 unverified matching email never links OAuth implicitly`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/auth-runtime.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U49 unverified matching email never links OAuth implicitly` -> `account_not_linked` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 23 passed, 0 failed; artifact `test-results/cycle-U49.txt`.
- refactor: none needed.
- commit: uncommitted.

## U49 OAuth fixture correction

The initial denial test did not catch its deliberate mutant because the fake provider omitted its stable `sub` claim, causing an earlier user-info error. That run earned no completion evidence. Corrected the fake profile and asserted the exact `account_not_linked` error; the network double handles Request/URL inputs and refuses unexpected requests instead of falling through to live providers. Repeated the same policy mutant against this strengthened test before completion.

## Cycle U225: U225 mail worker reads OTP state without session access

- test: `tests/integration/auth.test.ts::U225 mail worker reads OTP state without session access`
- red: `bun run test:file tests/integration/auth.test.ts --name U225 mail worker reads OTP state without session access` -> `permission denied for schema auth`; actual exit 1.
- green: smallest production change in `packages/domain/migrations/0004_platform_recovery.sql`; `bun run test:file tests/integration/auth.test.ts` -> 24 passed, 0 failed (17.17s); artifact `test-results/cycle-U225.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U226: U226 expired platform ownership gets fresh generation

- test: `tests/integration/auth.test.ts::U226 expired platform ownership gets fresh generation`
- red: `bun run test:file tests/integration/auth.test.ts --name U226 expired platform ownership gets fresh generation` -> `not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/platform-recovery.ts`; `bun run test:file tests/integration/auth.test.ts` -> 25 passed, 0 failed (17.05s); artifact `test-results/cycle-U226.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U227: U227 claimed mail increments bounded attempt count

- test: `tests/integration/auth.test.ts::U227 claimed mail increments bounded attempt count`
- red: `bun run test:file tests/integration/auth.test.ts --name U227 claimed mail increments bounded attempt count` -> `Expected values to be strictly equal`; actual exit 1.
- green: smallest production change in `apps/worker/src/tasks/mail.ts`; `bun run test:file tests/integration/auth.test.ts` -> 26 passed, 0 failed (17.38s); artifact `test-results/cycle-U227.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U228: U228 SMTP failure schedules fresh delayed retry

- test: `tests/integration/auth.test.ts::U228 SMTP failure schedules fresh delayed retry`
- red: `bun run test:file tests/integration/auth.test.ts --name U228 SMTP failure schedules fresh delayed retry` -> `SMTP delivery failed`; actual exit 1.
- green: smallest production change in `apps/worker/src/tasks/mail.ts`; `bun run test:file tests/integration/auth.test.ts` -> 27 passed, 0 failed (18.39s); artifact `test-results/cycle-U228.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U229: U229 fifth failed mail attempt is terminal

- test: `tests/integration/auth.test.ts::U229 fifth failed mail attempt is terminal`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/worker/src/tasks/mail.ts` temporarily violated this invariant; `bun run test:file tests/integration/auth.test.ts --name U229 fifth failed mail attempt is terminal` -> `Expected values to be strictly equal` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/auth.test.ts` -> 28 passed, 0 failed; artifact `test-results/cycle-U229.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U230: U230 supervisor automatically recovers mail dispatch

- test: `tests/integration/auth.test.ts::U230 supervisor automatically recovers mail dispatch`
- red: `bun run test:file tests/integration/auth.test.ts --name U230 supervisor automatically recovers mail dispatch` -> `automatic supervisor must recover mail`; actual exit 1.
- green: smallest production change in `apps/worker/src/recovery.ts`; `bun run test:file tests/integration/auth.test.ts` -> 29 passed, 0 failed (22.96s); artifact `test-results/cycle-U230.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Auth/mail primitive checkpoint

Owning auth file: 29 passed, 0 failed. Includes concurrent/secret/verified-email bootstrap, generic code requests, keyed OTP storage, exact expiry/attempt boundaries, controlled OAuth unverified-link denial, public signup denial, real Graphile/SMTP delivery, encrypted jobs, stale/expired mail suppression, bounded mail attempts/retry/exhaustion and automatic platform-job recovery. Public Next auth transport is separately owned by deployment installation tests to avoid rebuilding the app in every primitive cycle. Role/admission APIs, public owner setup, dashboard and full story gates remain open.

## Cycle U51: U51 inherited grants union across instance workspace project

- test: `tests/unit/policy.test.ts::U51 inherited grants union across instance workspace project`
- red: `bun run test:file tests/unit/policy.test.ts --name U51 inherited grants union across instance workspace project` -> `error: not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/authorization.ts`; `bun run test:file tests/unit/policy.test.ts` -> 1 passed, 0 failed (0.05s); artifact `test-results/cycle-U51.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U52: U52 project grant cannot access sibling project

- test: `tests/unit/policy.test.ts::U52 project grant cannot access sibling project`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/unit/policy.test.ts --name U52 project grant cannot access sibling project` -> `error: expect(received).toEqual(expected)` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/policy.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U52.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U53: U53 child permissions cannot deny inherited grants

- test: `tests/unit/policy.test.ts::U53 child permissions cannot deny inherited grants`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/unit/policy.test.ts --name U53 child permissions cannot deny inherited grants` -> `error: expect(received).toEqual(expected)` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/policy.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U53.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U51: U51 admission grants no resource access

- test: `tests/integration/authorization.test.ts::U51 admission grants no resource access`
- red: `bun run test:file tests/integration/authorization.test.ts --name U51 admission grants no resource access` -> `actorPermissions must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/authorization.ts`; `bun run test:file tests/integration/authorization.test.ts` -> 1 passed, 0 failed (11.50s); artifact `test-results/cycle-U51.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U52: U52 instance grants apply to child resources

- test: `tests/integration/authorization.test.ts::U52 instance grants apply to child resources`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/integration/authorization.test.ts --name U52 instance grants apply to child resources` -> `payload.read` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/authorization.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U52.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U53: U53 workspace grants exclude other workspaces

- test: `tests/integration/authorization.test.ts::U53 workspace grants exclude other workspaces`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/integration/authorization.test.ts --name U53 workspace grants exclude other workspaces` -> `payload.read` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/authorization.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U53.txt`.
- refactor: none needed.
- commit: uncommitted.

Trace correction: the earlier three pure inheritance examples were initially numbered U51–53 despite differing original row wording. Original rows are preserved; U51–53 now have database-backed admission/inheritance checks, and the project/child-positive examples correctly trace U54–55. No assertions were removed.

## Covered behavior U56: U56 grantor cannot escalate permissions

- test: `tests/unit/policy.test.ts::U56 grantor cannot escalate permissions`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/unit/policy.test.ts --name U56 grantor cannot escalate permissions` -> `toThrow` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/policy.test.ts` -> 4 passed, 0 failed; artifact `test-results/cycle-U56.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U58: U58 tokens intersect current user and stored token rights

- test: `tests/integration/authorization.test.ts::U58 tokens intersect current user and stored token rights`
- red: `bun run test:file tests/integration/authorization.test.ts --name U58 tokens intersect current user and stored token rights` -> `stored token rights must cap the actor`; actual exit 1.
- green: smallest production change in `packages/domain/src/authorization.ts`; `bun run test:file tests/integration/authorization.test.ts` -> 4 passed, 0 failed (11.87s); artifact `test-results/cycle-U58.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U59: U59 revoked token immediately loses access

- test: `tests/integration/authorization.test.ts::U59 revoked token immediately loses access`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/integration/authorization.test.ts --name U59 revoked token immediately loses access` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/authorization.test.ts` -> 5 passed, 0 failed; artifact `test-results/cycle-U59.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U57: U57 concurrent owner demotions cannot orphan scope

- test: `tests/integration/authorization.test.ts::U57 concurrent owner demotions cannot orphan scope`
- red: `bun run test:file tests/integration/authorization.test.ts --name U57 concurrent owner demotions cannot orphan scope` -> `setGrant must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/authorization.ts`; `bun run test:file tests/integration/authorization.test.ts` -> 6 passed, 0 failed (12.28s); artifact `test-results/cycle-U57.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U231: U231 inactive admission rejects inherited grants

- test: `tests/integration/authorization.test.ts::U231 inactive admission rejects inherited grants`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/integration/authorization.test.ts --name U231 inactive admission rejects inherited grants` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/authorization.test.ts` -> 7 passed, 0 failed; artifact `test-results/cycle-U231.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U232: U232 membership rejects escalation and stale writes

- test: `tests/integration/authorization.test.ts::U232 membership rejects escalation and stale writes`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/authorization.ts` temporarily violated this invariant; `bun run test:file tests/integration/authorization.test.ts --name U232 membership rejects escalation and stale writes` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/authorization.test.ts` -> 8 passed, 0 failed; artifact `test-results/cycle-U232.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U233: U233 token creation stores only hash and revocation is immediate

- test: `tests/integration/authorization.test.ts::U233 token creation stores only hash and revocation is immediate`
- red: `bun run test:file tests/integration/authorization.test.ts --name U233 token creation stores only hash and revocation is immediate` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/tokens.ts`; `bun run test:file tests/integration/authorization.test.ts` -> 9 passed, 0 failed (12.53s); artifact `test-results/cycle-U233.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U234: U234 owner setup code is secret protected and closes permanently

- test: `tests/integration/auth.test.ts::U234 owner setup code is secret protected and closes permanently`
- red: `bun run test:file tests/integration/auth.test.ts --name U234 owner setup code is secret protected and closes permanently` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/bootstrap.ts`, `packages/domain/src/auth.ts`, `packages/domain/src/setup.ts`; `bun run test:file tests/integration/auth.test.ts` -> 30 passed, 0 failed (23.62s); artifact `test-results/cycle-U234.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle A1: A1 real Next installation completes one verified owner

- test: `tests/deployment/installation.test.ts::A1 real Next installation completes one verified owner`
- red: `bun run test:file tests/deployment/installation.test.ts --name A1 real Next installation completes one verified owner` -> `bootstrap route must exist`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/bootstrap/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 2 passed, 0 failed (60.38s); artifact `test-results/cycle-A1.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U235: U235 request authentication denies anonymous and inactive sessions

- test: `tests/integration/auth.test.ts::U235 request authentication denies anonymous and inactive sessions`
- red: `bun run test:file tests/integration/auth.test.ts --name U235 request authentication denies anonymous and inactive sessions` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/principal.ts`, `packages/domain/src/request-types.ts`; `bun run test:file tests/integration/auth.test.ts` -> 31 passed, 0 failed (24.21s); artifact `test-results/cycle-U235.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U236: U236 resource creation scopes owner and preserves unique slugs

- test: `tests/integration/authorization.test.ts::U236 resource creation scopes owner and preserves unique slugs`
- red: `bun run test:file tests/integration/authorization.test.ts --name U236 resource creation scopes owner and preserves unique slugs` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.

U236 Green correction: real PostgreSQL rejected the audit parameter reused as UUID and text (42P08). Added explicit casts; no assertions changed. `bun run test:file tests/integration/authorization.test.ts` passed all 10 tests.

## Cycle A2: A2 real API denies anonymous and inactive access

- test: `tests/deployment/installation.test.ts::A2 real API denies anonymous and inactive access`
- red: `bun run test:file tests/deployment/installation.test.ts --name A2 real API denies anonymous and inactive access` -> `private API must authenticate`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/_lib/protected.ts`, `apps/web/src/app/api/v1/me/route.ts`, `packages/contracts/src/resources.ts`, `apps/web/src/app/api/v1/workspaces/route.ts`, `apps/web/src/app/api/v1/projects/route.ts`, `apps/web/src/app/api/v1/tokens/route.ts`, `apps/web/src/app/api/v1/members/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 3 passed, 0 failed (61.25s); artifact `test-results/cycle-A2.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U60: U60 setup explains service errors and retry recovers

- test: `tests/acceptance/dashboard.spec.ts::U60 setup explains service errors and retry recovers`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U60 setup explains service errors and retry recovers` -> `Set up Payload Bay`; actual exit 1.

Browser harness now starts real disposable PostgreSQL and SMTP plus a continuous Graphile mail worker, and tears them down after Playwright. Source builds are reused only when a SHA-256 fingerprint of all web/domain/contracts/SDK/executor source and build configuration matches the existing standalone artifact. Browser and transport tests still rebuild when production source changes. Runner wording now reports selected tests rather than incorrectly saying all product acceptance is unimplemented.

U60 Green correction: Next adds a route-announcer alert, making the original generic role locator ambiguous. Named the app alert "Authentication error" and selected that accessible alert; retained the original error text and disappearance assertions. Owning browser file passed 1/1 with the actual DB/SMTP worker harness.

Refactor after permission Green: separated the pure role/grant-union policy in authorization.ts from PostgreSQL ancestry, membership, and ownership transactions in membership.ts, matching T029. Updated call sites without changing public behavior. Pure policy remains covered in the unit lane; SQL ownership behavior remains real-PG integration coverage, not misrepresented as Bun unit coverage.

Access subsystem refactor gate: `bun run test:integration` passed 83 tests, 0 failed (68.31s); `bun run test:unit` passed 34 tests, 0 failed (2.89s) with authorized native subprocess execution. The first sandboxed compiler run stopped esbuild and timed out; rerunning with permitted native subprocesses passed without changing tests or timeout thresholds. Completed T025–T030 based on implemented auth/membership/token services, actual HTTP routes, permission documentation and owning gates. Original planned membership checks are in the dedicated authorization.test.ts owning file rather than enlarging auth.test.ts, preserving scoped test ownership. A1–A3 stay GREEN pending final complete story/deployment checks.

## Covered behavior U61: U61 setup and login use real SMTP codes

- test: `tests/acceptance/dashboard.spec.ts::U61 setup and login use real SMTP codes`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/web/src/app/components/auth-panel.tsx` temporarily violated this invariant; `bun run test:file tests/acceptance/dashboard.spec.ts --name U61 setup and login use real SMTP codes` -> `toHaveURL` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/acceptance/dashboard.spec.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U61.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U62: U62 dashboard hides projects outside inherited access

- test: `tests/acceptance/dashboard.spec.ts::U62 dashboard hides projects outside inherited access`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U62 dashboard hides projects outside inherited access` -> `Projects`; actual exit 1.

U62 Green correction: the first whole browser-file run inherited Better Auth per-address rate-limit state from earlier scenarios (429), while its named Red was valid. Browser beforeEach now waits for fixture jobs to finish and truncates only domain/auth data in a guarded disposable case database, preserving migration ledgers and Graphile task registration. SMTP/HTTP captures are reset between cases as well. Production limits are unchanged; no assertions weakened. Owning browser file passes all 3 tests (15.67s with source build reused). The dashboard now provides an actual /dashboard destination for setup/login, Pro responsive navigation and workspace/project creation; project-only viewers see their accessible project and no create controls.

## Cycle U65: U65 stale draft version cannot overwrite saved code

- test: `tests/integration/publication.test.ts::U65 stale draft version cannot overwrite saved code`
- red: `bun run test:file tests/integration/publication.test.ts --name U65 stale draft version cannot overwrite saved code` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/publication.ts`; `bun run test:file tests/integration/publication.test.ts` -> 1 passed, 0 failed (11.29s); artifact `test-results/cycle-U65.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U63: U63 member editing preserves presets and customized rights

- test: `tests/acceptance/dashboard.spec.ts::U63 member editing preserves presets and customized rights`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U63 member editing preserves presets and customized rights` -> `Instance members`; actual exit 1.

## Cycle U66: U66 compile failure preserves active code and revision history

- test: `tests/integration/publication.test.ts::U66 compile failure preserves active code and revision history`
- red: `bun run test:file tests/integration/publication.test.ts --name U66 compile failure preserves active code and revision history` -> `publish must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/publication.ts`; `bun run test:file tests/integration/publication.test.ts` -> 2 passed, 0 failed (13.80s); artifact `test-results/cycle-U66.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U67: U67 publication activates both pinned stages atomically

- test: `tests/integration/publication.test.ts::U67 publication activates both pinned stages atomically`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/publication.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U67 publication activates both pinned stages atomically` -> `processing` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U67.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U68: U68 draft edit does not change pinned published code

- test: `tests/integration/publication.test.ts::U68 draft edit does not change pinned published code`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/publication.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U68 draft edit does not change pinned published code` -> `ERR_ASSERTION` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 4 passed, 0 failed; artifact `test-results/cycle-U68.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U69: U69 rollback activates recorded code without changing history

- test: `tests/integration/publication.test.ts::U69 rollback activates recorded code without changing history`
- red: `bun run test:file tests/integration/publication.test.ts --name U69 rollback activates recorded code without changing history` -> `activatePublication must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/publication.ts`; `bun run test:file tests/integration/publication.test.ts` -> 5 passed, 0 failed (15.60s); artifact `test-results/cycle-U69.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U64: U64 local theme fonts and icons render without remote requests

- test: `tests/acceptance/dashboard.spec.ts::U64 local theme fonts and icons render without remote requests`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/web/src/app/globals.css` temporarily violated this invariant; `bun run test:file tests/acceptance/dashboard.spec.ts --name U64 local theme fonts and icons render without remote requests` -> `Inter Variable` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/acceptance/dashboard.spec.ts` -> 5 passed, 0 failed; artifact `test-results/cycle-U64.txt`.
- refactor: none needed.
- commit: uncommitted.

U63 Green corrections: installed Pro Sheet has no Description compound member; used its documented header anatomy with an associated descriptive paragraph. HeroUI intentionally hides the native checkbox input beneath its visual control; the browser test now clicks the visible labels and explicitly checks the resulting selected state, without force clicks or weaker save assertions. U64 final owning browser gate passes all 5 cases, including real role customization, local Inter, dark/light brand tokens, and no remote asset requests. Native compiler/publisher file passes 5 cases with real workerd execution of the pinned old bundle. U68 mutant was caught by the actual pointer assertion; helper marker corrected from a column name absent in Node TAP to ERR_ASSERTION and the same assertion/mutant was rerun.

## Cycle U237: U237 inaccessible projects do not consume listing limit

- test: `tests/integration/authorization.test.ts::U237 inaccessible projects do not consume listing limit`
- red: `bun run test:file tests/integration/authorization.test.ts --name U237 inaccessible projects do not consume listing limit` -> `accessible projects must not be forced off the page`; actual exit 1.
- green: smallest production change in `packages/domain/src/resources.ts`; `bun run test:file tests/integration/authorization.test.ts` -> 11 passed, 0 failed (14.23s); artifact `test-results/cycle-U237.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U238: U238 blank SMTP credentials are absent while partial auth fails

- test: `tests/unit/contracts.test.ts::U238 blank SMTP credentials are absent while partial auth fails`
- red: `bun run test:file tests/unit/contracts.test.ts --name U238 blank SMTP credentials are absent while partial auth fails` -> `SMTP configuration is incomplete`; actual exit 1.
- green: smallest production change in `packages/domain/src/config.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 17 passed, 0 failed (2.13s); artifact `test-results/cycle-U238.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U239: U239 lookalike JSON media type is rejected before parsing

- test: `tests/integration/live-api.test.ts::U239 lookalike JSON media type is rejected before parsing`
- red: `bun run test:file tests/integration/live-api.test.ts --name U239 lookalike JSON media type is rejected before parsing` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/_lib/handler.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 9 passed, 0 failed (0.36s); artifact `test-results/cycle-U239.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U240: U240 isolated compiler preserves bundles and body diagnostics

- test: `tests/executor/compiler.test.ts::U240 isolated compiler preserves bundles and body diagnostics`
- red: `bun run test:file tests/executor/compiler.test.ts --name U240 isolated compiler preserves bundles and body diagnostics` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `apps/executor/src/compile-child.ts`, `apps/executor/src/compile-rpc.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 1 passed, 0 failed (4.20s); artifact `test-results/cycle-U240.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U242: U242 TypeScript reference directives cannot read a host canary

- test: `tests/executor/compiler.test.ts::U242 TypeScript reference directives cannot read a host canary`
- red: `bun run test:file tests/executor/compiler.test.ts --name U242 TypeScript reference directives cannot read a host canary` -> `host references must be denied before reading them`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 2 passed, 0 failed (4.20s); artifact `test-results/cycle-U242.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U243: U243 large compiler result is flushed before child exits

- test: `tests/executor/compiler.test.ts::U243 large compiler result is flushed before child exits`
- red: `bun run test:file tests/executor/compiler.test.ts --name U243 large compiler result is flushed before child exits` -> `large compiler results must flush before exit`; actual exit 1.
- green: smallest production change in `apps/executor/src/compile-child.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 3 passed, 0 failed (5.58s); artifact `test-results/cycle-U243.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

Compiler packaging refactor: CompilationError now lives in pure contracts, so importing the RPC client does not load the compiler in the supervisor. SDK declarations are embedded in a generated module from the canonical lifecycle.ts instead of a filesystem URL that would break in a bundled image. A consistency gate follows; compiler behavior and body offsets are preserved.

## Covered behavior U244: U244 embedded compiler SDK cannot drift from canonical source

- test: `tests/unit/contracts.test.ts::U244 embedded compiler SDK cannot drift from canonical source`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/script-sdk/src/declarations.generated.ts` temporarily violated this invariant; `bun run test:file tests/unit/contracts.test.ts --name U244 embedded compiler SDK cannot drift from canonical source` -> `toBe` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/unit/contracts.test.ts` -> 18 passed, 0 failed; artifact `test-results/cycle-U244.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U241: U241 prebuilt executor provides authenticated compilation

- test: `tests/executor/compiler.test.ts::U241 prebuilt executor provides authenticated compilation`
- red: `bun run test:file tests/executor/compiler.test.ts --name U241 prebuilt executor provides authenticated compilation` -> `compiler RPC must be available in the prebuilt image`; actual exit 1.
- green: smallest production change in `apps/executor/src/server.ts`, `deploy/Dockerfile.executor`; `bun run test:file tests/executor/compiler.test.ts` -> 4 passed, 0 failed (19.60s); artifact `test-results/cycle-U241.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U245: U245 compilation API errors retain body line diagnostics

- test: `tests/unit/contracts.test.ts::U245 compilation API errors retain body line diagnostics`
- red: `bun run test:file tests/unit/contracts.test.ts --name U245 compilation API errors retain body line diagnostics` -> `compilation_failed`; actual exit 1.
- green: smallest production change in `packages/contracts/src/errors.ts`, `packages/contracts/src/compilation.ts`, `packages/contracts/src/api.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 19 passed, 0 failed (1.82s); artifact `test-results/cycle-U245.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U246: U246 compiler client authenticates and preserves validated diagnostics

- test: `tests/integration/executor-client.test.ts::U246 compiler client authenticates and preserves validated diagnostics`
- red: `bun run test:file tests/integration/executor-client.test.ts --name U246 compiler client authenticates and preserves validated diagnostics` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/executor-client.ts`, `apps/executor/src/compiler.ts`; `bun run test:file tests/integration/executor-client.test.ts` -> 1 passed, 0 failed (2.23s); artifact `test-results/cycle-U246.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U247: U247 ingress route creation is scoped and unpublished

- test: `tests/integration/publication.test.ts::U247 ingress route creation is scoped and unpublished`
- red: `bun run test:file tests/integration/publication.test.ts --name U247 ingress route creation is scoped and unpublished` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/endpoints.ts`; `bun run test:file tests/integration/publication.test.ts` -> 6 passed, 0 failed (15.76s); artifact `test-results/cycle-U247.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle A5: A5 API draft changes leave published runtime behavior unchanged

- test: `tests/deployment/installation.test.ts::A5 API draft changes leave published runtime behavior unchanged`
- red: `bun run test:file tests/deployment/installation.test.ts --name A5 API draft changes leave published runtime behavior unchanged` -> `endpoint API must be available`; actual exit 1.

A5 transport Green correction: the web TypeScript lib set lacked DOM.AsyncIterable although production Node 22 implements response stream iteration. Added the matching library declarations; did not weaken types or assertions. Unchanged complete Next transport owning file passes 4/4 (84.85s), including authenticated publication through the restricted prebuilt compiler, old bundle execution after draft edits, and accurate 422 body diagnostics without changing the active revision. Build failures are cached per source fingerprint within a test process, so the same failed artifact is not rebuilt once per dependent test. A5 remains GREEN pending parent-helper and full affected-story gates.

## Cycle U70: U70 secret use rights do not imply secret management

- test: `tests/integration/publication.test.ts::U70 secret use rights do not imply secret management`
- red: `bun run test:file tests/integration/publication.test.ts --name U70 secret use rights do not imply secret management` -> `ERR_MODULE_NOT_FOUND`; actual exit 1.
- green: smallest production change in `packages/domain/src/secrets.ts`; `bun run test:file tests/integration/publication.test.ts` -> 7 passed, 0 failed (16.34s); artifact `test-results/cycle-U70.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U71: U71 secret management does not grant value use

- test: `tests/integration/publication.test.ts::U71 secret management does not grant value use`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/secrets.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U71 secret management does not grant value use` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 8 passed, 0 failed; artifact `test-results/cycle-U71.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U72: U72 secret versions are encrypted and values never appear in audit

- test: `tests/integration/publication.test.ts::U72 secret versions are encrypted and values never appear in audit`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/secrets.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U72 secret versions are encrypted and values never appear in audit` -> `stored secret must be encrypted` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 9 passed, 0 failed; artifact `test-results/cycle-U72.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U74: U74 revocation prevents old binding from silently using a new version

- test: `tests/integration/publication.test.ts::U74 revocation prevents old binding from silently using a new version`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/secrets.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U74 revocation prevents old binding from silently using a new version` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 10 passed, 0 failed; artifact `test-results/cycle-U74.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U248: U248 body-only edit preserves configured shared bindings

- test: `tests/integration/publication.test.ts::U248 body-only edit preserves configured shared bindings`
- red: `bun run test:file tests/integration/publication.test.ts --name U248 body-only edit preserves configured shared bindings` -> `body-only edit must preserve bindings`; actual exit 1.
- green: smallest production change in `packages/domain/src/publication.ts`; `bun run test:file tests/integration/publication.test.ts` -> 11 passed, 0 failed (17.10s); artifact `test-results/cycle-U248.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U73: U73 published secret bindings never enter compiler or diagnostics

- test: `tests/integration/publication.test.ts::U73 published secret bindings never enter compiler or diagnostics`
- red: `bun run test:file tests/integration/publication.test.ts --name U73 published secret bindings never enter compiler or diagnostics` -> `secret bindings must be saved`; actual exit 1.
- green: smallest production change in `packages/domain/src/publication.ts`, `packages/domain/migrations/0005_secret_bindings.sql`, `packages/domain/src/schema.ts`, `apps/web/src/app/api/v1/endpoints/[endpointId]/drafts/[stage]/route.ts`; `bun run test:file tests/integration/publication.test.ts` -> 12 passed, 0 failed (17.98s); artifact `test-results/cycle-U73.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U249: U249 script SDK helpers preserve bytes and invoke managed destination

- test: `tests/executor/isolation.test.ts::U249 script SDK helpers preserve bytes and invoke managed destination`
- red: `bun run test:file tests/executor/isolation.test.ts --name U249 script SDK helpers preserve bytes and invoke managed destination` -> `execution_error`; actual exit 1.
- green: `bun run test:file tests/executor/isolation.test.ts` -> 14 passed, 0 failed (21.84s). Added the platform-owned wire module to workerd configuration and kept emitted codec functions closure-free; initial Green exposed a missing module registration and a transpiler helper dependency, both fixed without test changes.
- refactor: tagged wire format preserves literal user JSON and binary values; no host eval or script-controlled module names.
- commit: uncommitted, preserving known worktree.

## Cycle U85: U85 accepted binary bytes are durable before acknowledgement

- test: `tests/integration/ingress.test.ts::U85 accepted binary bytes are durable before acknowledgement`
- red: `bun run test:file tests/integration/ingress.test.ts --name U85 accepted binary bytes are durable before acknowledgement` -> `accepted response requires durable transaction`; actual exit 1.
- green: `bun run test:file tests/integration/ingress.test.ts` -> 1 passed, 0 failed (12.48s), actual workerd plus PostgreSQL/Graphile. Fixture corrected to represent completed installation bootstrap; no assertion changed.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U93: U93 reject produces no stored event or queued work

- test: `tests/integration/ingress.test.ts::U93 reject produces no stored event or queued work`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/ingress.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U93 reject produces no stored event or queued work` -> `reject bypassed` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U93.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U94: U94 queue failure rolls back accepted event and acknowledgement

- test: `tests/integration/ingress.test.ts::U94 queue failure rolls back accepted event and acknowledgement`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/ingress.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U94 queue failure rolls back accepted event and acknowledgement` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U94.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U96: U96 managed configured destination returns real HTTP success

- test: `tests/integration/delivery.test.ts::U96 managed configured destination returns real HTTP success`
- red: `bun run test:file tests/integration/delivery.test.ts --name U96 managed configured destination returns real HTTP success` -> `managed result must reflect actual HTTP success`; actual exit 1.
- green: smallest production change in `packages/domain/src/delivery.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 1 passed, 0 failed (10.90s); artifact `test-results/cycle-U96.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U95: U95 ingress response rejects CRLF header injection

- test: `tests/unit/contracts.test.ts::U95 ingress response rejects CRLF header injection`
- red: `bun run test:file tests/unit/contracts.test.ts --name U95 ingress response rejects CRLF header injection` -> `toThrow`; actual exit 1.
- green: smallest production change in `packages/contracts/src/lifecycle.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 20 passed, 0 failed (2.41s); artifact `test-results/cycle-U95.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U99: U99 operation ID cannot change its request content

- test: `tests/integration/delivery.test.ts::U99 operation ID cannot change its request content`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/delivery.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U99 operation ID cannot change its request content` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U99.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U100: U100 fresh recovery generation reuses committed HTTP success

- test: `tests/integration/delivery.test.ts::U100 fresh recovery generation reuses committed HTTP success`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/delivery.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U100 fresh recovery generation reuses committed HTTP success` -> `recovery must reuse committed success` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U100.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U106: U106 retry schedules a delayed fresh fenced generation

- test: `tests/integration/recovery.test.ts::U106 retry schedules a delayed fresh fenced generation`
- red: `bun run test:file tests/integration/recovery.test.ts --name U106 retry schedules a delayed fresh fenced generation` -> `Processing outcome not implemented`; actual exit 1.
- green: `bun run test:file tests/integration/recovery.test.ts` -> 20 passed, 0 failed (36.96s). Fixed the new fixture's payload inspection to use Graphile's actual storage, because the public jobs view omits payloads; generation assertions preserved. Production uses supported enqueue API only.
- refactor: none needed.
- commit: uncommitted.

## Cycle U250: U250 executor HTTP invocation preserves binary bodies

- test: `tests/integration/executor-client.test.ts::U250 executor HTTP invocation preserves binary bodies`
- red: `bun run test:file tests/integration/executor-client.test.ts --name U250 executor HTTP invocation preserves binary bodies` -> `Executor invocation unavailable`; actual exit 1.
- green: smallest production change in `packages/domain/src/executor-client.ts`, `apps/executor/src/server.ts`; `bun run test:file tests/integration/executor-client.test.ts` -> 2 passed, 0 failed (10.91s); artifact `test-results/cycle-U250.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U105: U105 continuous worker handles accepted event and records completion

- test: `tests/integration/ingress.test.ts::U105 continuous worker handles accepted event and records completion`
- red: `bun run test:file tests/integration/ingress.test.ts --name U105 continuous worker handles accepted event and records completion` -> `continuous worker must complete accepted execution`; actual exit 1.
- green: `bun run test:file tests/integration/ingress.test.ts` -> 4 passed, 0 failed (14.36s), including continuous Graphile task pickup and pinned workerd execution. Initial broken root Graphile import was not credited as Red; owning workspace resolution fixed before observing the actual queued-state assertion failure. Worker validation reuses the contracts package, avoiding an undeclared runtime dependency.
- refactor: explicit production NODE_ENV in sanitized executor child environment resolves Next's ProcessEnv typing while exposing no operator environment.
- commit: uncommitted.

## Cycle U78: U78 generic HMAC template rejects altered raw bytes

- test: `tests/integration/ingress.test.ts::U78 generic HMAC template rejects altered raw bytes`
- red: `bun run test:file tests/integration/ingress.test.ts --name U78 generic HMAC template rejects altered raw bytes` -> `valid HMAC must accept exact bytes`; actual exit 1.
- green: smallest production change in `packages/script-sdk/src/templates/hmac.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 5 passed, 0 failed (15.28s); artifact `test-results/cycle-U78.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U251: U251 HTTP broker requires current signed execution authority

- test: `tests/integration/delivery.test.ts::U251 HTTP broker requires current signed execution authority`
- red: `bun run test:file tests/integration/delivery.test.ts --name U251 HTTP broker requires current signed execution authority` -> `valid live broker capability must send`; actual exit 1.
- green: smallest production change in `apps/worker/src/broker.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 4 passed, 0 failed (12.00s); artifact `test-results/cycle-U251.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle A7: A7 public HTTP acknowledges only durable accepted work

- test: `tests/deployment/installation.test.ts::A7 public HTTP acknowledges only durable accepted work`
- red: `bun run test:file tests/deployment/installation.test.ts --name A7 public HTTP acknowledges only durable accepted work` -> `public ingress must acknowledge durable work`; actual exit 1.
- green: smallest production change in `packages/domain/src/ingress-http.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 5 passed, 0 failed (91.20s); artifact `test-results/cycle-A7.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U252: U252 direct fetch preserves a large binary request body

- test: `tests/executor/isolation.test.ts::U252 direct fetch preserves a large binary request body`
- red: `bun run test:file tests/executor/isolation.test.ts --name U252 direct fetch preserves a large binary request body` -> `execution_error`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 15 passed, 0 failed (22.35s); artifact `test-results/cycle-U252.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U253: U253 restricted worker image delivers accepted bytes through isolated executor

- test: `tests/deployment/images.test.ts::U253 restricted worker image delivers accepted bytes through isolated executor`
- red: `bun run test:file tests/deployment/images.test.ts --name U253 restricted worker image delivers accepted bytes through isolated executor` -> `worker image must complete real destination delivery`; actual exit 1.
- green: smallest production change in `apps/worker/src/main.ts`; `bun run test:file tests/deployment/images.test.ts` -> 2 passed, 0 failed (28.52s); artifact `test-results/cycle-U253.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U87: U87 exactly one MiB raw event is accepted intact

- test: `tests/integration/ingress.test.ts::U87 exactly one MiB raw event is accepted intact`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/ingress.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U87 exactly one MiB raw event is accepted intact` -> `Request body exceeds the configured limit` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 6 passed, 0 failed; artifact `test-results/cycle-U87.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U88: U88 oversized raw event is rejected before accepted work

- test: `tests/integration/ingress.test.ts::U88 oversized raw event is rejected before accepted work`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/ingress.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U88 oversized raw event is rejected before accepted work` -> `oversized request reached executor` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 7 passed, 0 failed; artifact `test-results/cycle-U88.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U254: U254 first destination is default and explicit switch is atomic

- test: `tests/integration/delivery.test.ts::U254 first destination is default and explicit switch is atomic`
- red: `bun run test:file tests/integration/delivery.test.ts --name U254 first destination is default and explicit switch is atomic` -> `first destination must become default`; actual exit 1.
- green: smallest production change in `packages/domain/src/destinations.ts`, `packages/domain/migrations/0006_destination_defaults.sql`, `packages/domain/src/schema.ts`, `packages/domain/src/publication.ts`, `packages/domain/src/delivery.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 5 passed, 0 failed (12.58s); artifact `test-results/cycle-U254.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U255: U255 pinned explicit default wins over legacy default name

- test: `tests/integration/delivery.test.ts::U255 pinned explicit default wins over legacy default name`
- red: `bun run test:file tests/integration/delivery.test.ts --name U255 pinned explicit default wins over legacy default name` -> `published default must determine routing`; actual exit 1.
- green: smallest production change in `packages/domain/src/delivery.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 6 passed, 0 failed (15.76s); artifact `test-results/cycle-U255.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U256: U256 stale destination editor cannot overwrite saved target

- test: `tests/integration/delivery.test.ts::U256 stale destination editor cannot overwrite saved target`
- red: `bun run test:file tests/integration/delivery.test.ts --name U256 stale destination editor cannot overwrite saved target` -> `Destination update unavailable`; actual exit 1.
- green: smallest production change in `packages/domain/src/destinations.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 7 passed, 0 failed (14.07s); artifact `test-results/cycle-U256.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U97: U97 non-success HTTP response remains a failed recorded attempt

- test: `tests/integration/delivery.test.ts::U97 non-success HTTP response remains a failed recorded attempt`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/delivery.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U97 non-success HTTP response remains a failed recorded attempt` -> `non-2xx must be a failed send` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 8 passed, 0 failed; artifact `test-results/cycle-U97.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U103: U103 managed destination redirect is recorded without following it

- test: `tests/integration/delivery.test.ts::U103 managed destination redirect is recorded without following it`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/delivery.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U103 managed destination redirect is recorded without following it` -> `managed redirects must not be followed` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 9 passed, 0 failed; artifact `test-results/cycle-U103.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U101: U101 retrying failed operation creates another retained attempt

- test: `tests/integration/delivery.test.ts::U101 retrying failed operation creates another retained attempt`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/delivery.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U101 retrying failed operation creates another retained attempt` -> `failed operation needs a new attempt` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 10 passed, 0 failed; artifact `test-results/cycle-U101.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U257: U257 sixth default execution attempt cannot be claimed

- test: `tests/integration/recovery.test.ts::U257 sixth default execution attempt cannot be claimed`
- red: `bun run test:file tests/integration/recovery.test.ts --name U257 sixth default execution attempt cannot be claimed` -> `exhausted execution must not acquire sixth attempt`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`, `packages/domain/migrations/0007_execution_attempt_limit.sql`, `packages/domain/src/ingress.ts`, `apps/web/src/app/ingress/[key]/route.ts`, `packages/domain/src/schema.ts`, `apps/worker/src/tasks/process-event.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 21 passed, 0 failed (36.48s); artifact `test-results/cycle-U257.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U258: U258 quoted and multiline secrets are redacted from structured logs

- test: `tests/executor/isolation.test.ts::U258 quoted and multiline secrets are redacted from structured logs`
- red: `bun run test:file tests/executor/isolation.test.ts --name U258 quoted and multiline secrets are redacted from structured logs` -> `structured logs must redact escaped secret values`; actual exit 1.
- green: smallest production change in `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/isolation.test.ts` -> 16 passed, 0 failed (32.62s); artifact `test-results/cycle-U258.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U259: U259 secret selector only returns authorized metadata

- test: `tests/integration/publication.test.ts::U259 secret selector only returns authorized metadata`
- red: `bun run test:file tests/integration/publication.test.ts --name U259 secret selector only returns authorized metadata` -> `selector must expose only authorized versions`; actual exit 1.
- green: smallest production change in `packages/domain/src/secrets.ts`; `bun run test:file tests/integration/publication.test.ts` -> 13 passed, 0 failed (20.59s); artifact `test-results/cycle-U259.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U260: U260 configuration API exposes scoped destinations and secret metadata

- test: `tests/deployment/installation.test.ts::U260 configuration API exposes scoped destinations and secret metadata`
- red: `bun run test:file tests/deployment/installation.test.ts --name U260 configuration API exposes scoped destinations and secret metadata` -> `destination configuration route must exist`; actual exit 1.
- green: `bun run test:file tests/deployment/installation.test.ts` -> 6 passed, 0 failed (91.46s), actual standalone Next plus Docker executor. Initial wrong fixture expiry type was setup failure, not Red. The real API check exposed project-token ancestor inspection returning 401; secret selectors now skip ancestors above token scope, preserving parent-secret isolation. Added explicit metadata response status assertion.
- refactor: none further needed.
- commit: uncommitted.

## Cycle U261: U261 project dashboard configures ingress route and destination

- test: `tests/acceptance/dashboard.spec.ts::U261 project dashboard configures ingress route and destination`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U261 project dashboard configures ingress route and destination` -> `Project detail must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/components/project-screen.tsx`, `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 6 passed, 0 failed (76.56s); artifact `test-results/cycle-U261.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U79: U79 explicitly unverified template accepts raw event without provider rules

- test: `tests/integration/ingress.test.ts::U79 explicitly unverified template accepts raw event without provider rules`
- red: `bun run test:file tests/integration/ingress.test.ts --name U79 explicitly unverified template accepts raw event without provider rules` -> `unverified template must explicitly accept raw event`; actual exit 1.
- green: smallest production change in `packages/script-sdk/src/templates/unverified.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 8 passed, 0 failed (17.75s); artifact `test-results/cycle-U79.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U262: U262 API client keeps publication diagnostic source positions

- test: `tests/integration/live-api.test.ts::U262 API client keeps publication diagnostic source positions`
- red: `bun run test:file tests/integration/live-api.test.ts --name U262 API client keeps publication diagnostic source positions` -> `editor must receive source-position diagnostics`; actual exit 1.
- green: smallest production change in `apps/web/src/app/lib/api-client.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 10 passed, 0 failed (0.34s); artifact `test-results/cycle-U262.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U263: U263 default processing template retries unsuccessful managed send

- test: `tests/integration/publication.test.ts::U263 default processing template retries unsuccessful managed send`
- red: `bun run test:file tests/integration/publication.test.ts --name U263 default processing template retries unsuccessful managed send` -> `default processing must request retry on failed send`; actual exit 1.
- green: smallest production change in `packages/script-sdk/src/templates/delivery.ts`; `bun run test:file tests/integration/publication.test.ts` -> 14 passed, 0 failed (19.23s); artifact `test-results/cycle-U263.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U80: U80 route editor separates ingress and processing bodies

- test: `tests/acceptance/dashboard.spec.ts::U80 route editor separates ingress and processing bodies`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U80 route editor separates ingress and processing bodies` -> `Separate lifecycle editor tabs must exist`; actual exit 1.
- green: `bun run test:file tests/acceptance/dashboard.spec.ts` -> 7 passed, 0 failed (browser 10.8s; full build/fixture 90.29s). Actual Monaco editors load through supported 0.57 exports with bundled local workers. Fixed new JSX syntax and obsolete package paths during Green; assertions unchanged. Declared the existing SDK workspace in web dependencies and refreshed Bun lockfile, without adding an external library.
- refactor: editor code is loaded on demand; lifecycle signatures remain platform-owned outside editable bodies.
- commit: uncommitted.

## Cycle U264: U264 crashed final attempt becomes terminal without another dispatch

- test: `tests/integration/recovery.test.ts::U264 crashed final attempt becomes terminal without another dispatch`
- red: `bun run test:file tests/integration/recovery.test.ts --name U264 crashed final attempt becomes terminal without another dispatch` -> `exhausted crashed execution must become terminal`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 22 passed, 0 failed (36.05s); artifact `test-results/cycle-U264.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U75: U75 copied template remains editable and leaves future copies unchanged

- test: `tests/acceptance/dashboard.spec.ts::U75 copied template remains editable and leaves future copies unchanged`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/web/src/app/components/script-editor.tsx` temporarily violated this invariant; `bun run test:file tests/acceptance/dashboard.spec.ts --name U75 copied template remains editable and leaves future copies unchanged` -> `New template copies must keep the original editable source` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/acceptance/dashboard.spec.ts` -> 8 passed, 0 failed; artifact `test-results/cycle-U75.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U265: U265 route editor binds an encrypted signing secret version

- test: `tests/acceptance/dashboard.spec.ts::U265 route editor binds an encrypted signing secret version`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U265 route editor binds an encrypted signing secret version` -> `Secret version controls must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/components/script-editor.tsx`, `apps/web/src/app/components/secret-bindings.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 9 passed, 0 failed (93.73s); artifact `test-results/cycle-U265.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U266: U266 ingress cannot read or persist platform session credentials

- test: `tests/integration/ingress.test.ts::U266 ingress cannot read or persist platform session credentials`
- red: `bun run test:file tests/integration/ingress.test.ts --name U266 ingress cannot read or persist platform session credentials` -> `platform session cookies must not reach configured scripts`; actual exit 1.
- green: smallest production change in `packages/domain/src/ingress.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 9 passed, 0 failed (17.93s); artifact `test-results/cycle-U266.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U267: U267 new route processing retries failed default delivery

- test: `tests/integration/publication.test.ts::U267 new route processing retries failed default delivery`
- red: `bun run test:file tests/integration/publication.test.ts --name U267 new route processing retries failed default delivery` -> `new routes must not mark failed delivery complete`; actual exit 1.
- green: smallest production change in `packages/domain/src/endpoints.ts`; `bun run test:file tests/integration/publication.test.ts` -> 15 passed, 0 failed (19.31s); artifact `test-results/cycle-U267.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U268: U268 provider response cannot set application cookies or transport headers

- test: `tests/unit/contracts.test.ts::U268 provider response cannot set application cookies or transport headers`
- red: `bun run test:file tests/unit/contracts.test.ts --name U268 provider response cannot set application cookies or transport headers` -> `toThrow`; actual exit 1.
- green: smallest production change in `packages/contracts/src/lifecycle.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 21 passed, 0 failed (2.05s); artifact `test-results/cycle-U268.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior A10: A10 optional destination failure does not override authored success policy

- test: `tests/integration/delivery.test.ts::A10 optional destination failure does not override authored success policy`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/execution-lease.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name A10 optional destination failure does not override authored success policy` -> `optional failure must not override user policy` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 11 passed, 0 failed; artifact `test-results/cycle-A10.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U269: U269 paused delivery continues durable event acceptance without processing claim

- test: `tests/integration/ingress.test.ts::U269 paused delivery continues durable event acceptance without processing claim`
- red: `bun run test:file tests/integration/ingress.test.ts --name U269 paused delivery continues durable event acceptance without processing claim` -> `delivery must be paused`; actual exit 1.
- green: smallest production change in `packages/domain/src/endpoints.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 10 passed, 0 failed (17.88s); artifact `test-results/cycle-U269.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U270: U270 resume replaces unclaimed paused offer without waiting for deadline

- test: `tests/integration/ingress.test.ts::U270 resume replaces unclaimed paused offer without waiting for deadline`
- red: `bun run test:file tests/integration/ingress.test.ts --name U270 resume replaces unclaimed paused offer without waiting for deadline` -> `resume must replace queued offer promptly`; actual exit 1.
- green: smallest production change in `packages/domain/src/endpoints.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 11 passed, 0 failed (18.69s); artifact `test-results/cycle-U270.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U115: U115 raw event payload requires distinct payload permission

- test: `tests/integration/ingress.test.ts::U115 raw event payload requires distinct payload permission`
- red: `bun run test:file tests/integration/ingress.test.ts --name U115 raw event payload requires distinct payload permission` -> `Missing expected rejection`; actual exit 1.
- green: smallest production change in `packages/domain/src/events.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 12 passed, 0 failed (19.49s); artifact `test-results/cycle-U115.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U118: U118 event inspection defaults to fifty records and preserves cursor precision

- test: `tests/integration/ingress.test.ts::U118 event inspection defaults to fifty records and preserves cursor precision`
- red: `bun run test:file tests/integration/ingress.test.ts --name U118 event inspection defaults to fifty records and preserves cursor precision` -> `event list must default to fifty`; actual exit 1.
- green: smallest production change in `packages/domain/src/events.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 13 passed, 0 failed (19.58s); artifact `test-results/cycle-U118.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U117: U117 inspection distinguishes delivery attempt failure from handler completion

- test: `tests/integration/delivery.test.ts::U117 inspection distinguishes delivery attempt failure from handler completion`
- red: `bun run test:file tests/integration/delivery.test.ts --name U117 inspection distinguishes delivery attempt failure from handler completion` -> `inspection must include handler history`; actual exit 1.
- green: smallest production change in `packages/domain/src/events.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 12 passed, 0 failed (15.40s); artifact `test-results/cycle-U117.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U143: U143 failed event replay creates separate durable execution history

- test: `tests/integration/delivery.test.ts::U143 failed event replay creates separate durable execution history`
- red: `bun run test:file tests/integration/delivery.test.ts --name U143 failed event replay creates separate durable execution history` -> `replay must create new execution identity`; actual exit 1.
- green: smallest production change in `packages/domain/src/replay.ts`; `bun run test:file tests/integration/delivery.test.ts` -> 13 passed, 0 failed (15.93s); artifact `test-results/cycle-U143.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U119: U119 event inspection accepts a two-hundred record page

- test: `tests/integration/ingress.test.ts::U119 event inspection accepts a two-hundred record page`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/events.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U119 event inspection accepts a two-hundred record page` -> `two-hundred limit must remain available` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 14 passed, 0 failed; artifact `test-results/cycle-U119.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U120: U120 event inspection refuses a limit above two hundred

- test: `tests/integration/ingress.test.ts::U120 event inspection refuses a limit above two hundred`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/events.ts` temporarily violated this invariant; `bun run test:file tests/integration/ingress.test.ts --name U120 event inspection refuses a limit above two hundred` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/ingress.test.ts` -> 15 passed, 0 failed; artifact `test-results/cycle-U120.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U145: U145 replay idempotency rejects changed policy under the same key

- test: `tests/integration/delivery.test.ts::U145 replay idempotency rejects changed policy under the same key`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/replay.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U145 replay idempotency rejects changed policy under the same key` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 14 passed, 0 failed; artifact `test-results/cycle-U145.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U146: U146 replay keeps original publication after active version changes

- test: `tests/integration/delivery.test.ts::U146 replay keeps original publication after active version changes`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/replay.ts` temporarily violated this invariant; `bun run test:file tests/integration/delivery.test.ts --name U146 replay keeps original publication after active version changes` -> `default replay must retain original publication` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/delivery.test.ts` -> 15 passed, 0 failed; artifact `test-results/cycle-U146.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U271: U271 event API separates metadata payload and replay privileges

- test: `tests/deployment/installation.test.ts::U271 event API separates metadata payload and replay privileges`
- red: `bun run test:file tests/deployment/installation.test.ts --name U271 event API separates metadata payload and replay privileges` -> `event inspection API must exist`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/projects/[projectId]/events/route.ts`, `apps/web/src/app/api/v1/events/[eventId]/route.ts`, `apps/web/src/app/api/v1/events/[eventId]/payload/route.ts`, `apps/web/src/app/api/v1/events/[eventId]/replay/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 7 passed, 0 failed (112.75s); artifact `test-results/cycle-U271.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U116: U116 event inspector displays HTML payload as escaped text

- test: `tests/acceptance/dashboard.spec.ts::U116 event inspector displays HTML payload as escaped text`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U116 event inspector displays HTML payload as escaped text` -> `Event inspection screen must exist`; actual exit 1.
- green: smallest production change in `apps/web/src/app/components/event-screen.tsx`, `apps/web/src/app/(dashboard)/projects/[projectId]/events/page.tsx`, `apps/web/src/app/lib/api-client.ts`, `apps/web/src/app/components/project-screen.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 10 passed, 0 failed (104.53s); artifact `test-results/cycle-U116.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U272: U272 durable changes serialize cursor allocation until prior commit

- test: `tests/integration/live-api.test.ts::U272 durable changes serialize cursor allocation until prior commit`
- red: `bun run test:file tests/integration/live-api.test.ts --name U272 durable changes serialize cursor allocation until prior commit` -> `durable change cursor must be allocated`; actual exit 1.
- green: smallest production change in `packages/domain/src/changes.ts`, `packages/domain/migrations/0008_ordered_changes.sql`; `bun run test:file tests/integration/live-api.test.ts` -> 11 passed, 0 failed (11.38s); artifact `test-results/cycle-U272.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U273: U273 acceptance includes durable change without private payload

- test: `tests/integration/ingress.test.ts::U273 acceptance includes durable change without private payload`
- red: `bun run test:file tests/integration/ingress.test.ts --name U273 acceptance includes durable change without private payload` -> `accepted event must include durable live change`; actual exit 1.
- green: smallest production change in `packages/domain/src/ingress.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 16 passed, 0 failed (21.09s); artifact `test-results/cycle-U273.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U274: U274 live backfill excludes unrelated scope and private data

- test: `tests/integration/live-api.test.ts::U274 live backfill excludes unrelated scope and private data`
- red: `bun run test:file tests/integration/live-api.test.ts --name U274 live backfill excludes unrelated scope and private data` -> `authorized live backfill must be available`; actual exit 1.
- green: smallest production change in `packages/domain/src/live.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 12 passed, 0 failed (15.57s); artifact `test-results/cycle-U274.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U149: U149 authenticated SSE reconnect backfills then follows committed changes

- test: `tests/integration/live-api.test.ts::U149 authenticated SSE reconnect backfills then follows committed changes`
- red: `bun run test:file tests/integration/live-api.test.ts --name U149 authenticated SSE reconnect backfills then follows committed changes` -> `authorized SSE response must be available`; actual exit 1.
- green: smallest production change in `packages/domain/src/live.ts`; `bun run test:file tests/integration/live-api.test.ts` -> 13 passed, 0 failed (15.42s); artifact `test-results/cycle-U149.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U151: U151 revoked permissions close existing stream

- test: `tests/integration/live-api.test.ts::U151 revoked permissions close existing stream`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/live.ts` temporarily violated this invariant; `bun run test:file tests/integration/live-api.test.ts --name U151 revoked permissions close existing stream` -> `revoked stream must close promptly` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/live-api.test.ts` -> 14 passed, 0 failed; artifact `test-results/cycle-U151.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U153: U153 live stream emits fifteen second heartbeat

- test: `tests/integration/live-api.test.ts::U153 live stream emits fifteen second heartbeat`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/live.ts` temporarily violated this invariant; `bun run test:file tests/integration/live-api.test.ts --name U153 live stream emits fifteen second heartbeat` -> `fifteen second heartbeat must be emitted` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/live-api.test.ts` -> 15 passed, 0 failed; artifact `test-results/cycle-U153.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U275: U275 stored event appears through authenticated live updates

- test: `tests/acceptance/dashboard.spec.ts::U275 stored event appears through authenticated live updates`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U275 stored event appears through authenticated live updates` -> `Committed events must appear without manual refresh`; actual exit 1.

- U275 Green continuation: initial owning-suite build rejected a BigInt literal under the web target. Replaced the literal with equivalent `BigInt(string)`; no test or cursor policy changed. `bun run test:file tests/acceptance/dashboard.spec.ts` passed all 11 tests, 0 failed; artifact `test-results/cycle-U275.txt`.
- Refactor verification: ordered change emission in execution lease/recovery uses the shared append service after domain mutations, preserving transaction order; owning recovery suite passed 22 tests (recorded artifact `test-results/cycle-U264.txt`).

## Cycle U150: U150 expired cursor requests authorized HTTP resync

- test: `tests/integration/live-api.test.ts::U150 expired cursor requests authorized HTTP resync`
- red: `bun run test:file tests/integration/live-api.test.ts --name U150 expired cursor requests authorized HTTP resync` -> `expired cursor must request resync`; actual exit 1.

- U150 Green continuation: corrected SQL quoting in the retained-window filter. `bun run test:file tests/integration/live-api.test.ts` passed 16 tests, 0 failed; artifact `test-results/cycle-U150.txt`. No tests or limits changed. Retained backfill window is 24 hours; expired nonzero cursor requests an authorized HTTP resync.

## Covered behavior U152: U152 slow SSE consumer is disconnected at bounded output

- test: `tests/integration/live-api.test.ts::U152 slow SSE consumer is disconnected at bounded output`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/live.ts` temporarily violated this invariant; `bun run test:file tests/integration/live-api.test.ts --name U152 slow SSE consumer is disconnected at bounded output` -> `slow consumer must be disconnected` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/live-api.test.ts` -> 17 passed, 0 failed; artifact `test-results/cycle-U152.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U169: U169 active condition reconciles one durable incident

- test: `tests/integration/notifications.test.ts::U169 active condition reconciles one durable incident`
- red: `bun run test:file tests/integration/notifications.test.ts --name U169 active condition reconciles one durable incident` -> `runtime condition must create durable incident`; actual exit 1.
- green: smallest production change in `packages/domain/src/notifications.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 1 passed, 0 failed (11.42s); artifact `test-results/cycle-U169.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U172: U172 per user dismissal survives condition reconciliation

- test: `tests/integration/notifications.test.ts::U172 per user dismissal survives condition reconciliation`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/notifications.ts` temporarily violated this invariant; `bun run test:file tests/integration/notifications.test.ts --name U172 per user dismissal survives condition reconciliation` -> `dismissed notice must stay hidden` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/notifications.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U172.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U173: U173 runsc configuration resolves advice without host attestation

- test: `tests/integration/notifications.test.ts::U173 runsc configuration resolves advice without host attestation`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/notifications.ts` temporarily violated this invariant; `bun run test:file tests/integration/notifications.test.ts --name U173 runsc configuration resolves advice without host attestation` -> `runsc mode must resolve ordinary Docker advice` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/notifications.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U173.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U171: U171 project administrator cannot inspect instance runtime advice

- test: `tests/integration/notifications.test.ts::U171 project administrator cannot inspect instance runtime advice`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/notifications.ts` temporarily violated this invariant; `bun run test:file tests/integration/notifications.test.ts --name U171 project administrator cannot inspect instance runtime advice` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/notifications.test.ts` -> 4 passed, 0 failed; artifact `test-results/cycle-U171.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U276: U276 administrator opens and personally dismisses runtime advice

- test: `tests/acceptance/dashboard.spec.ts::U276 administrator opens and personally dismisses runtime advice`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U276 administrator opens and personally dismisses runtime advice` -> `Notification inbox must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/notifications/route.ts`, `apps/web/src/app/api/v1/notifications/[incidentId]/dismiss/route.ts`, `apps/web/src/app/components/dashboard-shell.tsx`, `apps/web/src/app/components/notification-inbox.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 12 passed, 0 failed (120.34s); artifact `test-results/cycle-U276.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U278: U278 Drizzle source recreates complete usable domain schema

- test: `tests/integration/database.test.ts::U278 Drizzle source recreates complete usable domain schema`
- red: `bun run test:file tests/integration/database.test.ts --name U278 Drizzle source recreates complete usable domain schema` -> `Drizzle schema must provide usable defaults and keys`; actual exit 1.
- green: smallest production change in `packages/domain/src/schema.ts`; `bun run test:file tests/integration/database.test.ts` -> 13 passed, 0 failed (17.17s); artifact `test-results/cycle-U278.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U279: U279 development bootstrap installs current source with no release artifacts

- test: `tests/integration/database.test.ts::U279 development bootstrap installs current source with no release artifacts`
- red: `bun run test:file tests/integration/database.test.ts --name U279 development bootstrap installs current source with no release artifacts` -> `development source must install current tables`; actual exit 1.

- U279 Green continuation: repeated development preparation exposed non-idempotent enqueue/change function declarations. Replaced those declarations with CREATE OR REPLACE while preserving signatures, behavior and privileges. Full database owning suite passed 14 tests, 0 failed; artifact `test-results/cycle-U279.txt`. Historical upgrade fixtures are explicitly test-only; ordinary release files are CI-owned.
- User-directed source organization/formatting refactor: page-specific screens moved into client `page.tsx` files; reusable controls remain in components. Clipify Prettier tabs/JSX quote/width and editor settings adopted. ESLint findings fixed without disabling effect rules. Dashboard browser suite passed 12 tests (`test-results/format-browser.txt`); unit suite passed 39 tests (`test-results/format-unit.txt`); ESLint, TypeScript and format gates passed at that revision.

## Cycle U280: U280 migration generation belongs to master CI only

- test: `tests/unit/tooling.test.ts::U280 migration generation belongs to master CI only`
- red: `bun run test:file tests/unit/tooling.test.ts --name U280 migration generation belongs to master CI only` -> `local migration generation must be denied`; actual exit 1.
- green: smallest production change in `scripts/database/migration-policy.ts`; `bun run test:file tests/unit/tooling.test.ts` -> 15 passed, 0 failed (0.08s); artifact `test-results/cycle-U280.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U281: U281 db push installs developer schema without release generation

- test: `tests/integration/database.test.ts::U281 db push installs developer schema without release generation`
- red: `bun run test:file tests/integration/database.test.ts --name U281 db push installs developer schema without release generation` -> `db push must install current schema`; actual exit 1.
- green: smallest production change in `scripts/database/push.ts`, `packages/domain/drizzle.config.ts`; `bun run test:file tests/integration/database.test.ts` -> 15 passed, 0 failed (22.31s); artifact `test-results/cycle-U281.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U282: U282 missing release artifacts fail before any database connection

- test: `tests/integration/database.test.ts::U282 missing release artifacts fail before any database connection`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/migrate.ts` temporarily violated this invariant; `bun run test:file tests/integration/database.test.ts --name U282 missing release artifacts fail before any database connection` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/database.test.ts` -> 16 passed, 0 failed; artifact `test-results/cycle-U282.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U283: U283 OTP selector matches new recipient mail despite stale index count

- test: `tests/unit/tooling.test.ts::U283 OTP selector matches new recipient mail despite stale index count`
- red: `bun run test:file tests/unit/tooling.test.ts --name U283 OTP selector matches new recipient mail despite stale index count` -> `OTP selector must follow intended recipient`; actual exit 1.
- green: smallest production change in `tests/helpers/mail-selection.ts`, `tests/helpers/browser-auth.ts`; `bun run test:file tests/unit/tooling.test.ts` -> 16 passed, 0 failed (0.08s); artifact `test-results/cycle-U283.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U127: U127 shared code copy preserves origin and edits create local immutable version

- test: `tests/integration/publication.test.ts::U127 shared code copy preserves origin and edits create local immutable version`
- red: `bun run test:file tests/integration/publication.test.ts --name U127 shared code copy preserves origin and edits create local immutable version` -> `shared module version must be created`; actual exit 1.
- green: smallest production change in `packages/domain/src/shared-code.ts`; `bun run test:file tests/integration/publication.test.ts` -> 16 passed, 0 failed (22.76s); artifact `test-results/cycle-U127.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U284: U284 middleware continuation accepts only stage appropriate mutable fields

- test: `tests/unit/contracts.test.ts::U284 middleware continuation accepts only stage appropriate mutable fields`
- red: `bun run test:file tests/unit/contracts.test.ts --name U284 middleware continuation accepts only stage appropriate mutable fields` -> `middleware continuation must be valid`; actual exit 1.
- green: smallest production change in `packages/contracts/src/lifecycle.ts`, `packages/script-sdk/src/lifecycle.ts`, `packages/script-sdk/src/declarations.generated.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 22 passed, 0 failed (1.85s); artifact `test-results/cycle-U284.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U128: U128 project shared code editor cannot create a parent scope revision

- test: `tests/integration/publication.test.ts::U128 project shared code editor cannot create a parent scope revision`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/shared-code.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U128 project shared code editor cannot create a parent scope revision` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 17 passed, 0 failed; artifact `test-results/cycle-U128.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U285: U285 pinned middleware executes hierarchy then scope order before handler

- test: `tests/integration/middleware.test.ts::U285 pinned middleware executes hierarchy then scope order before handler`
- red: `bun run test:file tests/integration/middleware.test.ts --name U285 pinned middleware executes hierarchy then scope order before handler` -> `middleware hierarchy must precede main handler`; actual exit 1.
- green: smallest production change in `packages/domain/src/pipeline.ts`; `bun run test:file tests/integration/middleware.test.ts` -> 1 passed, 0 failed (0.36s); artifact `test-results/cycle-U285.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U122: U122 optional invalid middleware patch preserves last valid context

- test: `tests/integration/middleware.test.ts::U122 optional invalid middleware patch preserves last valid context`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/pipeline.ts` temporarily violated this invariant; `bun run test:file tests/integration/middleware.test.ts --name U122 optional invalid middleware patch preserves last valid context` -> `invalid optional middleware must preserve previous context` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/middleware.test.ts` -> 2 passed, 0 failed; artifact `test-results/cycle-U122.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U123: U123 required ingress middleware failure returns rejection without main handler

- test: `tests/integration/middleware.test.ts::U123 required ingress middleware failure returns rejection without main handler`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/pipeline.ts` temporarily violated this invariant; `bun run test:file tests/integration/middleware.test.ts --name U123 required ingress middleware failure returns rejection without main handler` -> `required ingress failure must reject` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/middleware.test.ts` -> 3 passed, 0 failed; artifact `test-results/cycle-U123.txt`.
- refactor: none needed.
- commit: uncommitted.

## Covered behavior U124: U124 required processing middleware failure follows retry or fail configuration

- test: `tests/integration/middleware.test.ts::U124 required processing middleware failure follows retry or fail configuration`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/pipeline.ts` temporarily violated this invariant; `bun run test:file tests/integration/middleware.test.ts --name U124 required processing middleware failure follows retry or fail configuration` -> `configured required processing action must apply` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/middleware.test.ts` -> 4 passed, 0 failed; artifact `test-results/cycle-U124.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U286: U286 typed middleware continuation runs in real workerd

- test: `tests/executor/compiler.test.ts::U286 typed middleware continuation runs in real workerd`
- red: `bun run test:file tests/executor/compiler.test.ts --name U286 typed middleware continuation runs in real workerd` -> `ctx.continue helper must compile`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`, `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 5 passed, 0 failed (19.16s); artifact `test-results/cycle-U286.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U287: U287 shared source cannot dynamically import an unregistered runtime module

- test: `tests/executor/compiler.test.ts::U287 shared source cannot dynamically import an unregistered runtime module`
- red: `bun run test:file tests/executor/compiler.test.ts --name U287 shared source cannot dynamically import an unregistered runtime module` -> `shared dynamic import must be rejected`; actual exit 1.
- green: smallest production change in `apps/executor/src/compiler.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 6 passed, 0 failed (19.11s); artifact `test-results/cycle-U287.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U121: U121 publication pins middleware in hierarchy order and executes it before handler

- test: `tests/integration/middleware.test.ts::U121 publication pins middleware in hierarchy order and executes it before handler`
- red: `bun run test:file tests/integration/middleware.test.ts --name U121 publication pins middleware in hierarchy order and executes it before handler` -> `publication must include middleware snapshot`; actual exit 1.
- green: smallest production change in `packages/domain/src/middleware.ts`, `packages/domain/src/schema.ts`, `packages/domain/src/publication.ts`; `bun run test:file tests/integration/middleware.test.ts` -> 5 passed, 0 failed (15.13s); artifact `test-results/cycle-U121.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U125: U125 a non-overridable parent binding blocks child replacement

- test: `tests/integration/middleware.test.ts::U125 a non-overridable parent binding blocks child replacement`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `packages/domain/src/middleware.ts` temporarily violated this invariant; `bun run test:file tests/integration/middleware.test.ts --name U125 a non-overridable parent binding blocks child replacement` -> `Missing expected rejection` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/middleware.test.ts` -> 6 passed, 0 failed; artifact `test-results/cycle-U125.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U288: U288 actual ingress and worker execute their pinned middleware stages

- test: `tests/integration/middleware.test.ts::U288 actual ingress and worker execute their pinned middleware stages`
- red: `bun run test:file tests/integration/middleware.test.ts --name U288 actual ingress and worker execute their pinned middleware stages` -> `ingress must execute pinned middleware`; actual exit 1.
- green: smallest production change in `packages/domain/src/pipeline.ts`, `packages/domain/src/ingress.ts`, `apps/worker/src/tasks/process-event.ts`; `bun run test:file tests/integration/middleware.test.ts` -> 7 passed, 0 failed (22.22s); artifact `test-results/cycle-U288.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U289: U289 middleware edit conflicts preserve publication pinned revision

- test: `tests/integration/middleware.test.ts::U289 middleware edit conflicts preserve publication pinned revision`
- red: `bun run test:file tests/integration/middleware.test.ts --name U289 middleware edit conflicts preserve publication pinned revision` -> `middleware edit must create new revision`; actual exit 1.
- green: smallest production change in `packages/domain/src/middleware.ts`; `bun run test:file tests/integration/middleware.test.ts` -> 8 passed, 0 failed (23.57s); artifact `test-results/cycle-U289.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U290: U290 real API manages scoped shared code and versioned middleware

- test: `tests/deployment/installation.test.ts::U290 real API manages scoped shared code and versioned middleware`
- red: `bun run test:file tests/deployment/installation.test.ts --name U290 real API manages scoped shared code and versioned middleware` -> `shared code API must be available`; actual exit 1.
- green: smallest production change in `packages/contracts/src/code.ts`, `apps/web/src/app/api/v1/shared-code/route.ts`, `apps/web/src/app/api/v1/shared-code/[revisionId]/route.ts`, `apps/web/src/app/api/v1/shared-code/[revisionId]/copy/route.ts`, `apps/web/src/app/api/v1/middleware/route.ts`, `apps/web/src/app/api/v1/middleware/[bindingId]/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 8 passed, 0 failed (138.35s); artifact `test-results/cycle-U290.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U291: U291 middleware patch does not invent omitted configuration defaults

- test: `tests/unit/contracts.test.ts::U291 middleware patch does not invent omitted configuration defaults`
- red: `bun run test:file tests/unit/contracts.test.ts --name U291 middleware patch does not invent omitted configuration defaults` -> `omitted binding maps must stay absent`; actual exit 1.
- green: smallest production change in `packages/contracts/src/code.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 23 passed, 0 failed (2.50s); artifact `test-results/cycle-U291.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U292: U292 project code page creates helper version and processing middleware

- test: `tests/acceptance/dashboard.spec.ts::U292 project code page creates helper version and processing middleware`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U292 project code page creates helper version and processing middleware` -> `Code management page must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/code/[scopeType]/[scopeId]/page.tsx`, `apps/web/src/app/components/dashboard-shell.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 13 passed, 0 failed (130.72s); artifact `test-results/cycle-U292.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U83: U83 route editor binds helper version and shows generated imports above body

- test: `tests/acceptance/dashboard.spec.ts::U83 route editor binds helper version and shows generated imports above body`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U83 route editor binds helper version and shows generated imports above body` -> `Shared helper controls must exist`; actual exit 1.

## Cycle U293: U293 project navigation opens scoped code management

- test: `tests/acceptance/dashboard.spec.ts::U293 project navigation opens scoped code management`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U293 project navigation opens scoped code management` -> `Project code navigation must exist`; actual exit 1.

## Cycle U294: U294 executor RPC preserves zero direct-fetch budget

- test: `tests/executor/compiler.test.ts::U294 executor RPC preserves zero direct-fetch budget`
- red: `bun run test:file tests/executor/compiler.test.ts --name U294 executor RPC preserves zero direct-fetch budget` -> `Zero fetch budget must reach the actual runtime`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 15 passed, 0 failed (137.18s); artifact `test-results/cycle-U293.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.
- green: smallest production change in `packages/domain/src/executor-client.ts`, `apps/executor/src/server.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 7 passed, 0 failed (21.64s); artifact `test-results/cycle-U294.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

- U83 corrected verification: route control uses existing `editable` permission, actual publication is awaited up to 20 seconds for compilation (not an ingress latency allowance). Named real browser test passed; owning dashboard file passed all 15 tests in U293, artifact `test-results/cycle-U293.txt`. Helper import preview and real published ingress response verified.

## Cycle U295: U295 merged middleware patch obeys aggregate limits

- test: `tests/integration/middleware.test.ts::U295 merged middleware patch obeys aggregate limits`
- red: `bun run test:file tests/integration/middleware.test.ts --name U295 merged middleware patch obeys aggregate limits` -> `Oversized merged patch must leave the previous context intact`; actual exit 1.
- green: smallest production change in `packages/domain/src/pipeline.ts`; `bun run test:file tests/integration/middleware.test.ts` -> 9 passed, 0 failed (22.49s); artifact `test-results/cycle-U295.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U296: U296 project member navigation uses project scope

- test: `tests/acceptance/dashboard.spec.ts::U296 project member navigation uses project scope`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U296 project member navigation uses project scope` -> `Project member page must exist`; actual exit 1.

## Cycle U297: U297 dry executor simulates managed delivery without network

- test: `tests/executor/compiler.test.ts::U297 dry executor simulates managed delivery without network`
- red: `bun run test:file tests/executor/compiler.test.ts --name U297 dry executor simulates managed delivery without network` -> `Dry managed sends must be simulated without a live broker`; actual exit 1.
- green: smallest production change in `packages/domain/src/executor-client.ts`, `apps/executor/src/server.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 8 passed, 0 failed (25.94s); artifact `test-results/cycle-U297.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.
- green: smallest production change in `apps/web/src/app/(dashboard)/projects/[projectId]/members/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 16 passed, 0 failed (148.42s); artifact `test-results/cycle-U296.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U76: U76 synthetic draft test performs no external effects

- test: `tests/integration/publication.test.ts::U76 synthetic draft test performs no external effects`
- red: `bun run test:file tests/integration/publication.test.ts --name U76 synthetic draft test performs no external effects` -> `Synthetic test service must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/script-testing.ts`; `bun run test:file tests/integration/publication.test.ts` -> 18 passed, 0 failed (24.77s); artifact `test-results/cycle-U76.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U298: U298 real API executes synthetic draft and denies missing test permission

- test: `tests/deployment/installation.test.ts::U298 real API executes synthetic draft and denies missing test permission`
- red: `bun run test:file tests/deployment/installation.test.ts --name U298 real API executes synthetic draft and denies missing test permission` -> `Synthetic test API must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/endpoints/[endpointId]/test/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 9 passed, 0 failed (148.29s); artifact `test-results/cycle-U298.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U299: U299 action feedback appears in toasts instead of inline boxes

- test: `tests/acceptance/dashboard.spec.ts::U299 action feedback appears in toasts instead of inline boxes`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U299 action feedback appears in toasts instead of inline boxes` -> `Save success must use a toast`; actual exit 1.

## Cycle U300: U300 route editor tests unsaved ingress with synthetic fixture

- test: `tests/acceptance/dashboard.spec.ts::U300 route editor tests unsaved ingress with synthetic fixture`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U300 route editor tests unsaved ingress with synthetic fixture` -> `Route editor synthetic test must exist`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/projects/[projectId]/routes/[endpointId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 18 passed, 0 failed (148.93s); artifact `test-results/cycle-U300.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

- U299 verification correction: removed empty JSX conditionals left by the feedback conversion. Browser assertions use the active accessible `alertdialog`, excluding hidden exit-animation nodes. ESLint and TypeScript passed after correction; complete dashboard suite passed all 18 cases in U300 (`test-results/cycle-U300.txt`), including error recovery, secret feedback, helper/middleware saves, and absence of inline success messages.

## Cycle U301: U301 code scope picker navigates workspace and project

- test: `tests/acceptance/dashboard.spec.ts::U301 code scope picker navigates workspace and project`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U301 code scope picker navigates workspace and project` -> `Code scope picker must exist`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/code/[scopeType]/[scopeId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 19 passed, 0 failed (149.27s); artifact `test-results/cycle-U301.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U302: U302 repeated saves show fresh dismissible toast feedback

- test: `tests/acceptance/dashboard.spec.ts::U302 repeated saves show fresh dismissible toast feedback`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U302 repeated saves show fresh dismissible toast feedback` -> `Repeated saves must show fresh toast feedback`; actual exit 1.

## Cycle U170: U170 opt-in threshold counts failed operations rather than retries

- test: `tests/integration/notifications.test.ts::U170 opt-in threshold counts failed operations rather than retries`
- red: `bun run test:file tests/integration/notifications.test.ts --name U170 opt-in threshold counts failed operations rather than retries` -> `Opt-in failure evaluator must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/notification-rules.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 5 passed, 0 failed (14.44s); artifact `test-results/cycle-U170.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

- Behavior identifier correction: the new opt-in distinct-operation threshold slice was accidentally recorded as U170. Its correct existing requirement identifier is U178; U170 (resolved historical incidents) is restored to pending. Original Red/Green artifact `cycle-U170.txt` remains historical evidence; the renamed owning test is rerun under U178.

- U178 corrected owning verification: `bun run test:file tests/integration/notifications.test.ts` passed all 5 cases after identifier correction. No production code changed in that correction.

## Cycle U170: U170 disabled rules resolve incidents without deleting history

- test: `tests/integration/notifications.test.ts::U170 disabled rules resolve incidents without deleting history`
- red: `bun run test:file tests/integration/notifications.test.ts --name U170 disabled rules resolve incidents without deleting history` -> `Versioned rule updates must exist`; actual exit 1.
- green: smallest production change in `packages/domain/src/notification-rules.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 6 passed, 0 failed (14.24s); artifact `test-results/cycle-U170.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U131: U131 inherited middleware shows provenance and copies a local override

- test: `tests/acceptance/dashboard.spec.ts::U131 inherited middleware shows provenance and copies a local override`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U131 inherited middleware shows provenance and copies a local override` -> `Inherited scope must be visible`; actual exit 1.

## Cycle U303: U303 publication enforces shared dependency limits before activation

- test: `tests/integration/publication.test.ts::U303 publication enforces shared dependency limits before activation`
- red: `bun run test:file tests/integration/publication.test.ts --name U303 publication enforces shared dependency limits before activation` -> `Publication must enforce the shared dependency cap`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/code/[scopeType]/[scopeId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 21 passed, 0 failed (173.60s); artifact `test-results/cycle-U131.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.
- green: smallest production change in `packages/domain/src/publication.ts`; `bun run test:file tests/integration/publication.test.ts` -> 19 passed, 0 failed (26.78s); artifact `test-results/cycle-U303.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

- U302 corrected verification: repeated operations clear prior notice state so a fresh toast is emitted. HeroUI close buttons intentionally become interactive on hover; the browser uses ordinary `hover()` followed by `click()`, without forcing. Retained HeroUI built-in toast layering (above overlay tokens), removing the temporary hard-coded z-index override. Named case passed, then the complete owning 21-case dashboard suite passed in U131 (`test-results/cycle-U131.txt`).

## Cycle U304: U304 real API manages opt-in rules with scoped permission and versions

- test: `tests/deployment/installation.test.ts::U304 real API manages opt-in rules with scoped permission and versions`
- red: `bun run test:file tests/deployment/installation.test.ts --name U304 real API manages opt-in rules with scoped permission and versions` -> `Notification rule API must exist`; actual exit 1.

## Cycle U174: U174 trusted notification producer fires at the first matching failure

- test: `tests/integration/notifications.test.ts::U174 trusted notification producer fires at the first matching failure`
- red: `bun run test:file tests/integration/notifications.test.ts --name U174 trusted notification producer fires at the first matching failure` -> `Trusted notification producer must exist`; actual exit 1.
- green: smallest production change in `apps/worker/src/notifications.ts`, `apps/worker/src/main.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 7 passed, 0 failed (15.07s); artifact `test-results/cycle-U174.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.
- green: smallest production change in `apps/web/src/app/api/v1/projects/[projectId]/notification-rules/route.ts`, `apps/web/src/app/api/v1/notification-rules/[ruleId]/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 10 passed, 0 failed (151.09s); artifact `test-results/cycle-U304.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U305: U305 project dashboard configures explicit route failure notifications

- test: `tests/acceptance/dashboard.spec.ts::U305 project dashboard configures explicit route failure notifications`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U305 project dashboard configures explicit route failure notifications` -> `Project notification configuration must be discoverable`; actual exit 1.

## Covered behavior U130: U130 queued events retain helper code after parent version changes

- test: `tests/integration/publication.test.ts::U130 queued events retain helper code after parent version changes`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/worker/src/tasks/process-event.ts` temporarily violated this invariant; `bun run test:file tests/integration/publication.test.ts --name U130 queued events retain helper code after parent version changes` -> `Parent module edits must not change queued execution behavior` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/publication.test.ts` -> 20 passed, 0 failed; artifact `test-results/cycle-U130.txt`.
- refactor: none needed.
- commit: uncommitted.

- U305 corrected verification: used HeroUI compound Checkbox control and clicked its visible label, asserting checked state without forced interaction (matching the existing permission editor). Named case passed; complete owning dashboard suite passed all 22 cases, with actual runner console copied to `test-results/cycle-U305-reverified.txt`. ESLint and TypeScript passed at this revision.

## Cycle U306: U306 real pause and resume APIs preserve scoped versions

- test: `tests/deployment/installation.test.ts::U306 real pause and resume APIs preserve scoped versions`
- red: `bun run test:file tests/deployment/installation.test.ts --name U306 real pause and resume APIs preserve scoped versions` -> `Pause API must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/api/v1/endpoints/[endpointId]/pause/route.ts`, `apps/web/src/app/api/v1/endpoints/[endpointId]/resume/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 11 passed, 0 failed (152.19s); artifact `test-results/cycle-U306.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U307: U307 route editor pauses and resumes delivery with versioned commands

- test: `tests/acceptance/dashboard.spec.ts::U307 route editor pauses and resumes delivery with versioned commands`
- red: `bun run test:file tests/acceptance/dashboard.spec.ts --name U307 route editor pauses and resumes delivery with versioned commands` -> `Delivery controls must be available`; actual exit 1.
- green: smallest production change in `apps/web/src/app/(dashboard)/projects/[projectId]/routes/[endpointId]/page.tsx`; `bun run test:file tests/acceptance/dashboard.spec.ts` -> 23 passed, 0 failed (163.91s); artifact `test-results/cycle-U307.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U308: U308 invalid native provider responses never commit accepted work

- test: `tests/integration/ingress.test.ts::U308 invalid native provider responses never commit accepted work`
- red: `bun run test:file tests/integration/ingress.test.ts --name U308 invalid native provider responses never commit accepted work` -> `Invalid provider response must be rejected before durable acceptance`; actual exit 1.
- green: smallest production change in `packages/contracts/src/provider-response.ts`, `packages/domain/src/ingress.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 17 passed, 0 failed (22.69s); artifact `test-results/cycle-U308.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U309: U309 executor wire budget preserves maximum escaped and binary bodies

- test: `tests/executor/compiler.test.ts::U309 executor wire budget preserves maximum escaped and binary bodies`
- red: `bun run test:file tests/executor/compiler.test.ts --name U309 executor wire budget preserves maximum escaped and binary bodies` -> `Maximum legal escaped bodies must pass the executor wire boundary`; actual exit 1.
- green: smallest production change in `packages/domain/src/executor-client.ts`, `apps/executor/src/server.ts`, `apps/executor/src/supervisor.ts`; `bun run test:file tests/executor/compiler.test.ts` -> 9 passed, 0 failed (28.48s); artifact `test-results/cycle-U309.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U310: U310 configuration cannot advertise unsupported alpha body or header limits

- test: `tests/unit/contracts.test.ts::U310 configuration cannot advertise unsupported alpha body or header limits`
- red: `bun run test:file tests/unit/contracts.test.ts --name U310 configuration cannot advertise unsupported alpha body or header limits` -> `Server configuration requires attention`; actual exit 1.

- U310 corrected owning verification: initial full-file run lacked the native esbuild process permissions and stopped its compiler service; no timeout thresholds were weakened. Reran the same owning file with the required process permissions: all 24 cases passed, actual console saved to `test-results/cycle-U310-reverified.txt`. Startup bounds now match alpha ABI support (1 MiB body, 16 KiB headers), and lower configured request limits remain supported.

## Cycle U311: U311 a resumed old job gets a fresh claim window

- test: `tests/integration/recovery.test.ts::U311 a resumed old job gets a fresh claim window`
- red: `bun run test:file tests/integration/recovery.test.ts --name U311 a resumed old job gets a fresh claim window` -> `Fresh offers must get a new claim window even when their due time is old`; actual exit 1.
- green: smallest production change in `packages/domain/src/execution-lease.ts`; `bun run test:file tests/integration/recovery.test.ts` -> 23 passed, 0 failed (37.82s); artifact `test-results/cycle-U311.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U142: U142 large resume batches remain bounded and recovery picks up the rest

- test: `tests/integration/ingress.test.ts::U142 large resume batches remain bounded and recovery picks up the rest`
- red: `bun run test:file tests/integration/ingress.test.ts --name U142 large resume batches remain bounded and recovery picks up the rest` -> `Resume must enqueue a bounded batch`; actual exit 1.
- green: smallest production change in `packages/domain/src/endpoints.ts`; `bun run test:file tests/integration/ingress.test.ts` -> 18 passed, 0 failed (25.95s); artifact `test-results/cycle-U142.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Structural refactor: centralized readability and app entry-point aliases

- Maintainer-approved formatting refactor; no new product behavior or test-first claim.
- ESLint now imports the shared `.github/tooling/eslint/base.mjs` preset; Prettier imports the shared `.github/tooling/prettier/base.mjs` preset. Source is proposed in `payloadbay/.github` PR #26; all central CI checks passed. Generic tooling is explicitly eligible; framework, alias and migration policy remains local.
- Separate declarations preserve normal React state destructuring. Named substantial props types, section spacing and multiline objects/types are enforced. Web imports use `@api`, `@lib`, `@components`, `@styles`, `@types`, `@contracts`, `@domain` and `@sdk`; direct Node runtimes retain workspace exports. The test runner loads the tooling tsconfig for direct app imports.
- `wire.ts` uses descriptive names and explicit tag dispatch without changing the transport tags or self-contained embedded runtime functions. Disposable HTTP fixtures are now covered by formatting and lint checks.
- Verified: `bun run lint`, `bun run typecheck`, `bun run format:check`, `git diff --check`; API owning suite 17 passed, dashboard owning suite 23 passed, executor/compiler owning suite 9 passed. Actual console artifacts are `/tmp/payloadbay-readability-api.txt`, `/tmp/payloadbay-readability-browser.txt`, and `/tmp/payloadbay-wire-refactor.txt`, with persistent test-run consoles under `test-results/`.
- Central tests: 23 synchronizer/tooling checks passed using a clean temporary install matching CI; 2 real pinned SpecKit source checks passed. Central PR #26 remains open; no live synchronization was triggered from its branch.
- Commit: only the focused central preset change was committed/pushed as `8e622c4`; product implementation remains uncommitted, preserving the pre-existing worktree.

## Cycle U312: U312 accepted metadata stays within the processing metadata budget

- test: `tests/unit/contracts.test.ts::U312 accepted metadata stays within the processing metadata budget`
- red: `bun run test:file tests/unit/contracts.test.ts --name U312 accepted metadata stays within the processing metadata budget` -> `toThrow`; actual exit 1.
- green: smallest production change in `packages/contracts/src/lifecycle.ts`; `bun run test:file tests/unit/contracts.test.ts` -> 25 passed, 0 failed (1.99s); artifact `test-results/cycle-U312.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U313: U313 SMTP subscriptions require current scoped notification access

- test: `tests/integration/notifications.test.ts::U313 SMTP subscriptions require current scoped notification access`
- red: `bun run test:file tests/integration/notifications.test.ts --name U313 SMTP subscriptions require current scoped notification access` -> `Notification subscription not implemented`; actual exit 1.
- green: smallest production change in `packages/contracts/src/notifications.ts`, `packages/domain/src/notification-subscriptions.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 8 passed, 0 failed (14.44s); artifact `test-results/cycle-U313.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U314: U314 active incident email dispatch is durable and deduplicated

- test: `tests/integration/notifications.test.ts::U314 active incident email dispatch is durable and deduplicated`
- red: `bun run test:file tests/integration/notifications.test.ts --name U314 active incident email dispatch is durable and deduplicated` -> `Notification dispatch not implemented`; actual exit 1.
- green: smallest production change in `packages/domain/src/notification-mail.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 9 passed, 0 failed (15.52s); artifact `test-results/cycle-U314.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U315: U315 opted-in authorized recipient receives an SMTP incident summary

- test: `tests/integration/notifications.test.ts::U315 opted-in authorized recipient receives an SMTP incident summary`
- red: `bun run test:file tests/integration/notifications.test.ts --name U315 opted-in authorized recipient receives an SMTP incident summary` -> `Notification mail must use the real SMTP worker path`; actual exit 1.
- green: smallest production change in `apps/worker/src/tasks/mail.ts`, `apps/worker/src/tasks/notification-mail.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 10 passed, 0 failed (14.95s); artifact `test-results/cycle-U315.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Covered behavior U179: U179 revoked access prevents already queued notification email

- test: `tests/integration/notifications.test.ts::U179 revoked access prevents already queued notification email`
- initial run: passed against foundation implementation; existing behavior, not a new test-first implementation claim.
- deliberate mutant: `apps/worker/src/tasks/notification-mail.ts` temporarily violated this invariant; `bun run test:file tests/integration/notifications.test.ts --name U179 revoked access prevents already queued notification email` -> `Revoked recipients must not receive queued email` (exit 1); original restored exactly.
- restored green: `bun run test:file tests/integration/notifications.test.ts` -> 11 passed, 0 failed; artifact `test-results/cycle-U179.txt`.
- refactor: none needed.
- commit: uncommitted.

## Cycle U316: U316 continuous failure producer queues opted-in SMTP notifications

- test: `tests/integration/notifications.test.ts::U316 continuous failure producer queues opted-in SMTP notifications`
- red: `bun run test:file tests/integration/notifications.test.ts --name U316 continuous failure producer queues opted-in SMTP notifications` -> `Continuous producer must dispatch the first configured failure through SMTP`; actual exit 1.
- green: smallest production change in `apps/worker/src/notifications.ts`, `apps/worker/src/main.ts`; `bun run test:file tests/integration/notifications.test.ts` -> 12 passed, 0 failed (15.81s); artifact `test-results/cycle-U316.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U317: U317 scoped readers manage only their own SMTP preferences through API

- test: `tests/deployment/installation.test.ts::U317 scoped readers manage only their own SMTP preferences through API`
- red: `bun run test:file tests/deployment/installation.test.ts --name U317 scoped readers manage only their own SMTP preferences through API` -> `Scoped readers must be able to inspect their own notification preferences`; actual exit 1.
- green: smallest production change in `packages/contracts/src/notifications.ts`, `packages/domain/src/notification-subscriptions.ts`, `apps/web/src/app/api/v1/projects/[projectId]/notification-subscriptions/route.ts`, `apps/web/src/app/api/v1/notification-rules/[ruleId]/subscription/route.ts`; `bun run test:file tests/deployment/installation.test.ts` -> 12 passed, 0 failed (159.58s); artifact `test-results/cycle-U317.txt`.
- refactor: none needed in this cycle.
- commit: uncommitted, preserving the known pre-existing worktree.

## Cycle U318: PR source-build preview stack

- Test: `tests/deployment/preview.test.ts::U318 PR preview builds branch services and initializes its own database`.
- Red: actual assertion `PR preview must provide a source-build Compose stack`; selected test failed before the Compose file existed.
- Green: owning file passed 1 test against the real Docker Compose parser, validating source builds, startup prerequisites, isolated database addressing, restricted executor and BuildKit credential reference.
- Broader verification: `tests/deployment/images.test.ts` passed 2 actual Docker tests, including managed HTTP delivery through the worker/executor. Its first run exposed an outdated disposable fixture calling the production migration entrypoint; corrected to the existing development schema helper. That setup failure is not credited as test-first behavior.
- Quality checks: ESLint, TypeScript and Prettier passed before publication; no release migration generated.
- Limit: the parser and image tests do not prove a clean licensed app build or a healthy remote Coolify PR deployment; those require the configured HeroUI build credential and a deployment run.

## Cycle U319: Clipify preview URL resolution

- Test: `tests/unit/contracts.test.ts::U319 base URL follows Clipify Coolify runtime precedence`.
- Red: current configuration selected `https://stale.example.test` instead of the configured Coolify runtime preview hostname.
- Implementation: shared domain base URL resolver adapted from Clipify `src/app/lib/baseUrl.ts`, with Payload Bay's explicit PUBLIC_URL override and local fallback. App and worker read the same resolver. Preview Compose passes Coolify runtime metadata; no request Host headers are trusted.
- Verification: the first whole-file run without required subprocess access timed out in unrelated esbuild compiler tests; rerun with the established execution permissions. This infrastructure failure is not a behavior Red.
- Green: owning contracts file 26 passed; preview Compose file 1 passed. ESLint, TypeScript and Prettier passed. The URL rules are locally verified; the remote preview is still blocked on failure-log access.

## Cycles U320–U322: disposable reviewer demo

- U320 Red: real PostgreSQL/Better Auth test hit the explicit not-implemented seed seam instead of the required preview-only guard. Green provisions one fixed synthetic reviewer, verified admission and owner grant, sample workspace/project/draft route, and a real queued OTP email; repeated seed does not duplicate records.
- U321 Red: actual Next.js login HTML lacked the disposable preview warning. Green uses request-time connection() in the root layout, renders the warning for runtime IS_PREVIEW=true and omits it otherwise. The fixture explicitly supplies runtime mode; the installed Next.js connection documentation was consulted.
- U322 Red: `Missing expected rejection` after a second owner was created and the seeded reviewer was demoted. Green rejects that instance grant change only in preview mode, preserving ordinary role behavior.
- Owning integration file: 3 passed, 0 failed. Authorization regression file: 11 passed, 0 failed. Real Docker Compose parser checks seeded startup, ephemeral PostgreSQL and authenticated Mailpit. Clean remote deployment and reset behavior are not claimed by these local runs.
- Preview reset configuration: force recreation; schema then guarded seed; PostgreSQL tmpfs. No release migration is generated or committed.
- Contributor guidance records synthetic identity, Mailpit, shared edits, data reset, test-only payloads and the public functional-review goal. Public hostile-publisher hardening remains unverified; gVisor alone is not an outbound network policy.
