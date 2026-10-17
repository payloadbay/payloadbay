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

## Maintainer dashboard review follow-up — 2026-10-15

This batch completes the maintainer's functional review, rather than only recording
an audit. Regression coverage was added alongside implementation; this is not a
claim that every new screen was implemented through a strict test-first cycle.

- Functional fixes: contextual route/workspace navigation, transparent login brand,
  padded OTP paste, horizontal Monaco source and SDK/helper resolution, retained
  template selection, formatted saves, unsaved-edit protection, bindings tables,
  actual published HTTP playground, aggregate/route events and scoped live updates.
- Access: pending invitation mail/accept/cancel with issuer reauthorization and
  verified recipient matching; instance admission remains separate from child
  grants. Member lists include inherited access. Actual Better Auth passkeys retain
  email-code recovery. WebAuthn browser fixtures use localhost, not an IP RP ID.
- Notifications: workspace and project rules share one editor and durable producer;
  personal SMTP subscriptions are separate and opt-in. Tests caught a missing
  Switch.Content composition and the playground's unassociated method label.
- A wider auth run caught the earlier base-URL trailing slash producing malformed
  double-slash paths/Origin values. Normalization now preserves the base contract;
  all 33 auth integration cases pass, including OTP expiry/attempt boundaries.
- Green: dashboard acceptance 26 passed (actual Next.js build, PostgreSQL, Mailpit,
  worker and workerd); mobile/editor regression checks 8 passed against the built
  app with controlled API responses; contracts 27 passed; live API 18 passed;
  notifications 13 passed; expanded U320 preview seed passed. The seed compiles and
  executes synthetic ingress, stores real receipts/jobs, and preserves edited
  routes on reruns. These are scoped checks, not the full alpha release suite.
- ESLint, TypeScript, Prettier and test inventory checks pass. Browser artifact
  paths now resolve under the intended root test-results directory, keeping traces
  out of source checks. Existing misplaced traces were preserved, not deleted.
- No release migration was generated. Source schema/auth initialization changes
  are exercised by disposable development fixtures; master CI owns release
  migration generation. Optional host runsc and final release gates are separate.


## Maintainer dashboard review follow-up — 2026-10-15

This pass combines source review and post-change regression tests; it does not
claim fabricated test-first Red cycles. General principles live in
`docs/ui-ux-rules.md`; individual acceptance findings live in `docs/ux-audit.md`.

- `bun run test:file tests/acceptance/dashboard.spec.ts`: 27 passed.
- `bun run test:file tests/acceptance/dashboard.spec.ts --name 'U261|U292|U116|U305|overview and mobile'`: 5 passed after final accessible dialog headings.
- `bun run test:file tests/acceptance/bootstrap.spec.ts`: 8 passed.
- `bun run test:file tests/integration/ingress.test.ts`: 20 passed, then the added handler-error-history scenario passed separately. Exact scoped overview totals, hidden-project isolation and per-attempt pagination are covered.
- `bun run test:file tests/integration/delivery.test.ts`: 15 passed.
- `bun run test:file tests/integration/live-api.test.ts`: 18 passed.
- `bun run test:file tests/unit/contracts.test.ts`: 27 passed.
- `bun run test:file tests/integration/preview.test.ts`: 3 passed, including runtime warning visibility and protection of the seeded reviewer identity.
- Final `bun run test:file tests/acceptance/dashboard.spec.ts --name "overview and mobile"`: 1 passed with the merged canonical non-padded header assets.

Lint/typecheck/format/inventory checks passed. Source code and fixtures use
Drizzle push; no release migration was generated. Six pre-existing Docker/build
workflow drafts remain excluded from this review commit. The full alpha release
gates remain open; these runs certify the scoped review only.


### Live preview and chart follow-up

Revision ffe8ff7 deployed successfully in Coolify. A real browser flow passed
Mailpit OTP, overview aggregates, fixed preview/header on scroll, seeded helpers,
320px layout, live SSE request history, accepted GET and response-only 405 PUT,
outgoing-attempt inspection, account settings and sign-out. The seed intentionally
exports GET and POST; the unsupported-method check correctly uses PUT.

Live visual inspection found that the custom SVG axis labels became too small
on mobile. Replaced that graph with existing HeroUI Pro LineChart, using the
already-installed Recharts peer, responsive tick spacing and tooltips. No new
dependency or one-use component was added. The focused overview/mobile browser
case passed with actual 12px axis text, readable rendered bounds and no page
width overflow at 320px; web typecheck, scoped ESLint/Prettier and diff check passed.


## Second mobile review — 2026-10-16

This is a regression/audit pass, not a fabricated test-first cycle.

- Ingress integration: 21 passed, including OR filters/empty pages and separate
  metadata/payload permissions for captured attempt bodies.
- Contracts: 27 passed.
- Six focused dashboard browser cases passed, covering stages, empty secret keys,
  captured-response inspection and multiple status selection, helper bindings,
  helper/middleware saves, global menu order and native page scrolling with a
  sticky header. The first inspector run caught an incorrect exact accessible
  label in the test; using the native Select's actual label passed.
- Mobile/editor/bootstrap: 8 passed. Final 390px inspector rerun also passed,
  including status OR selection, captured-response text and dialog bounds.
  ESLint/typecheck/Prettier passed.

The large scope-only navigation/search/native-import/reordering redesign remains
proposed pending the maintainer's requested review of the refreshed Coolify findings.
Real Android keyboard/toolbar transitions are not certified by viewport emulation.
No release migration or unrelated Docker/build draft was added to this pass.


## Scope-only navigation and native source imports — 2026-10-16

The maintainer corrected the prior deferral: the changes were already requested
and the confirmation was not received. Implemented the structural behavior rather
than adding another approval gate. This is a regression pass, not a fabricated
Red-first implementation.

- Publication integration: 21 passed. Added actual named/default helper execution
  with no prebinding form, preservation across a newer helper revision, unknown
  import rejection and out-of-project pin rejection. Strengthened native-source
  case rerun passed after adding the latter assertion.
- Middleware integration: 9 passed. Compiler/executor: 10 passed, including native
  processing imports and invalid lifecycle result/default-export rejection.
- Final six dashboard browser cases passed. They cover real Monaco module and
  exported-symbol completion, manual import/publish/HTTP execution, full source
  middleware save, separate stages, scoped code/members navigation and mobile
  menu/search/Back/viewport restoration. The first run found an exact accessible
  search-label mismatch; the result now has an explicit Jump to accessible name.
- Inspected the generated project-navigation-mobile.png: resource-only controls,
  task groups expanded, no duplicate hierarchy or global list, full viewport bounds.

The drawer follows visualViewport resize/scroll rather than retaining a keyboard
inline height. The resize regression is emulated, not physical Android evidence.
Broader middleware ordering/request-client presentation remains separately tracked.
No release migrations or unrelated Docker/build drafts are included.

Final mobile/editor/bootstrap rerun: 8 passed. ESLint, web/tooling TypeScript,
Prettier and diff checks passed. The old root-resource Browse hierarchy expectation
was updated to assert the requested instance-only list; route scope excludes
instance administration and exposes menu-only Back.

## Visible header search — 2026-10-16

Moved the command-palette launcher from the drawer into a visible header search
bar. It spans its own row on mobile and sits within the desktop header. Removed
the menu search entry. This is a scoped UI regression pass, not a fabricated Red
cycle: the registered overview/navigation browser flow passed with direct header
access at 320px and desktop, query clear, result navigation and no menu entry.
All eight mobile/editor/bootstrap cases also passed. Inspected the mobile overview
screenshot. ESLint, web/tooling TypeScript, Prettier and diff checks passed.


## Longer renewable browser sessions — 2026-10-16

Configured Better Auth for a 30-day session lifetime and daily renewal. Protected
API responses now forward Better Auth's renewed Set-Cookie headers, preserving
HTTP-only cookies and database-backed revocation. No JWT refresh subsystem was
added. The existing authentication regression now checks the initial lifetime,
renewal of both database expiry and browser cookie, no repeated renewal within
the daily window, and rejection after admission is disabled. This extends an
existing regression rather than claiming a test-first Red cycle.

All 33 authentication integration tests passed. Scoped ESLint and Prettier,
and web/tooling TypeScript checks passed. Preview database resets still invalidate
sessions; this is documented separately from session expiry.

## Review continuation and loading audit — 2026-10-16 (in progress)

The earlier search/session commits did not include the later helper/event review.
This continuation retains that work rather than treating those scoped pushes as
completion. Added shared centered accessible spinner states across startup,
pages, panels and Monaco's fixed-height loading overlay. Retried/error states
remain distinct, and the spinner respects reduced motion.

Publication integration: 21 passed before new picker coverage; added helper-picker
import/alias/deduplication/scope regression passed. Delivery integration: 16 passed;
a strengthened filtered-selection/bulk regression passed. Ingress/history: 21
passed. Atomic middleware ordering regression passed after correcting an audit
UUID/text parameter cast. Earlier browser failures found a missing HeroUI client
boundary and table checkbox composition/selection-context issue; corrected both.
The subsequent run passed event inspection, helper insertion plus native imports,
and current-scope creation. Middleware provenance/mobile breadcrumb expectations
were updated for the new table and compact parent navigation; final rerun pending.
No synthetic Red cycle is claimed. Release and physical-device gates remain open.

Live preview revision 0e0b686: real Mailpit login, traffic overview, 320px layout,
SSE, context navigation/search, native imports/publish/HTTP response and sign-out
passed in the full temporary browser smoke. An earlier run failed SMTP delivery,
and one earlier immediate-resize check saw transient overflow; both are recorded
rather than represented as successful checks. This smoke predates the new local
review batch and does not verify it.

Final local review verification: all 27 dashboard browser cases and all eight
bootstrap/mobile cases passed. The strengthened U116 then passed actual visible
checkbox selection → confirmation → bulk replay → new execution, plus select-all
matching filters. Its first added run targeted the visually hidden native input;
the corrected test clicks the visible HeroUI label and asserts the checked state.
This is not a forced click or bypass. The bulk dialog has an explicit accessible
name. Latest mobile inspector screenshot shows the shorter Inspect controls fit;
project screenshot shows the compact parent trail and visible header search.
All 23 publication integration cases passed, including import syntax preservation
and atomic reorder. ESLint, web/tooling TypeScript, Prettier and diff checks passed.
The six unrelated Docker/build-workflow drafts are excluded from this commit.
The next gate is pushing and verifying this exact review batch in Coolify.


Deployment verification: Coolify a4h4wqjgwuzhq0mxac79wxhd finished at 09:49:04 UTC
on exact commit 3b17ec4. Real preview passed SMTP/OTP, traffic/mobile chrome,
SSE request history, unified outgoing response inspection, helper modal insertion,
native import/publish/actual HTTP execution, scoped menus/search/Back/viewport
restore, account settings and sign-out. A separate held-request browser check
confirmed the centered HeroUI spinner and label; its subsequent cleanup hit a
temporary Playwright route-continuation error, not a product error. Existing
middleware integration suite: 9 passed. R01/R02 are verified; R03–R05 follow.

### Forkable notification modules: implementation in progress

- Added immutable instance channel versions, explicit activation/pause, copying the shipped email source, queue-time code/branding pins, Zod contracts and a typed workerd notification stage. The baseline email adapter remains trusted platform code; custom copies use workerd.
- Shared React Email wrapper now renders OTP, invitation and incident content with HTML/plain-text alternatives. A3's real SMTP test first failed on absent HTML, then passed after wiring the renderer.
- Notification integration suite: 16/16 passed after updating the expected encrypted payload to include its channel snapshot. New executor test verifies the typed email result and authentication-code log redaction.
- Real custom HTTP module test passed through the executor container and disposable HTTP receiver: delivery ID/attempt reached the receiver, success was persisted, pausing before a subsequent send prevented effects, and HTTP delivery did not also send email.
- Worker Docker image built successfully with the frozen workspace lock and renderer dependencies. Startup/runtime and browser flows remain under verification.

- Full authentication suite: 33 passed after shared-wrapper changes. Full compiler/executor suite: 11 passed, including notification results and auth-code log redaction. Custom subscription test passed: opt-in dispatch deduplicates by incident generation/recipient/channel, pins the immutable revision and permits unsubscribing from a paused module.
- Strengthened U253 passed with the actual built worker container: accepted event bytes were delivered and a queued notification rendered branded HTML plus plain text and arrived in Mailpit. No source mount or Node alias loader was required.
- The first notification browser pass caught a malformed compiler request in the draft-preview route (`source` instead of `body`). The corrected route uses the same structured body/sourceId/sharedModules request as publication. A rerun is required; earlier backend passes do not establish the UI flow.

- Corrected notification browser flow passed on a production Next build at 390px: shipped source → fork → effect-free preview → publish v1 → shared branding preview → choose fork for transactional messages → save → actual Mailpit delivery → reset while preserving the custom module. Full notification suite now passes 18/18; full dashboard regression is pending.

- Wider dashboard regression initially exposed fixture contamination: bulk replay intentionally leaves `process_event` jobs, but the browser fixture only executes `platform_job`. Its reset now removes only unclaimed, keyed `process_event` jobs through Graphile Worker's `remove_job`, then still waits for active/mail work before truncating the disposable case database. The complete rerun passed 28/28, including custom modules and existing notification preferences.
- Strengthened real custom-module retry passed: the first attempt creates queued generation 2 at notification priority 30, and the next attempt succeeds. Notification retries do not acquire OTP/invitation priority.

- Bootstrap/mobile run initially observed a transient 320px overflow immediately after changing the viewport while the responsive chart still had its old width. The assertion now polls for the ResizeObserver-driven layout to settle rather than reading the pre-resize layout synchronously; it still fails on persistent overflow. Rerun pending.

- Bootstrap/mobile rerun passed 8/8 with the responsive resize assertion. ESLint, web/tooling TypeScript, Prettier and diff checks passed. The notification follow-up is locally verified; exact-commit Coolify and live checks remain the R05 deployment gate.

### Notification preview deployment verification

- Pushed `e1a5aa48935cb8e1a81a951e4694e52abdf2030b`; Coolify deployment `w0drpgdywb0ttzajngzxnlcd` finished 2026-10-16 10:52:29 UTC. Baseline PR checks passed.
- Live 390px notification flow passed real HTML/plain-text OTP login, shipped module fork → synthetic dry test → publish v1 → transactional module/branding save → real Mailpit delivery → reset → personal notification settings. The email was visibly rendered inside the live page, not just in a frame-body capture.
- The preceding review smoke passed on the same commit: centered HeroUI startup spinner, six-slot real OTP sign-in, 320px overview, sticky preview notice, valid status filters, SSE GET/PUT ingress history, outgoing HTTP503 response inspection, scope-only menus/Back, search, native helper import/publish/HTTP execution, account settings and sign-out.
- R01–R05 are complete for this follow-up. Physical Android keyboard review, generated API-doc parity and the broader alpha release/installation/performance gates remain separate. Promoted the implemented notification document from proposals to contracts.

### Scoped preview reviewer accounts — 2026-10-16

- Added project-admin and project-viewer synthetic identities admitted without instance/workspace grants. Both are restricted to Demo integrations; an Admin-only example project allows comparison with the existing instance owner. Seeding is idempotent and remains unavailable outside disposable development previews.
- Preview login offers a Demo access selector, while every account still signs in through a normal expiring OTP delivered to Mailpit. No passwords or session-impersonation shortcut were added. CONTRIBUTING documents the accounts and shared-demo limitations.
- Project-only menu Back now selects the closest accessible ancestor rather than offering an inaccessible workspace.
- Preview integration: 3/3 passed, covering repeat seeding, project-only visibility/read/write permissions, preview-only controls and owner lockout protection. New browser flow passed real project-admin/viewer sign-in, scoped collection visibility, menu Back, denied instance settings, denied private-project access and denied viewer mutation.
- ESLint, web/tooling TypeScript and Prettier passed. Existing Docker/cache/migration-workflow drafts remain excluded. The hosted SaaS discussion is an assessment, not an enabled signup/billing feature or a runtime-policy change.
- Existing bootstrap/mobile regression also passed 8/8 after the account-selector change.

### OTP rotation found during live scoped-account verification

- Live project-admin/viewer sign-in and scope checks passed, but repeated code requests exposed an existing OTP lookup mismatch. Better Auth selects the newest verification by createdAt; our scheduling, delivery guard and pre-verification expiry check selected an unspecified first record.
- Added a real database/SMTP regression with two code requests: before the fix the superseded email incorrectly succeeded. All three lookups now use Better Auth's newest-record ordering, and the delivery guard checks that exact record is live. The regression passes: old mail expired, one current email delivered, newest code verifies.
- The request quota and five-minute expiry are unchanged. This correction does not introduce preview-only authentication behavior.
- Full authentication regression passed 34/34, including the new real rotation/SMTP test. ESLint, web/tooling TypeScript, Prettier and diff checks passed.

### Foundation preflight: existing runner path failure

- `bun run test` before production edits: unit 47/47; integration 196/197, failed U281.
- Actual failure: `Cannot resolve tsconfig at path: /home/coder/payloadbay/packages/domain/tests/config/tsconfig.json` from `node --import tsx scripts/database/push.ts` when Drizzle changes cwd.
- This is preexisting baseline/tooling failure, not FT04a red evidence. The runner now passes an absolute TSX_TSCONFIG_PATH so child cwd cannot change its meaning. Database-suite and remaining baseline verification pending. No product behavior was changed before baseline recovery.

- Baseline correction evidence: database suite 16/16 including U281; unit 47/47; executor 28/28; deployment 15/15. Browser baseline 35/37 initially, with compiler-unavailable/timed-navigation failures in U131 and notification publishing while deployment builds competed for resources. Rechecked both unchanged tests alone: 2/2 passed (44.4s), without tolerance/assertion changes. Initial integration lane was 196/197 and its only failure was U281; the entire owning database suite passed after the runner fix. This is combined baseline evidence, not a claim that the original full command passed.
- Inner loop uses the already approved scoped owning-file strategy; all affected final suites will be rerun for the feature. Preexisting Docker/cache/migration-workflow drafts remain uncommitted and excluded. F01–F12 are not complete.

### FT04a — default organization/workspace setup

- Red command: `bun run test:file tests/integration/organizations.test.ts --name FT04a`.
- Actual assertion: `setup must provision an organization`; `+ 'undefined' - 'string'`.
- The acceptance was observed before organization schema/bootstrap implementation. The last focused baseline browser recheck completed green before product edits. This cycle opens setup only; F01 migration/integrity and F04 full onboarding remain incomplete.

- Green FT04a: 1/1 setup acceptance; existing auth suite 34/34. Schema adds Organization and an intermediate optional workspace lineage column; required lineage enforcement is the next behavior, not claimed complete here.
- U320 exposed the new-default fixture interaction: `2 !== 1` workspaces before the seed correction. The preview seed now renames/reuses the default workspace; unchanged U320 passed 1/1. U321/U322 passed in the owning file run; its pre-correction U320 failure remains recorded. No assertions were changed or skipped. Full Next preview rebuilding took about 215s; subsequent seed feedback used U320 only.
- Formatting and web/tooling TypeScript checks passed. No further refactor needed for this first provisioning slice. F01/F04 remain open for integrity, migration, rollback, customer and invitation behavior.

### FT02a — organization parent for workspace creation

- Red: `bun run test:file tests/integration/organizations.test.ts --name FT02a`.
- Actual failure: `error: 'Resource unavailable'`, `code: 'not_found'`; the existing command treats the organization ID as an installation.
- The approved hierarchy changes the parent contract; existing resource/browser setup fixtures must provide an organization ID, not retain an undocumented instance-parent fallback. No permission assertions are weakened.


FT02b RED: organization creation using the instance parent returned `Resource unavailable` (`not_found` at scopeAncestry). Added a real database ownership test covering inherited workspace creation, sibling exclusion, and organization/workspace listing.

FT02a/FT02b GREEN: organizations.test.ts 3/3; authorization.test.ts 11/11. Typecheck identified missing middleware rank and new permission label, corrected without relaxing scope checks.
FT01a RED: inserting a workspace without an organization produced `Missing expected rejection.` Added NOT NULL to the authoritative schema; legacy mapping remains a separate required cycle.

FT01a GREEN: organizations.test.ts 4/4; TypeScript passed.
FT01b RED: creating `default` in a second organization failed `slug_conflict`, demonstrating instance-global workspace slugs. Changed the live unique key to (organization_id,slug); duplicate slugs inside the same organization remain rejected.

FT01b GREEN: organizations.test.ts 5/5. FT03a fixture corrected to use the existing `configuration.changed` kind and explicit UUID cast (fixture errors are not product red evidence). Then RED: organization live subscription returned `[]` instead of the own-organization change. Added explicit organization-descendant filtering and instance inclusion; per-record authorization remains enforced.

FT03a GREEN: owning organization file 6/6; authorization 11/11, lint and TypeScript passed.
FT05a RED: an organization admin inviting a new user failed `forbidden: Permission required` at the instance admission check. Admission now requires organization-scoped `members.admit` (or inherited instance authority), never grants global rights, and refuses inactive admission reactivation. Suspended-account regression is the next explicit case.

FT05a GREEN: organization file 7/7; expanded inactive-admission assertion passed separately 1/1, existing auth/invitation file 34/34; authorization 11/11; lint and web/tooling TypeScript passed. Foundation tasks remain open: this is scoped role/schema/invitation progress, not completion of organization UI, legacy mapping, onboarding, metering or policy.

FT04b and FT03b regression checks passed individually: injected workspace creation failure rolls back installation/admission/owner/organization; archived organizations revoke workspace access/listing. These characterize the established transaction/inheritance paths, without invented red evidence.
FT06a RED: production-built browser test could not find the Organizations heading at /organizations. Added organization collection and scoped workspace creation, membership page, explicit authorized organization parent on global creation surfaces, contextual navigation/breadcrumb/search. Existing fixtures now use organization API context rather than obsolete instance-parent workspace creation.

FT06a GREEN: production-built browser flow 1/1 (organization collection → organization workspace modal → created row). Unit suite 47/47 and lint passed. Mobile hierarchy and wider browser coverage remain pending.
FT04c RED: missing onboarding module (`ERR_MODULE_NOT_FOUND`); new test requires default-off policy, concurrent idempotent customer provisioning, and no instance grant. Implemented shared transaction with per-user lock and durable provisioning record; narrow auth/API/UI wiring follows after service proof.

FT04c GREEN 1/1 after correcting the new audit query's explicit UUID/text cast. FT04d RED: valid OTP for a newly verified customer returned 403 instead of 200. Added registration-policy configuration (default invite_only) and allowed a verified, never-admitted onboarding session only when enabled. Existing inactive admissions remain rejected; ordinary authenticateRequest still denies domain access before provisioning.

FT04d GREEN 1/1: verified onboarding session succeeds; normal domain request authentication remains null before admission. FT04e RED: enabled registration request produced zero OTP jobs instead of one. Added internal identity preparation only behind enabled policy, after durable OTP quota consumption; default invite-only behavior and uniform request response remain unchanged.

FT04e GREEN 1/1; complete organization file 12/12 and unchanged auth file 34/34. Added narrow onboarding endpoint/page and registration-aware login copy; no domain authorization bypass for unadmitted sessions. Full integration and mobile new-customer browser verification running.
FT01c RED: runtime reapplication left the simulated legacy workspace's organization null (`legacy workspace must receive an organization`). Added transactional per-workspace mapping, owned by the active instance operator; no grant promotion, row-ID/history rewrite, or company merging. CI must defer NOT NULL for an added lineage column until this mapping executes.

FT01c GREEN 1/1: mapping repeated without duplicate organization, and grant/execution/event/project identities preserved. FT01d RED missing composition helper; added CI-only release composition that defers new workspace lineage NOT NULL, includes runtime backfill, then enforces it. No release SQL was generated or committed locally.
The broad integration run overlapped the browser build and hit Next's build lock. This is orchestration evidence, not a product assertion; rerun Next-consuming lanes sequentially after the active browser run. Do not claim that overlapping full run green.

Broader integration result: 203/210. Five historical migration fixture cases failed because the modern shared seed now required Organization against intentionally immutable old schemas; added an explicitly named legacy seed for those historical cases (history SQL and assertions unchanged). One concurrently added mapping case was observed red before its implementation, and U321 hit the concurrent Next build lock.
Mobile onboarding reached the new workspace and passed permission/organization assertions, then timed out at screenshot stabilization. Retrying alone with CSS animations disabled and an explicit screenshot timeout for a precise artifact failure; no product assertion or global timeout was relaxed.
FT01d GREEN 1/1: actual database upgrade maps lineage before enforcing NOT NULL.

FT06b GREEN 1/1: full mobile OTP → narrow onboarding → default workspace journey, no instance permissions, only its own organization, screenshot captured. The remaining timeout was Next fixture teardown waiting on the live browser SSE connection, not a product or screenshot failure; the test now closes its live page before stopping the dedicated server. No test timeout was increased. Database historical/current-source file 16/16 passed.
FT01e RED: archived legacy workspace mapping produced an unarchived organization. Mapping now copies archived_at along with its ownership lineage.

FT01e GREEN 1/1. Mobile screenshot inspection revealed a genuine onboarding dead end: the empty default workspace offered no create-project action. Extended FT06b; observed RED at missing `Create project` button. Added scoped project creation modal and navigation to the created project's route/destination working page, preserving parent context.

FT03c RED: changing a retained workspace's organization succeeded (`Missing expected rejection.`). Added database parent immutability for organization/workspace/project/endpoint ancestry; NULL legacy lineage may still be backfilled. Legacy staging tests explicitly remove this new trigger when recreating pre-organization state. FT07a RED: missing usage module, test requires concurrent deduplication, durable total and immutable facts.

FT07a GREEN 1/1: concurrent duplicate facts produce one lifetime/hour counter increment and facts reject mutation. Drizzle's pinned exporter cannot serialize bigint literal defaults; defaults use SQL bigint literals while TypeScript mappings remain bigint. FT07b/c add rollback and composite tenant-lineage regression coverage.
FT08a RED: real accepted ingress yielded no usage facts (`[]` instead of created/accepted/recorded). Added fact hooks inside its existing storage/receipt/execution/dispatch transaction, with ownership resolved from endpoint ancestry, not webhook/job input. Error and rejected/respond-only receipts record ingress only.

FT07b/c GREEN: metering file 3/3, including transaction rollback and database rejection of mixed tenant lineage. FT08a GREEN 1/1. FT08b RED: recovered processing attempt count was undefined instead of 2. Moved execution claim and its fact into the same transaction; fenced terminal and exhausted-recovery transitions record a deduplicated terminal fact. Heartbeat/requeue do not create logical executions.

FT08b GREEN 1/1: duplicate claim, heartbeat, expired recovery and stale completion retain one logical execution, two actual processing attempts and one success. FT08d RED: intentional idempotent replay left logical total at 1 instead of 2. Replay now records created/replayed once in the same transaction as its durable replay key and job.

FT08e RED: real cached-send test made one HTTP request/attempt, but its usage counter was missing. Delivery attempt metering now commits with the fenced attempt row before HTTP; successful cached operation returns before that hook. This counts actual managed attempts, not arbitrary script fetches or guaranteed external receipt.

FT08d/e GREEN individually: replay counts one added logical execution and one replay classification; cached send counts one real managed attempt. FT08c extends terminal-exhaustion regression coverage. FT03d RED: archived-organization ingress reached secret resolution, returned generic not_found and entered the handler-error recording path. Initial ingress lookup now requires active organization ancestry and returns ingress_unavailable before script execution/storage.

Metering milestone: ingress file 26/26, delivery file 17/17 and recovery file 23/23 passed, including new exhausted-terminal and archived-ingress checks; web/tooling TypeScript passed. Full browser audit is running sequentially relative to other Next consumers.

Full browser audit: 36/39; three mocked unavailable/empty cases omitted the new organizations API and reached real authentication. Added only that fixture response; unchanged cases passed 3/3. FT06c RED: organization shared-code page omitted organization permissions and hid Create helper. Added organization context to code controls/back link and organization-specific member labels/invitation project selection. Its browser recheck awaits the next stable build.
FT09a RED missing resolver module; GREEN 1/1 local commercially unlimited self-host default. Added explicit persisted installation mode and validated local organization policy; missing/malformed hosted rows fail closed (FT09b regression). FT09c RED missing setter export; added instance-authorized, optimistic writes with immutable revision snapshot and audit.

FT09a–c GREEN 3/3: local unlimited defaults, missing/malformed hosted policy rejection and operator-only audited optimistic revisions. FT09d RED: two parallel creates both spent the final workspace slot (2 instead of 1). Shared resource creation now locks organization, resolves policy and counts live resources before inserting/assigning ownership. Customer default-workspace provisioning uses the same gate.

FT09d GREEN 1/1. FT09e RED: three concurrent requests all returned 202 under a one-event acceptance ceiling. Added organization-serialized admission windows and atomic reservations updated only by newly inserted accepted facts. Over-limit requests persist as rejected ingress with HTTP 429 and no receipt/execution/job. Window counters continue tracking accepted facts while a quota is cleared, so reapplying a window cannot reset history. Accepted work remains eligible after a downgrade.

FT09d–f GREEN: organization policy file 5/5 and concurrent ingress quota case FT09e 1/1; accepted executions remain processable after an acceptance downgrade. TypeScript passed at that checkpoint.
FT07d RED: readOrganizationUsage was missing. Added authorized organization counts with strict increasing UTC, half-open windows, zero-valued metrics and string quantities (no bigint precision loss). GREEN 1/1 for boundaries, forbidden access and fact/hour/lifetime reconciliation. Removed a vacuous event-delete assertion: this case does not prove retention cleanup.
FT10a RED: a second execution was claimed despite a configured single processing slot. Added organization-row serialization, DB-clock live-lease counting and a one-second fresh dispatch on saturation; no attempt increment or processing fact before a successful claim. GREEN 1/1 including stale generation no-op and expired-slot recovery. This does not yet prove scheduling fairness or destination capacity.

Capacity checkpoint: complete recovery file 24/24, metering file 4/4, organization policy file 5/5, repository lint and web/tooling TypeScript passed after FT10a. Format check found inventory ordering whitespace; formatting that file. Organization fairness and destination capacity remain pending; F10 is not marked complete.

FT03e–g regression expansion: real compiler/helper creation, encrypted secrets, cross-project pin rejection, multi-org membership with organization-scoped token, suspension, event/detail/payload, dashboard aggregates and scoped/accessible live backfill. First FT03e run had a test-fixture mismatch (null-prototype map versus plain object); corrected the assertion to check its actual secret value. No production defect or artificial RED is claimed for these already-working boundaries. Entire organization file GREEN 19/19.
FT11a RED: missing readOrganizationPolicy function. Added shared metadata-authorized policy read wrapper; GREEN 1/1. Added protected usage GET and policy GET/PUT routes; mutation still delegates to operator-only optimistic service. HTTP/browser checks pending.

FT06c GREEN 1/1 on a fresh production build: organization shared-code creation and member context work. FT09g GREEN 1/1: rollback releases an admission slot, usage accepted while unlimited survives same-window reapplication, expired windows fail closed. FT10b GREEN 1/1: independent concurrent executions share one org slot and completion releases it. Full policy file GREEN 7/7.
FT11b RED: organization usage page lacked its heading (404). Implemented scoped native HeroUI tables, selectable UTC windows, current limits, loading/retry state, contextual navigation and breadcrumbs; TypeScript/lint passed. Mobile/HTTP browser recheck running.
FT10c RED: missing organization-scheduling module. New test requires actual Graphile neighboring-org progress within three claims despite forty older flood jobs; implementation waits for the current browser build checkpoint so build inputs stay stable.

FT11b follow-up: the first implemented-page run used an incorrect test role (`table` versus HeroUI's `grid`); corrected the locator. The next run exposed a real missing accessible label on the usage-window native select. Added explicit label association and aria-label; no test timeout increased.
FT10c GREEN 1/1: public Graphile flags plus durable per-lane organization turns give neighboring work a turn before a forty-job flood finishes. Strengthened with a pre-upgrade unflagged offer; observed RED (legacy offer not eligible), then selected candidates by public job priority rather than requiring new flags. GREEN 1/1 including preserved legacy job identity. Legacy unflagged offers retain eligibility but do not acquire a retroactive fairness guarantee. No private Graphile tables are used by the new selector.

FT11b GREEN 1/1 after fixing native-select labelling; mobile time-window selection, usage/policy reads and malformed-window rejection passed. Inspected the saved 390px screenshot. FT10d RED: second real HTTP send succeeded despite a one-slot destination. Added per-project destination capacity keys on attempt rows, serialized reservations before HTTP and live generation/lease occupancy checks. FT10d/e GREEN individually, then complete delivery file GREEN 19/19 including expiry/recovery/stale fencing and retained crash-window history.
F12 preview seed RED: expected four scoped identities, found three. Added unrelated organization owner, its own workspace/project/helper/route and two synthetic requests using shared domain services. A helper extraction initially referenced the old local db variable; corrected to its passed pool. U320 GREEN 1/1: repeat seeding preserves four identities, two org/workspace contexts, three projects and four accepted events; customer/project users cannot inspect sibling scopes.
FT03h GREEN 1/1: real publication pins only its organization middleware; foreign middleware origin/secret pins are rejected even with operator read rights. Extended unchanged real workerd middleware integration U121 to include organization between instance and workspace; GREEN 1/1.
FT07e GREEN 1/1: owner-only fixture maintenance truncates source event/execution graph; facts, report, lifetime totals and dedup survive. This proves storage independence, not a shipped automatic retention-cleanup feature, and grants no runtime TRUNCATE permission.

FT08f RED: oversized transformed body threw 413 after the handler-error recording boundary, leaving no event. Moved that validation into the protected handler outcome path. GREEN 1/1: original bounded bytes retained as error, ingress counted once, no receipt/execution. Raw oversized-request rejection before execution remains unchanged. Added durable-counter equality to rejected bulk replay regression.

FT10f GREEN 1/1: two independent Node worker processes share one durable org slot; a fresh third process claims deferred work after expiry, with its first real attempt. Full unit lane GREEN 47/47; formatting and lint passed. The first final tooling check found a fixture-only Node/Bun dynamic `events.once` type mismatch; replaced it with the server's typed listen/error callbacks and reran tooling types. Broad integration/browser/deployment verification remains pending.
The added subprocess test's final lint pass found one unused fixture binding; removed it. Changed-file ESLint/Prettier and tooling TypeScript then passed. The previous full web TypeScript pass covered the same production source checkpoint; broad suites follow without product edits.

Broad foundation checkpoint b26c421: full integration lane GREEN 244/244 (242.7s), full executor lane GREEN 28/28, full unit lane GREEN 47/47, full lint and formatting passed. Added FT02c ownership regression also passed: a suspended replacement does not satisfy last-active-owner protection.
Final boundary review: extended FT11b HTTP assertion observed RED because project detail omitted organization_id although project lists include it; added the immutable workspace join to that DTO. FT03i initially lacked an authorized change in its fixture; fixed the fixture, then observed real RED because revoked-token accessible backfill returned an empty batch instead of rejecting. Added token-scope authority revalidation before per-row filtering; FT03i GREEN 1/1 and complete live-API file GREEN 18/18. Full browser/remote revision verification remains pending after these two narrow fixes.

Final source checkpoint f5a71d5: full browser run passed 40/41; FT06b could not allocate its Docker network because abandoned local fixtures exhausted predefined address pools. After individually verifying and removing one old tmpfs-only fixture with no clients, FT06b passed 1/1 through actual SMTP OTP, mobile customer onboarding, workspace, project and route creation. This is 41 browser behaviors verified across the broad run plus targeted rerun, not a claim of a single green full-lane invocation. Final full ESLint, Prettier and test-inventory checks passed. Foundation source pushed to existing draft PR #13; exact Coolify deployment and container-delivery rerun remain pending.
Deployment lane passed 14/15, including non-root standalone/executor image startup and actual Next installation/auth/API flows. U253 was infrastructure-blocked by a second required subnet during concurrent test files; a second individually verified abandoned tmpfs fixture was removed and the owning U253 rerun follows. No production services, host networking configuration or unrelated Docker drafts were changed.
U253 rerun GREEN 1/1: restricted worker image processed accepted bytes through its separate executor and completed real HTTP delivery. All 15 deployment behaviors are verified across the broad invocation and the targeted infrastructure rerun. Local image checks use the six pre-existing uncommitted Docker drafts, deliberately excluded from foundation commits; exact remote preview must verify committed Dockerfiles separately.

Exact committed-source preview GREEN: Coolify pgmz2eckz2wr057enfchfh1b finished at 2026-10-16 15:58:21 UTC for f5a71d588d9cbe9eac0246048420a9a8c2bb05fb, using committed Dockerfiles rather than the excluded local drafts. Real SMTP OTP checks passed for instance owner (two orgs/three projects), unrelated organization owner (only its customer org/project), project admin and project viewer (only Demo integrations, no parent workspace/org aggregates or instance grants). Direct sibling project/org usage denial and viewer mutation denial passed. The first rapid fourth login returned the installed Better Auth plugin's normal 429; its inactivity-based limiter was confirmed in source and viewer continuation passed without weakening protection. No login-response payloads, OTPs or session cookies were committed.
A new correlated synthetic customer event received HTTP202, subsequently reached succeeded with delivered HTTP state, and increased its local ingress usage; managed delivery usage was nonzero. The organization's native mobile Usage and limits page rendered and its 390px screenshot was inspected. All F01–F12 foundation work now has evidence; separate original alpha release/performance/coverage/OpenAPI/published-install/upgrade gates and hosted commercial H01 remain open.

API documentation cycle U155a: `bun run test:file tests/integration/live-api.test.ts --name U155a` RED against the real standalone Next HTTP boundary: `installation must serve its machine-readable API contract`, `404 !== 200`. Added the smallest OpenAPI 3.1 endpoint reusing the actual project `resourceInput` and error Zod schemas, relative installation server and explicit token/session transports. Its production-build rerun is in progress; complete route/schema parity and local Scalar token execution remain open U155/U156 work.
U155a GREEN 1/1 through production Next, then full live-api owner GREEN 19/19. U155b `bun run test:file tests/integration/live-api.test.ts --name U155b` RED: `Every implemented API operation must be documented, with no invented routes` (one documented operation versus 82 actual exports). Added the explicit public route surface and generated required UUID/stage/invitation-token path constraints, SSE response transport and known no-content revocations. U155b GREEN 1/1; complete owner regression follows. This step does not yet claim body/query contract coverage or working Scalar.
U155b complete owner GREEN 20/20. U155c RED: `POST /api/v1/invitations requires its JSON body in the console`, `undefined !== true`. Moved existing route-local validators verbatim into shared contracts, retaining domain exports for existing consumers, and registered all JSON command validators plus optimistic/replay headers. U155c GREEN 1/1, including valid/control-character replay-key examples; tooling TypeScript passed. Its full owner rerun was infrastructure-blocked before setup (Docker address-pool exhaustion), not an API regression or passing evidence.

Fixture-lifecycle regression: imports of node:test after() inside the first running test scope cleanup to that test. Later users recreate the singleton stack without a remaining owning after hook. `bun run test:file tests/integration/fixtures.test.ts --name late-imported` observed RED in a real two-test subprocess: `The later test's stack must not leak after normal process exit`, `true !== false`. Added an idempotent synchronous exit backstop for only that process's random Compose project, retaining explicit/after cleanup. The regression cleans up its own stack even on Red; no global prune or deployed resources are touched. Green rerun follows.
Fixture cleanup GREEN 1/1, then its complete owner GREEN 2/2 including real PostgreSQL/queue/SMTP/byte-preserving HTTP. Tooling TypeScript passed. The final lint check found a missing blank line in the strengthened documentation test; corrected through the existing rule, without weakening it. Complete API production regression is still running.
U155c complete owner GREEN 21/21 after cleanup fix; affected notification owner GREEN 18/18 and publication/script-test owner GREEN 23/23. U155d RED: `/api/v1/changes query contract`, documented `[]` versus actual `after, scopeId, scopeType`. Added recognized GET query contracts using the existing scope, pagination and usage-window Zod primitives; output types preserve numeric pagination while input optionality keeps defaults optional. Repeated statuses use form/explode encoding. U155d GREEN 1/1; full owner regression and final checks follow. Full repository lint/format and tooling types passed at this source checkpoint.
U155d complete API/live owner GREEN 22/22. U156a registered new browser owner api-docs.spec.ts before its RED: real `/docs/api` returned 404 instead of200. Selected the official pinned Scalar React integration (0.9.81, renderer1.75.0) so Next bundles local assets; removed the unused CDN-oriented Next HTML helper. Client page disables default remote fonts, auth persistence and telemetry; its fetch boundary accepts only the installation origin with redirects disabled and normal cookie CSRF headers. Initial build compiled but exposed Bun ambient `fetch.preconnect` in the web TypeScript environment; restricted web ambient types to its real Node/React runtime, preserving Bun only for tooling. Also corrected Next's native-anchor lint finding to Link. These setup/type findings are not additional behavioral Red evidence. Browser rerun follows after type verification.
U156a GREEN against production Next: local specification/renderer/font requests only, then 390px layout without document overflow; inspected its screenshot. U156b's first two attempts needed real renderer selectors (select the operation inside its lazy tag; distinguish Send from keyboard-help control), not product Red claims. Real cookie-free scoped Bearer GET then normal API revocation GREEN 1/1: only one authorized project, no local-storage token, revoked token401. A temporary transport mutant stripping Authorization failed exactly `Expected200 / Received401`; the test file was restored automatically, with no production mutation or credential logging. Complete API-docs owner rerun follows.
Restored complete API-docs owner GREEN 2/2. U156c first corrected a fixture selector to HeroUI's inherited Account menu name; actual behavioral RED then showed the missing API documentation menu item, `Expected1 / Received0`. Added the native HeroUI help link and kept the reference page's Back/preview chrome sticky using Scalar's supported measured header offset. The production mobile round-trip rerun follows; no complete release or broader UI regression pass is credited yet.

U156c mobile round-trip GREEN 1/1 after correcting its fixture to create the expected project. Complete integration lane GREEN 250/250 and unit lane GREEN 47/47 at this production-source checkpoint. U154 real metadata-only SSE characterization GREEN 1/1; a temporary local production mutant broadcasting row.metadata failed exactly `Persisted private content must never be broadcast to metadata readers`, `true !== false`. The finally block restored live.ts byte-for-byte (empty Git diff). Restored complete live/API owner GREEN 23/23. Full browser regression is running; no complete release pass is credited yet.

2026-10-17 resumed checkpoint: interrupted complete browser invocation finished GREEN 44/44 (3.3 minutes), including all three local API-console cases. Complete live/API owner GREEN 23/23 after restored metadata mutant. U154–U156 are DONE; release-wide installation/performance gates remain open.

U159 first slice RED: `Installation job administration must expose an authorized metadata service`, undefined versus function. Added instance jobs.read authorization and a bounded explicit operational projection excluding encrypted payloads and raw errors. This slice does not yet certify the job dashboard or backlog metrics; Green rerun follows.

U159 metadata service GREEN 1/1, then complete authorization owner GREEN 12/12. Project jobs.read is denied at the instance boundary; instance jobs.read receives only explicit operational fields. Encrypted payload and raw upstream error markers remain absent. U159 UI concealment is not yet credited.

U160 due-backlog RED: authenticated service returned no backlog property, so the real database case failed reading its length. Added due queued/retry_wait execution aggregation by endpoint priority, excluding paused routes and future schedules. Queue residence and due delay are separate seconds; acknowledgment latency is explicitly null because it is not currently measured. Green rerun follows.

U160 due-backlog GREEN 1/1; complete authorization owner GREEN 13/13. Real rows prove ten-minute queue residence versus two-minute overdue delay; a future retry is excluded, and pausing its route removes the due backlog. No schema or release migration change. Job API/UI remain pending.

K03 selected-workspace token RED against real database authorization: expected sibling permissions [], received metadata.read. Existing organization tokens have no subset representation. Added nullable persisted workspace allowlist, canonical API validation and current stored-token enforcement at shared authorization. Existing unrestricted keys retain null/all semantics; no release SQL generated. Green rerun follows.

K03 selected-workspace enforcement GREEN 1/1, then full authorization owner GREEN 14/14. The stored allowlist is re-read for each permission evaluation, including an already authenticated actor; a restricted key cannot inspect organization-wide aggregates. Personal and organization UI work remain pending. K01 browser flow is running against the not-yet-implemented personal settings route.

K01 browser RED through real production Next: missing Personal API keys heading at /account/api-keys (404 page). Implemented the shared HeroUI key manager with scope selection, explicit permissions/expiry, metadata table, bounded create/show-once/revoke sheets, copy and bottom toasts. Compilation/style checks precede Green rerun. API preview 9bdbfe7 deployed in wgbpjaut8qbpgcg8plqirnp9 at 2026-10-17 07:13:23 UTC; anonymous 390px /docs/api returned200, rendered82 operations, fetched no external origins, had no document overflow and showed its preview notice. Screenshot inspected.

K03 collection-limit regression RED: 205 projects in an excluded workspace crowded the selected workspace out of the bounded listing; expected its project ID, received []. Per-row authorization prevented disclosure, but filtering must occur before LIMIT. Production fix waits for the active K01 browser build checkpoint so its sources remain stable.

K01 implementation passed lint and TypeScript. Its first browser rerun reached the create dialog but Playwright check() targeted HeroUI’s visually hidden checkbox input; changed the interaction to its visible label and retained an explicit checked-state assertion. This is a fixture interaction correction, not a new behavior Red or permission bypass.

K01 personal-key browser GREEN 1/1 after using the visible checkbox label: created key authenticates a real API request, closing removes the secret field, confirmation revokes immediately (401), and 390px layout has no page overflow. Organization placement and desktop modal correction retain separate upcoming Red cycles.

R08 desktop-dialog geometry RED: actual workspace dialog center was 295px away from viewport vertical center (required within40px). Native HeroUI Modal auto placement supplies desktop center/mobile bottom with visual-viewport sizing; ordinary form/confirmation Sheets will migrate to that primitive. Navigation drawers stay unchanged.

K02 organization-screen RED: missing Organization API keys heading at its real route. Added the organization route using the shared manager and scoped navigation. R08: migrated13 ordinary form/confirmation/detail overlays from Sheet to native responsive Modal with inside scrolling, preserving the sidebar drawer. Fixed K03 collection-limit predicate in SQL before LIMIT. Independent Reds above retain their own owning Green checks.

K03 collection-limit fix GREEN in the complete authorization owner 15/15; selected-workspace predicate now runs before LIMIT. Unit lane GREEN 47/47. Full browser regression is running after native Modal conversion; no R08 or K02 Green is credited yet. Notification no-rule/threshold/route/destination/window acceptance is being characterized against existing production code, with test-after admission rather than a fabricated Red.

Notification boundary characterization GREEN 1/1 for U168/U175/U176/U177 against real PostgreSQL: no implicit incident/subscription/job, route and destination exclusion, N-1/exact-N, expired failure exclusion and incident deduplication. Corrected the past-attempt fixture to give it a matching past start time as well; full owning file rerun follows. Existing production behavior required no change, and no test-first Red is claimed.

Complete notification owner GREEN 19/19 after realistic past-start fixture correction, including real SMTP, custom HTTP executor delivery, pinned channel/branding, revoked recipients and the new opt-in/filter/window boundaries. U168/U175/U176/U177 DONE; notification control accessibility U180 remains pending.

Broad browser invocation completed 45/47. Existing editor/secret/event/member/notification flows and K01 passed with native Modals. R08 desktop centering passed and its screenshot was inspected, but its mobile reopen fixture raced the previous dialog’s exit animation; added an explicit unmount wait. K02 exposed a real missing settings-group registration for the new organization key entry; the fixture also needed the sidebar’s actual treegrid row role instead of link. Neither is credited as Green.

U180 attention accessibility RED: real project inbox control had an empty accessible description instead of No active notifications. Added a stable described-by element conveying loading/error/empty/count/highest severity while preserving the Notifications name and decorating icons as hidden. K02 registers its actual settings group and search entry; no hidden direct-URL-only screen is credited. Green checks follow.

Documentation traceability correction: the later foundation section reused FR-020–027, already assigned to API/live/auth/editor/recovery/theme/notifications. Preserved the original FR identities and moved the eight unchanged foundation requirement bodies to FDN-001–008; verified definition identifiers are unique. Replaced a stale no-product-tests sentence with the actual evidence location. No product behavior or test threshold changed.

K03 expanded owning case GREEN1/1: organization-wide keys keep organization access, two-workspace keys cover both selected workspaces, a real foreign organization workspace is rejected, and a restricted key holding tokens.manage cannot mint an unrestricted organization key. Current stored restrictions still fence an already authenticated actor. Broader integration will run after the active Next/browser checkpoint.

Full browser invocation 43/48: personal and organization key flows passed. Three older assertions matched both new screen-reader status text and the visible inbox text; scoped them to the open notification dialog. R08 measured mobile bounds during the entry animation (846px versus844px); retained the same844px limit and now polls until placement settles. U180’s arbitrary Escape immediately after removing the focused dismiss button raced focus restoration; its actual requirement is severity/dismissal, so it uses the visible Close control before checking the outside attention button. No production logic or assertion bound was weakened. Rerunning the full cached browser inventory.

Evidence clarification: focus restoration is an inference for the U180 Escape failure, not a verified causal diagnosis. This cycle verifies the visible Close control and does not certify that keyboard timing path. Desktop/modal bounds and all other assertions retain their original limits.

Full browser GREEN48/48 (4.5m), including real personal/organization key flows, R08 desktop/mobile geometry, and U180/U181 real scoped typed-producer → SSE → accessible severity/count → per-user dismissal. Mobile screenshot inspected and viewport-bound. The desktop screenshot’s animation-disabling capture omitted the still-entering dialog despite passing geometry; prior same-modal screenshot was centered. Improved capture by waiting for real Name-input click actionability and leaving animations intact; a final scoped capture rerun follows after backend integration. No product source changed.

Complete backend integration lane GREEN256/256 (264282ms) after persisted workspace restrictions and pre-limit filtering. Complete browser GREEN48/48 and unit GREEN47/47 remain the current product checkpoint. Final scoped R08 artifact capture is running with unchanged production source.

Final scoped R08 GREEN1/1, run98588f58-484f-4fb8-8093-dcbd13ef2703. Desktop screenshot visually inspected: workspace form is centered at1280×900; mobile bounds remain verified at390×844. Capture correction changed only the test interaction, with unchanged production sources. Physical Android keyboard/toolbar behavior remains a separate unverified device check.

L01 RED: `bun run test:file tests/acceptance/bootstrap.spec.ts --name L01` with authorized localhost access failed against production Next: `getByRole('note', { name: 'Sign-in information' })` → `Error: element(s) not found`. Initial invocation used unsupported --grep; corrected to registered --name. Sandbox-only attempt could not bind localhost and was interrupted; neither is behavioral Red. Implemented optional runtime PAYLOADBAY_LOGIN_HINT plain text, whitespace-only omission, no demo selector or automatic preview email, and hide during OTP. Login waits for connection before reading runtime environment. Preview Compose configures synthetic examples; ordinary installations remain opt-in. Green follows.

L01 GREEN in the complete bootstrap/sign-in browser owner: 9/9 passed, including enabled hint on a non-preview runtime, escaped script text, blank omission, preview with no configured hint, blank initial email, no combobox, and OTP-step omission. Production build passed; scoped ESLint/Prettier, web/tooling TypeScript, inventory and actual Docker Compose parser owner1/1 passed. No authentication/permission bypass or new role was added. Exact preview deployment remains separate; its Compose definition is loaded from master.

Resumed original alpha implementation after sign-in/history feedback. U159 browser/API job-administration regression written before route/page implementation; existing safe metadata service and U160 database timing evidence are retained. Red invocation follows.

U159 HTTP/browser RED: `bun run test:file tests/acceptance/dashboard.spec.ts --name "U159 job administration"` → `Expected: 200 / Received: 404` at GET /api/v1/jobs. Added protected route using existing installation-authorized service, public response schema/OpenAPI, native-table jobs/backlog page and rights-aware administration/search/breadcrumb entry. Corrected new fixture toggle locator to the existing Toggle navigation label before Green; no production behavior weakened.

U160 page-level characterization added after the page implementation (no fabricated Red). It uses a real published route and stored executions: ten minutes since creation, two minutes overdue, a future execution excluded, and an explicit Refresh after pausing. The existing service-level U160 already supplied its independent Red/Green. Page characterization Green is pending.

API/live owner ran concurrently with the jobs browser production build; 22/23 passed, but U155a could not start its nested Next fixture: `Another next build process is already running.` This is an orchestration mistake, not a product failure or Green result. Wait for the active build/browser lane to finish, then rerun the complete API/live file sequentially.

U159/U160 browser GREEN2/2: real protected API, safe metadata, navigation, mobile no page overflow, revoked-rights403 and concealed controls; real ten-minute/two-minute backlog display, future retry exclusion and pause+Refresh empty state. API/live owner rerun sequentially GREEN23/23, including actual route/OpenAPI parity for83operations and SSE heartbeat/reconnect/privacy. Scoped lint/format and web/tooling TypeScript passed. Original T076–T078 stay open for their remaining live/replay/administration scope.

U159 active-history RED: the bounded list returned completed history instead of the newly queued job (`Active work must not be hidden behind completed history`). Query now sorts queued/running work ahead of completed history before LIMIT100, preserving due-time/id order within groups. No payload projection or authorization changed. Complete authorization owner Green follows.

U157 one-stream browser regression written before consolidation: count actual EventSource instances while both event list and notification inbox are mounted, then prove real committed event/terminal-state/notification producers update their consumers and client-side navigation retains the connection. Red invocation follows.

Active-job ordering GREEN in complete authorization owner16/16. A queued job remains first with100older completed jobs; bounded metadata, permissions, token/workspace fences and queue-age checks remain green.

U157 shared-stream RED against actual browser: expected1open EventSource, received2 while events and notification inbox were mounted. Implemented a dashboard-level accessible-scope stream, typed local subscriptions for existing kinds, reconnect resync and existing scoped consumers; server per-change authorization stays unchanged. Added factual connecting/connected/reconnecting status to the event view. Green follows.

First shared-stream Green attempt passed the1connection assertion and received the new event, but its fixture expected `Queued` while the established UI says `Accepted · queued`. Corrected the test to the existing label, preserving the connection/event assertions and production behavior. Also corrected its existing terminal label to Handler completed; no new product wording is claimed. Rerun follows.

Shared stream rerun delivered event, terminal-state and notification updates on1connection, then exposed a real lifecycle Red: after client-side navigation the constructed EventSource count was2 instead of1. The provider effect included its refresh callback identity; moved latest reconnect handling into installed React useEffectEvent so the connection lifetime depends only on installation identity. No connection-count assertion was weakened. Green rerun follows.

Navigation rerun still constructed2sources, disproving callback identity as the sufficient causal explanation. A whole-web-source constructor search found the missed third independent EventSource on the Overview page. Migrated that consumer to the same provider; only live-subscription.tsx now constructs EventSource. Keeping the provider installation-only dependency makes its intended lifetime explicit, but it is not credited as fixing the missed consumer. Connection assertion remains unchanged.

Exact remote9d0c3f7 verification: Coolify z0scr0pb8ixwqc0m8thco99q finished2026-10-17T08:54:25Z. Normal owner and project-viewer OTP passed; no demo selector; personal/project and selected-workspace organization keys authenticated scoped reads and were revoked immediately; API-key settings routes rendered; desktop workspace dialog centered and screenshot visually inspected; mobile jobs screenshot inspected with no document overflow; job metadata safe and project-viewer403. First temporary smoke incorrectly expected403 for an out-of-scope token; source contract returns401 and cleanup revoked its key. Corrected assertion, rerun passed. No credential printed. K04 remote key/modal evidence complete. Optional preview sign-in text remains dependent on master Compose configuration; no text visibility claim.

Shared-stream GREEN1/1: actual browser constructs one EventSource, receives committed event and terminal execution changes plus typed notification producer changes, then client-side Overview navigation retains exactly one constructed and open source. Whole-web search confirms only live-subscription.tsx constructs EventSource. The missed Overview consumer was the verified fix for navigation count. Open-inspector U157b remains a separate pending cycle.

U157b open-inspector RED: after committed attempt.completed, the open attempt table remained `Pending` instead of `HTTP 503` (expected response body Try again later). Shared invalidation now refreshes selected event detail and selected attempt as well as the event list. Selected tab/attempt stay in place; replay publication initializes when selecting an event and is not overwritten by live updates. Green follows.

Open-inspector/live pair GREEN2/2: pending attempt updates to HTTP503 with captured response bytes while keeping Outgoing selected; one shared source survives navigation. U158 strengthens the existing successful-event bulk replay browser scenario after implementation (characterization, no fabricated Red): original execution/attempt history unchanged, new queued execution with replay_of_id, and both states visible in the inspector. Full browser verification follows with production sources frozen.

Final complete browser GREEN53/53 (4.4m, total283438ms): shared stream and persistent navigation, open attempt response updates, successful-event replay lineage/unchanged original history/visible separate executions, API keys, notifications, editor, invitation/onboarding, and desktop/mobile dialog geometry all passed in one invocation. Unit47/47, complete lint, web/tooling TypeScript, formatting and inventory passed. Full backend integration is now running sequentially; no result credited yet.

Complete backend run256/257: only U321 failed because it still required the now-rejected hard-coded Project admin/viewer dropdown labels. Updated that old scenario to the maintainer-authorized contract: preview warning and receiver remain preview-only; no Demo access selector or unconfigured hint; configured operator text renders outside preview. This is a requirements-alignment correction, not a relaxed security/runtime assertion. Owning preview suite and full integration rerun follow; no257/257 claim yet.

Preview owner GREEN3/3 after requirements alignment; its preview warning/receiver separation, opt-in non-preview hint and protected reviewer account remain verified. Full backend rerun started sequentially; production source unchanged from browser53/53 checkpoint.

Final full integration GREEN257/257 (257761ms) after preview contract alignment, on unchanged production sources from browser53/53. Unit47/47, complete lint, web/tooling TypeScript, format and inventory are green. The first full256/257 result and owning correction remain recorded above. This verifies the current settings/jobs/shared-stream/live-inspector checkpoint, not the remaining published-release/performance/retention gates.

Audit AD01 RED: `bun run test:file tests/acceptance/dashboard.spec.ts --name 'AD01 instance audit'`, artifact `test-results/64923339-0f80-42a1-973e-cd6976d0b7d0/browser/console.txt`: expected HTTP200, received404 at the first GET /api/v1/audit assertion. Added instance-authorized metadata-only cursor API and native audit table/administration navigation; stored diffs are never selected. AD02 is additional test-after coverage, not a claimed Red: project-level audit rights cannot read installation history, five ancestor scopes paginate at identical microsecond timestamps, foreign installation scope is excluded and current permission removal denies the next call. AD02 GREEN1/1. Browser AD01 Green pending.

Audit AD01 GREEN1/1: real Next browser test passed safe GET, invalid limit/cursor400, next-page traversal, authorized sidebar/table, 390px no document overflow and permission removal403/restricted page. AD02 GREEN1/1 and unit47/47. Web/tooling TypeScript and lint passed; initial format check caught only the new dashboard test, which was formatted. Full authorization/API owners follow. No migration generated; T077 remains open for remaining installation-health/settings work.

Audit owning regression GREEN: authorization17/17, real HTTP/OpenAPI23/23, unit47/47, lint, web/tooling TypeScript, formatting and inventory. API registry now84operations, including audit response and canonical limit/cursor documentation. This closes AD01/AD02 only; remaining alpha release and installation-health work stays open.

Audit AD03 RED: `bun run test:file tests/acceptance/dashboard.spec.ts --name 'AD03 audit pagination'`, artifact66af4834-708c-4e5e-92d9-9819aa129af6: `Expected substring: "fixture.older"`, `Received string` contains only fixture.newer after the retry click. A failed next-page request left the same cursor in state, so clicking again did not rerun the effect. Added a separate request revision for deliberate retry; preserve prior rows and cursor semantics. Green follows.

Audit retry AD03 GREEN: audit browser pair2/2. The failed503 next page now retries successfully, retains the first page, appends the older action once and removes Load more at end of history. Original safe pagination/current-rights/mobile AD01 still passes. Installation settings/health IH01 is the next separate cycle; not yet implemented.

Installation IH01 RED: `bun run test:file tests/acceptance/dashboard.spec.ts --name 'IH01 installation'`, artifact9629ffcc-b510-427f-8c0e-8c48fd287f4c: expected200, received404 at GET /api/v1/installation/settings. Added current instance settings.manage authorization, a safe read-only configuration projection and bounded three-second/16KiB executor probe plus schema query. SMTP delivery/workers remain explicitly not_checked; runtime configuration is not host attestation. Native installation page/navigation follows; Green pending.

IH02 is additional test-after coverage, not a claimed new Red. Real local HTTP health responses exercise ready/not-ready, configuration mismatch visibility, redirect rejection, 16KiB response cap, upstream error privacy and refusal to turn a self-reported hostAttestation=true into an attestation claim. Project settings.manage cannot authorize an instance probe or configuration read; rejected access initiates no outbound call. Owning config suite running.

Installation IH01 GREEN1/1: real database and workerd executor respond, safe settings projection omits credentials/SMTP connection details, worker/SMTP delivery remain not_checked, native mobile view has no document overflow, and removing instance settings.manage returns403 for both APIs/restricted page. Desktop/mobile screenshots captured and visually inspected. Config owner GREEN3/3, including IH02 real HTTP boundary checks. Tooling TypeScript first caught the test's dynamic node:events import and inferred loop local; corrected the test import/annotation, then tooling TypeScript/lint/format/inventory passed. Full browser regression starts on stable production sources; no complete-lane result yet.

Exact audit remote931bf86 verification: Coolify qrencpsdsm3p0tozv56ju0yo finished2026-10-17T09:56:28Z. Normal owner/viewer OTP, safe audit metadata keys, cursor traversal, native mobile table and viewer403/restricted page passed. Mobile screenshot inspected. This remote checkpoint excludes the later local audit retry/installation additions; no deployment claim for them yet.

Complete browser GREEN56/56 (4.4m; total279885ms) on stable audit-retry/installation sources. This includes shared live stream/open inspector, safe audit history plus failed-page retry, current-rights installation health, native desktop/mobile dialogs, keys, editor, notifications and verified organization onboarding. Final-source unit47/47, web/tooling TypeScript, lint, format and inventory passed. Full backend regression starts sequentially next; not yet credited.

Test-inventory TG01 RED: `bun run test:file tests/unit/tooling.test.ts --name 'unknown owning lane'`: `Received function did not throw`, returned tests/unit/a.test.ts for typo-lane. The full runner's fixed lane list would silently omit that registered file. Added a shared known-lane definition, validation and separate serialized performance mode. Product sources remain frozen during the independently running backend regression. Green follows.

TG01 GREEN: complete tooling owner17/17; complete unit48/48; tooling TypeScript/lint/format/inventory passed. Full backend on unchanged product195b39e GREEN259/259 (305321ms); complete browser56/56 remains valid. No new test file has yet been registered to performance, so no performance pass is claimed.

Coverage investigation: `bun run test:coverage` exited1 during reporting after the48 passing test lines, without a complete report/summary. LCOV-only diagnostic returned0 without a fresh LCOV file or complete summary; the full-run guard would not credit that as a passing selection. Tooling-only diagnostic produced a complete text table but exited1 and no fresh LCOV (aggregate93.75% functions/82.89% lines; individual file lines lower). CLI flag placement did not resolve it. Existing coverage/unit/lcov.info still dates to October14 and is not current evidence. No threshold changed or coverage pass claimed; full-product coverage remains an explicit release gate. Official Bun coverage documentation was consulted; it warns that LCOV-only process success is not itself a threshold guarantee.

Prepared PF01 as existing-system release acceptance, not a claimed test-first implementation cycle. Own serialized performance lane; real Next standalone HTTP container, worker and separate workerd executor against disposable PostgreSQL/HTTP receiver. Committed Dockerfiles are copied read-only to a temporary build location so unrelated local Docker drafts do not define the benchmark.600requests at10/s for60s;1000 seeded bulk queued executions include100ms script delay. Per-container CPU/memory limits, source/image identities, backlog snapshots, sample counts and latency definitions are recorded. No thresholds changed; initial run follows on an otherwise idle test workload.

PF01 first real acceptance RED: artifact4b57aec5-1e62-4500-8bea-2637b0eda8d6/performance/latency.json.600/600 HTTP requests202 and600 complete deliveries; p95ACK430.14ms, p95 acceptance-to-first-attempt5335.66ms (target<=2000), max5676.57ms (target<=10000). Bulk remained queued throughout (999→777). App/worker/executor each1CPU; executor768MiB, app/worker512MiB. Observed concurrent Coolify build on the same16-logical-CPU host; external-load-observation.json records load and active deployment. Thresholds unchanged. Added test-only decomposition using existing immutable processing.attempt.started usage facts (queue→claim→firstHTTP), per-event numerical samples and before/after host load; no production diagnostic logger/timestamp changes. Recheck the same configuration when the competing deployment completes before assigning a production-code cause.

PF01 post-build GREEN1/1: artifactc0f409eb-5240-4e9c-aa99-552dbffec2cf/performance/latency.json. Same exact app/worker/executor image IDs and same1CPU-per-container limits as the first run, no production edits or threshold changes.600/600 accepted and delivered; p95ACK128.52ms, p95first-attempt155.815ms, max265.35ms. Existing metering-fact decomposition: queue-to-claim p9554.293ms, claimed-to-firstHTTP104.279ms, HTTP duration18.304ms. Bulk remains throughout (999→658). Host load before10.83/13.96/15.62 and after12.19/13.54/15.35; this is shared-host evidence, not an exclusive idle-host benchmark. Competing Coolify deployment finished10:19:42UTC before this run. Difference supports contention as a factor without proving it the sole cause; both first failure and passing run are retained.

Coverage hypothesis check: isolated temporary Bun tests with a long synthetic data-URL module versus a normal module both wrote fresh LCOV and passed. Data-URL imports alone therefore do not establish the cause of the full-unit reporting failure; no speculative module-loader refactor was made. Existing80% thresholds remain unchanged and coverage stays open.

Exact installation remote81dc1fd verification: deploymentifz6ql8qshyzhx9ebzeizkd9 finished10:19:42UTC. Owner/viewer normal OTP, safe settings/no credentials, actual DB/executor health, unmeasured worker/SMTP distinction, exactly one connected EventSource retained across client navigation, mobile no document overflow and viewer403/restricted page passed. Screenshot visually inspected. Performance harness static checks and inventory passed; full product56browser/259integration/48unit results remain valid because production sources are unchanged.

RT01 RED: `bun run test:file tests/unit/contracts.test.ts --name 'RT01 event retention'`: expected0, receivedundefined from default server configuration. Added a bounded whole-day operator setting PAYLOADBAY_EVENT_RETENTION_DAYS, default0 (disabled), maximum36500days. No deletion capability yet. Green follows.

RT01 GREEN: complete contracts/configuration unit owner28/28. Retention is disabled by default and invalid operator windows fail safely; no pruning yet. Preparing the existing trusted-job factory to handle maintenance without pretending it is a mail-only abstraction: renamed notificationDeliveryTask/file to platformJobTask/tasks/platform-job.ts and updated real callers, with no compatibility alias and no behavior change. Existing mail/notification owners verify that refactor before the cleanup behavior cycle.

Trusted-job naming refactor GREEN: authentication/mail owner34/34 and notification owner19/19. RT02 RED through that real existing factory: `bun run test:file tests/integration/retention.test.ts --name 'RT02 maintenance'` failed `Old completed and protocol-only records should expire`, actual2 expected0. Added bounded pruning via a dedicated non-login function owner; ordinary event/receipt mutations remain guarded, usage/audit/code are never pruned. Eligible accepted events require old terminal usage facts for every execution; no added completion clock. Database-only cleanup and job completion/audit share one fenced transaction. Producer scheduling, role/race/failure boundaries remain separate pending cycles. Green follows.

RT02 GREEN1/1: aged completed event/replay/receipt/operation/attempt tree and old rejection are removed; queued, recently completed, unproven legacy and accepted-with-missing-work events remain. Code/publication, facts/counters and existing audit survive. Added RT03/RT04 as test-after boundary coverage: default-off behavior, actual non-superuser app/worker role permissions/non-membership, bounded capability/no custom-setting bypass, and lease expiry during a test-only database delay rolling back deletion/audit. No production sleep/logger added; role passwords are generated per disposable test rather than committed credentials.

RT03/RT04 initial boundary run2/3: RT04 proved lease expiry rolls back deletion and audit. RT03 passed its real non-superuser capability/role/batch/ordinary-event guards, then its last assertion incorrectly expected a row-level audit trigger on an empty table. Seeded an actual audit row before that assertion; no production guard changed. Owning rerun follows.

Retention boundary GREEN3/3 after correcting the empty-audit fixture: real app role cannot execute pruning; real worker role cannot become the non-login owner or directly mutate history, even with an arbitrary custom session setting; the capability stays batch/cutoff bounded and does not leave its definer identity behind. Lease expiry during pruning rolls back both deletion and audit. Added separate RT05 concurrency behavior: replay overlaps uncommitted pruning and must return a controlled not_found, not an uncaught foreign-key error. Red follows before any replay locking change.

RT05 RED: real overlapping transactions failed expected not_found, actual PostgreSQL23503 after cleanup committed the event deletion. Replay had read the old MVCC row before its insert acquired a foreign-key lock. Added an event FOR UPDATE recheck after permission/accepted-request checks and before replay-key handling/new work; pruning uses SKIP LOCKED. This serializes the supported outcome without weakening delivery/history semantics. Owning Green follows.

RT05 owning retention GREEN4/4. Tooling TypeScript also caught the new cleanup branch returning its result object where Graphile tasks require void/array; the task now awaits cleanup and returns void, retaining domain result data only for internal maintenance use. Added RT06 as a separate concurrency test: fixture-only RLS/advisory synchronization takes a retention snapshot, commits a real replay before row locking, then checks that newly acknowledged queued work survives. No production instrumentation or timing sleep is used for that snapshot race. Red follows before changing selection/revalidation.

RT06 RED: deterministic fixture-only RLS/advisory synchronization proved actual queued replay deletion in the new unpushed cleanup implementation: expected queued, receivedundefined after a replay committed between selection snapshot and row locking. Split eligibility into a shared read-only predicate used before locking and again in a new statement after locking. The second statement observes committed work while held event locks block further replays. Cleanup explicitly starts READ COMMITTED and the database delete capability rejects other isolation levels; no assumption that a repeatable snapshot becomes fresh. No released/deployed data was involved. Owning Green follows.

RT06 owning GREEN5/5: the committed queued replay survives stale candidate selection; prior permission/atomic-rollback and pruning-wins replay tests remain green. Added RT07 as the next behavior: a full100-event batch must commit exactly one durable continuation, then yield; duplicate old references must not duplicate it and a final short batch stops the chain. Red follows before enqueueing maintenance continuations.

RT07 RED: expected one durable queued continuation after pruning100of101 requests, actual0. Added a fixed-size continuation in the same deletion/audit/job-completion transaction; unique parent-job key prevents duplicates. Results are validated before commit, so an incompatible database result cannot silently complete the job. Maintenance priority is explicitly1000; dedicated offer classification/recovery and startup scheduling are subsequent pending behaviors. Owning Green follows.

RT07 owning GREEN6/6: exactly one continuation is durable after100deletions, duplicate original reference creates none, final short batch stops. Added RT08 to prove maintenance recovery retains priority1000 and a dedicated maintenance flag instead of entering normal email capacity. Red follows.

RT08 RED: recovered maintenance offer priority30 instead of1000. Centralized trusted platform-kind priorities for initial maintenance offers, recovery and retry; enqueue classifies priority1000maintenance offers separately. SMTP/auth priorities remain10/30. Dedicated runner capacity remains the next behavior, not yet claimed. Green follows.

RT08 rerun6/7: priority now correctly1000; the last assertion assumed an array, whereas Graphile's supported jobs view returns a JSON flag map. Corrected the exact representation expectation to {maintenance:true}; the required flag and absence of normal-platform classification remain asserted. No production queue behavior changed for that fixture correction.

RT08 GREEN1/1 after correcting Graphile jobs-view flag representation; complete retention owner later GREEN10/10.

RT10 initial test could not call the absent scheduling entry point (`queueEventRetention is not a function`); this is a missing-entrypoint observation, not a demonstrated behavioral regression. Added a database-clock hourly key scoped by installation and configured window, with atomic job/offer insertion and conflict deduplication. Default0 enqueues nothing. GREEN1/1 proves four concurrent producers create one maintenance job/offer at priority1000.

RT11 initial test could not load the absent producer module; this is a missing-entrypoint observation, not a demonstrated behavioral regression. Added immediate bounded scheduling, a60-second timer only when enabled, and stop/drain lifecycle; wired startup/shutdown into the existing worker. Complete owning GREEN9/9 proves immediate work and no work after stopping. Full worker entrypoint boot remains a separate pending check.

RT09 initial fixture could not resolve the root Graphile dependency; corrected it to the existing worker workspace dependency path (not a behavior Red). Extracted the existing three runner configurations unchanged, then actual Graphile runners reproduced the behavior RED: blocked maintenance consumed the only platform/mail slot and subsequent priority10 work timed out. Added an independent maintenance runner slot in the same process; platform lane excludes maintenance and maintenance lane excludes platform. Complete retention owner GREEN10/10, actual pending platform task completes while maintenance remains blocked. This verifies queue reservation with test tasks, not a fresh SMTP end-to-end claim. All replay-race, immutable-history, rollback, continuation and producer checks remain green. No release migration generated and no retention changes deployed yet.

RT12 test-after characterization GREEN1/1: the real worker entrypoint starts with a synthetic health-only executor dependency, creates and runs a maintenance job and removes the eligible synthetic request without an operator command. No configured script is executed by that health stub. Added source-owned lookup indexes for derived-event, replay-parent and replay-key references; no release migration generation. Existing auth owner GREEN34/34, notifications GREEN19/19 and full unit GREEN49/49. Full backend owner running after these source changes.

Complete backend checkpoint d84144b0-b4b2-48c2-acae-2e106508b281 finished268/270, not a passing full gate. All11retention checks passed. Failures: concurrent Next-backed owners attempted the same shared build, and U152 started draining after a fixed1.5seconds before the loaded database had reliably filled the stream. Added explicit Next-consuming inventory metadata and one parent prebuild before parallel Node owners; product sources remain frozen during runs. U152 now observes removal of its real abort listener (stream cleanup) before draining, then still asserts reader completion and the original340000-byte bound. The test uses the existing short heartbeat option; production streaming and buffer bounds are unchanged. A discarded test candidate used oversized resource identifiers and was rejected by the existing database guard; no guard was relaxed. A pool-query-observer candidate passed but was replaced to avoid depending on exact internal backfill batch counts. Final cleanup-observer scoped U152 GREEN1/1. Complete backend rerun now running.

Worker candidate image built successfully using committed HEAD Dockerfile/ignore snapshots from a temporary directory and current retention sources. Six unrelated Docker/workflow drafts remain untouched and excluded. This is a local candidate build, not a published installation gate.

Coverage reporting investigation: a temporary reporting-only bunfig produced fresh full-unit LCOV (49tests,86.081%lines/87.778%functions), while the original text+LCOV configuration failed to finish/report reliably. Pinned Bun favors configured reporting fields over CLI overrides. The runner now derives a per-run reporting config from the existing bunfig, changes only reporting paths/reporter and makes root paths absolute. It deletes only that run's old LCOV before collection, checks nonempty passing tests, required source loading and existing line/function thresholds explicitly. Root thresholds and source inventory remain unchanged; full-product coverage is still open. https://bun.sh/docs/test/code-coverage documents the LCOV-only threshold caveat, so collector exit0 is not accepted alone.

Coverage threshold-following regression RED: distinct configured line/function minima were rejected as an invalid scalar threshold. Extended the explicit checker to accept independently configured minima and read actual bunfig thresholds instead of hardcoding80%. Existing scalar callers remain supported and invalid minima fail closed. Full coverage Green follows; no source exclusion or threshold reduction.

Fresh explicit unit coverage GREEN: 50/50 tests, 86.100% lines and 87.912% functions across collected unit-loaded sources. The artifact is unique to this run and both configured 80% minima passed independently. Missing required files and below-threshold line/function regressions remain covered. This closes the reporting defect, not full-product coverage.

Coverage correction before commit: the aggregate-only result above is not an accepted coverage gate. Official Bun configuration guidance specifies per-file minima. A new real regression demonstrated the old explicit checker incorrectly accepted a zero-coverage small file behind a 90.9% aggregate. Added per-file checks using the unchanged configured minima, in addition to aggregate/source-presence/nonempty checks. Fresh reporting is fixed, but compiler, notification-contract callback, migration CLI and mail-selection coverage gaps remain open. No weakened gate is committed as passing. https://github.com/oven-sh/bun/blob/main/docs/test/configuration.mdx

Final retention checkpoint backend GREEN270/270 (271.99s) after parent Next prebuild and deterministic slow-consumer cleanup observation. Full unit execution GREEN51/51; coverage command intentionally remains RED on compiler per-file line coverage below80%, with a fresh artifact available instead of stale/missing output. Web/tooling TypeScript, ESLint, Prettier, inventory and diff whitespace pass. Candidate worker image builds with committed Dockerfile/ignore snapshots. Retention default remains disabled. Retention settings display/live invalidation and published-image install/upgrade/restore are not claimed complete.

Retention follow-up IH02 RED: authorized installation settings omitted the retention window (undefined instead of default0). Added the bounded public contract field and safe configuration projection; owning configuration GREEN3/3. The native installation view displays the disabled/default window, without exposing credentials or adding an inline action form.

RT14 RED: actual committed pruning produced0 live changes instead of one affected-project invalidation. Added events.pruned to the typed live contract and database whitelist. The bounded deletion capability captures affected projects only after fresh locked eligibility validation and emits one payload-free project change per affected project inside the same transaction. The retention role receives EXECUTE on the existing append function without a direct change-table grant. Owning retention GREEN12/12 includes unrelated-project exclusion and lease-rollback invalidation checks. Dashboard event/overview consumers subscribe through the existing single authorized stream.

RT15 browser RED: actual cleanup removed the row and closed the open inspector, but incorrectly displayed an Events error toast for expected404 history expiry. Consolidated detail/payload failure handling, cleared stale inspector/attempt state and treated missing retained history as a normal transition; other failures still report errors. Scoped browser GREEN2/2 (RT15 and IH01). Native390px installation capture inspected; added a second capture focused on the configuration/retention fields for the upcoming complete run.

RT16 RED: a real Pacific/Auckland database session crossing a dynamically selected daylight-saving offset pruned both boundary samples, including the event30minutes younger than its configured elapsed-day window. Changed only cutoff/minimum-bound arithmetic from calendar-day intervals to exact24-hour intervals. No clock mocking or database timezone prerequisite. Complete retention owner GREEN13/13; normal configured window and both race-order safeguards remain green. No local release migration generated. Complete browser run follows after static checks.

Node coverage diagnostic only: built-in Node coverage ran the existing U242 executor owner without new dependencies. Its function/source positions need parity validation before merging with Bun LCOV; this is not accepted as full-product coverage evidence. GitHub repository currently lists no Actions secrets, so licensed final CI must configure the authorized installer credential before its trusted build can run.

Retention follow-up complete backend GREEN272/272 (260.53s); complete browser GREEN57/57 (4.4min interactions,464.33s including cold build/setup). The mobile configuration capture initially missed its target; strengthened IH01 to require the retention label and value actually in the viewport, reran that owner GREEN1/1 and inspected the corrected capture. No mobile scrolling defect is asserted from the earlier screenshot. TypeScript, ESLint, formatting and inventory remain passing. Shared fixture prebuild now also covers declared deployment-image and performance consumers so cold jobs cannot depend on another lane having already built the app; owning cold CI verification remains pending.

Remote da305ff checkpoint: Coolify deployment1h3a8hyugcyp8wolfplwucx1 finished2026-10-17 11:36:22UTC. Existing normal owner/viewer OTP, safe installation metadata, actual DB/executor health, shared EventSource across navigation, mobile containment and viewer denial smoke passed. Temporary helper still printed an old81dc1fd label; corrected that local-only label and rechecked deployment metadata remained da305ff. New retention UI/daylight-saving changes are still local until the follow-up push.


CI policy CI02 RED: a failed GitHub API command with partial `true` output authorized external code when only the output was checked. The shell now checks API exit status before interpreting protection. Owning CI-policy GREEN6/6 covers absent policy, failed lookup, immutable source, internal automatic path and authorization-before-checkout DAG. Actionlint and embedded Bash syntax pass. This is local workflow verification, not a claim that cold cloud CI or coverage passes.

Central policy source PR https://github.com/payloadbay/.github/pull/30 declares only Core's external environment; scoped live dry run reports only that missing reviewer policy, with managed files current. Existing App-token workflow dry run pending. No live environment policy is manually applied.

Remote e9724c7 checkpoint: Coolify deployment lmzbcfk6wfxfu4nti9kef3gl finished2026-10-17 12:11:14UTC. Normal owner/viewer OTP, safe installation configuration, actual DB/executor health, explicitly unmeasured worker/SMTP health, single EventSource across navigation, mobile containment and viewer denial smoke passed against this finished version.


First cold GitHub Alpha Validation run39033237063: static and executor passed; unit tests51passed but the known per-file compiler coverage gate correctly failed. Backend/browser/performance/deployment stopped before test execution because the shared source build helper invokes rg and GitHub Ubuntu runners do not provide it. Added an explicit ripgrep prerequisite only to those owners; no product behavior or thresholds changed. HeroUI installer succeeded in all applicable clean CI jobs using the encrypted secret. The original failure remains cloud evidence, not a product test failure.


Source-map collector follow-up: built-in Node LCOV's compiler function positions were wrong (compile17instead ofsource23). Disposable c8@12.0.0 probe correctly mapped compile23/inspect122. Added pinned development-only c8 and opt-in collection on the existing Node/executor/deployment owner invocation; no performance instrumentation or thresholds changed. CV01 actual canary initially produced no records because generated-file filtering happened before remapping; --exclude-after-remap corrected it. A later assertion assumed minification restored original function names; corrected that fixture expectation to verify source declaration lines3/7, distinct generated identities, exact1/0hits and two functions/onecovered instead. CV01/CV02GREEN2/2 prove source positions, uncalled body, original failing exit7 and removal of raw V8 caches. The original missing-collector entry point is not credited as a behavioral Red. Full-product merging is still open: Bun exposes counts without per-function identities, so adding those counts to V8 is not valid. Production compiler child environment remains unchanged.


Cold CI run39033406697at ef479c4completed all non-coverage owners successfully: static; real executor28; backend272; browser57; deployment21from committed Dockerfiles; performance1with600/600delivered, ACKp95116.789msand first-attemptp95131.701ms/max258.514msunder a1000-item bulk seed. The overall workflow correctly fails only its known unit per-file coverage gate. This closes the prior local-Docker-draft limitation for those candidate tests, not published operator release gates.

First local compiler-owner collection produced9/11passing: U240/U243hit their unchanged5scompiler deadline while a Coolify build was active. Filtered LCOV was still generated and failure status preserved; this is not passing test evidence or proof the reporter alone caused the timing failures. No compiler boundary/timeout was relaxed. Raw V8 caches now use unique OS-temporary paths outside uploads even on abrupt process death; CV01/CV02againGREEN2/2verify the actual reported raw directory is removed. A temporary fixture-string typo was corrected before this Green and is not credited as a product regression. Cold CI collection of the existing Node/executor/deployment owners follows; full-product threshold merging remains open.


Mapped cloud owners at `7fa7da0` (run `39034217843`) all non-coverage GREEN:
backend 274 (including the two source-map canaries), executor 28, deployment 21,
browser 57, performance 1 and static. Artifacts contain 110 backend, 15 executor
and 54 deployment source records without raw V8 directories. The unit per-file
gate remains failing; no invalid aggregate/function-count merge is credited.

T083 navigation refreshed from 317 code files, 43 documents and seven canonical
copied brand assets: 1,723 nodes, 5,557 edges and 89 curated communities. Initial
44 scaffold nodes were replaced on source re-extraction. Graphify's declared SQL
parser was installed in its own tool environment, with no product dependency.
Actual diagnostics retain 19 dangling raw references, 158 coalesced same-endpoint
edges, 12 self-loops, six exact duplicates and one valid inline-TypeScript parser
gap. GRAPH_REPORT.md discloses these limits; no complete call graph is claimed.
Semantic token usage is unavailable, not zero/free or invented. An intermediate
shrink guard refused the incremental cleanup. Audited removed IDs, then used a
full corpus rebuild to avoid partial import-alias drift. Temporary export-script
string errors were corrected and are not product regression evidence.

Reference search proved only the obsolete status helper/package commands used
the Supabase CLI. Removed that unused dependency, helper and commands; retained
historical planning and synthetic schema-history evidence. Corrected scaffold-era
README/web/agent status, package paths/aliases and contributor sign-in instructions
(plain optional note, no demo selector). Web/tooling TypeScript, ESLint and formatting
pass after cleanup. No release migration or operator release is claimed.


Coordinated startup compatibility RV01/U241: real restricted executor health
initially omitted protocolVersion (actual U241 RED undefined != 1). The actual
worker reached an HTTP200 health response advertising unsupported protocol2,
but stayed running (RV01 RED null != 1). This is behavioral evidence, not a
missing-entrypoint failure. Shared protocol/SDK/date constants now drive health,
compiled-stage validation and workerd configuration. The bounded validated probe
runs before recovery, runners and producers. Unsupported/missing metadata fails
startup with a safe message. Public installation projection still reports only
readiness/mode, not host attestation.

GREEN: affected complete configuration3/3, executor-client3/3, retention13/13
and full real executor28/28. Earlier scoped U241/RV01 also passed. The RV01
server is health-only fixture data, not runtime/isolation proof; U241 uses the
actual restricted image. Local image tests still use the six preserved Docker
drafts; cold committed-source CI follows. This verifies startup compatibility,
not per-RPC hot replacement, published pending-job upgrade or backup/restore.
No release SQL was generated and no timeout/coverage threshold was relaxed.


Release packaging RI01/RI02: added a separate non-root one-shot migration image
using the locked domain dependency graph, no licensed installer or runtime source
push. It refuses absent CI release SQL. Actual restricted-image tests apply an
explicit synthetic historical fixture, verify auth/queue/domain initialization
and unchanged migration digests on a second run. This new packaging had no
pre-existing executable entrypoint; no fabricated behavioral Red is claimed.

Real PostgreSQL17 archive round trip preserves binary event bytes, queued jobs,
pinned publications, encrypted credentials and immutable-code triggers. Initial
fixture command lacked pg_restore's required --dbname; corrected as a test-command
error. A stronger ownership assertion then caught actual --no-owner behavior:
retention function owner became fixture instead of payloadbay_retention (RED).
Removing that flag preserves original ownership and PUBLIC execute denial.
Complete owner GREEN2/2; TypeScript/ESLint/inventory pass. Archive tests restore
an empty database in the same disposable cluster, whose roles already exist;
cross-host role provisioning, published installation and release rollback remain
open. No production data, generated release SQL or host Docker configuration used.
The six unrelated Docker/workflow drafts remain unstaged.


Coverage function identity follow-up: standard filtered Istanbul JSON is retained
alongside LCOV; raw V8 caches remain outside uploads and are removed. Pinned
development-only istanbul-lib-coverage3.2.2 merges source locations. Real
complementary canaries cover distinct functions without doubling the total;
repeated reports retain the uncovered function and empty reports fail. Initial
CommonJS named-import error was a tooling interop mistake. The stronger repeat
check found the library mutates caller-owned maps (expected1covered, actual2);
cloning report data before merging fixes it. Complete CV01–CV03GREEN3/3.

Complete backend collection276/276 produced111source records. Its selection
predates the new runtime-login tests and later queue policies; it is not final
whole-checkout evidence. Adding an unreferenced domain source during that run
invalidated the conservative Next fingerprint and triggered an extra rebuild
inside coverage. Keep runtime source frozen through future shared build owners.

Executor coverage twice produced26/28 with unchanged U240/U243compiler deadlines,
including a rerun after competing builds ended. A controlled U240 plain run
passed while its covered counterpart timed out. Installed Node22.23.3's own
child_process source explicitly propagates NODE_V8_COVERAGE even with an env
allowlist. RX01 actual child-process RED observed coverage=true while a separate
parent canary remained absent. Explicit empty NODE_V8_COVERAGE at compiler/workerd
spawn boundaries denies this implicit inheritance; no parent diagnostic value
is forwarded and no timeout is increased. RX01GREEN and complete covered
executor29/29pass. This corrects the earlier assumption that PATH-only env
automatically prevented coverage inheritance. Full-product/browser aggregation
and per-file threshold completion remain open, not inferred from merged totals.

Remote906e0b5deploymenth9t03yjvry5iaxqtsotpg4zcfinished13:33:56UTC: normal
owner/viewer OTP, safe settings, actual DB/compatible executor health, factual
worker/SMTP unmeasured states, one SSE,390px containment and viewer denial pass.
The preview-only Coolify login banner is present in rendered login. Cold97648ba
run39037012993passed backend/executor/browser/deployment/performance. Static
failed three logical-section blank lines introduced in final restore assertions;
those are corrected. Unit tests pass but per-file coverage still fails.


Operator packaging follow-up: deploy/compose.yml now uses only explicit prebuilt
image references, persistent PostgreSQL, one-shot migration, separate app/worker
logins and no executor database/auth/SMTP credentials. PostgreSQL health waits
for the final TCP listener; app startup requires actual worker broker health.
The migrator can transactionally provision/rotate distinct non-administrative
runtime logins. Weak/shared passwords, administrative attributes and unexpected
role memberships fail; a rejected second role rolls the first password change
back. Passwords stay outside URLs through standard PGPASSWORD.

Basic SQL grants alone initially passed, but the actual Graphile consumer
returned0processed after private-table RLS denied insertion (RED42501). Added
worker-only policies on Graphile's four private RLS tables; no global BYPASSRLS
or schema ownership is granted. Complete runtime-login ownerGREEN2/2 includes
real queue consumption, denied DDL/migration history/cross-role access, quoted
credentials and atomic/unsafe-membership checks. Initial queue-test fixture
errors (wrong workspace import, connectionString overriding explicit password)
were corrected; they are not product regression Reds.

The real packaged migrator provisions the logins and stays idempotent. Fresh
cluster restore later exposed PostgreSQL17 grantor attribution when a different
bootstrap administrator was used. Preserve the original bootstrap identity;
PostgreSQL documents its duplicate CREATE ROLE as expected. The test accepts
only that exact stderr line, rejects every other roles-restore error, and keeps
strict archive restore. Complete migration/recovery/Compose ownerGREEN4/4.

Existing A1 now runs Next with the restricted app login and sends its real queued
SMTP code with the restricted worker pool; concurrent setup still completes one
verified owner. Scoped A1GREEN and complete installation API owner12/12pass.
Database/migration16/16 and retention13/13pass after the queue policy change.
TypeScript/ESLint/Prettier/inventory pass at the packaging checkpoint.

Updated operator/recovery/quickstart/release documents and stale bootstrap
manifest. Historical images remain labeled bootstrap evidence; published image
digests and release SQL remain absent. Standard PostgreSQL container tooling
replaces a host backup-script runtime. No release SQL generated, no protected
Docker/workflow draft staged, and no published install/upgrade is claimed.


RX02 existing compiler-contract coverage: reserved/invalid helper bindings,
non-async default lifecycle exports and forbidden host re-exports now have
explicit behavioral assertions; scoped real compilerGREEN1/1. These cover
previously implemented rejection paths, not a newly fixed bug or claimed Red.
Using the standard source-location merger on passing backend276, executor29
and scoped RX02 reports gives compiler238/283lines(84.09%) and8/8functions.
The prior merged report was220/283lines(77.73%). This closes that source gap
without weakening80%, but is not a full-product/browser/CI coverage gate pass.

## Source-mapped browser and merged-owner gate — 2026-10-17

At committed793f206, clean CI39040287137 passed static, backend278/278,
executor30/30, deployment25/25, browser57/57 and performance1/1. Unit51/51
assertions passed but the unit-only per-file coverage gate remained failing.
No alpha release was certified.

Coverage now has explicit test-only Next browser/server source maps, a distinct
build-cache identity, filtered first-party Chromium source counters and graceful
Next shutdown so server V8 counters flush. Ordinary builds keep maps disabled.
The initial real OTP browser run captured client files but only38 server source
records; after canonicalizing the scoped webpack namespace and terminating
Next gracefully, the same flow captured252 server source records including API
routes. This is collection evidence, not a product correctness regression Red.
The complete browser owner passed57/57 with collection enabled. TypeScript,
ESLint and Prettier passed at this checkpoint.

CV01–CV08 pass: actual complementary mapped function locations merge without
count duplication; unit summaries cannot override a mapped missing function;
missing executable runtime source fails; pure declarations are excluded; dirty,
partial and cross-revision provenance is rejected. New CI07 plus the existing
six authorization checks pass: missing/failed/skipped/cancelled merged coverage
cannot produce final success. The merged gate keeps the existing80% per-file
line/function requirement and original explicitly required sources, inventories
all executable app/package sources and the shipped migration entrypoint, and
requires complete clean reports from the same SHA. Unit collection runs once;
Bun-only records are used only for files without a mapped report, never summed
with incompatible function identities. Full current-owner collection and clean
CI remain pending. Local WIP reports are diagnostic and marked dirty; they do
not certify release readiness. No production logger, generated release SQL,
protected Docker draft or alpha merge is part of this change.

Additional uncovered-entrypoint contracts now pass: RX03/RX04/RX05 use the actual
compiler stdin and executor HTTP source entrypoints, including byte-preserving
wire data, auth, malformed requests, dry-run and actual local managed broker
responses, rejected deliveries, child result/log bounds, bounded admission,
cancellation and timeout. Covered scoped ownerGREEN3/3; compile-child1/1,
compile-RPC4/4 and server2/2 mapped functions execute. These trusted host-process
contracts complement restricted-image/isolation owners; they do not attest a
host sandbox. RI07/CV09 source CLI ownerGREEN2/2 exercises real PostgreSQL install,
repeat runs, restricted role provisioning, safe failures and isolated temporary
Git staged-history policy. Historical fixture SQL remains explicit; no ordinary
release migration is generated. New paths exercise existing behavior, so no
product regression Red is claimed. Unit ownerGREEN51/51 after adding realistic
multi-message/case-insensitive OTP selection assertions. Current strict tooling
TypeScript, ESLint, Prettier and inventory pass; the full source-mapped backend
owner remains in progress and clean CI has not yet run for this change.

The complete current backend owner subsequently passed283/283 with source maps
and coverage collection enabled (395.30s test duration, build prepared outside
the instrumented invocation). This is local dirty-tree evidence, not clean
cross-owner release provenance. Complete executor30/30 also passed under
collection before the added scoped entrypoint tests; final clean inventory now
includes those additional contracts. Browser57/57 remains the complete browser
checkpoint for this collector implementation. No runtime source changed during
the full backend run.

## Exact clean1608a02 checkpoint

CI39044376419 completed at1608a02: static, backend285/285, executor33/33,
deployment26/26, browser57/57, unit51/51 and performance1/1 pass. Downloaded
metadata verifies clean, complete exact-SHA ownership for all five coverage
lanes. The mandatory merged gate correctly fails:209/241 measured files meet
80% per-file line/function minima;32 gaps remain. No alpha completion is claimed.
Current performance evidence delivers600/600, no failed requests, ACKp95
126.627903ms, first-attemptp95159.678ms/max213.308ms under1,000bulk seed jobs.
These numbers belong to this run, not the earlier source checkpoints.

The subsequent coverage inspection exposed discarded hard-navigation counters
for a passkey flow that functionally passed. Two attempted network-interceptor
collectors failed hydration; those approaches are not retained. A continuously
running profiler with snapshots before explicit test navigation avoids modifying
requests/cache behavior. The first such real passkey flow completed but failed
report teardown: structuredClone strips live FileCoverage.toJSON and leaves an
invalid data wrapper. CV03 now covers live map serialization; JSON cloning fixes
that failure and all8 coverage canaries pass. Scoped browser confirmation and
full final owner remain pending at this log point. No production logger added.

Prepared manual candidate publication is master-only and requires current
CI-generated SQL plus exact successful master alpha CI. Its actual Git policy
checks pass5/5, and shell syntax passes. It builds four non-root images and must
apply packaged release SQL twice before any push. It has not been executed or
published; branch SQL generation remains forbidden. New real Node contract
checks pass2/2 for UTF-8 budgets, strict methods/fields and scoped token selectors.
Initial settings recovery browser owner passes3/3; further targeted recovery and
cancel/draft checks are added but not yet verified.

Continuous-profiler passkey confirmationGREEN: the original registration/sign-in/
removal browser case passes, and the actual registration function at source
line54 now has counter1 (previously0). No request interceptor, cache modification
or deadline increase is retained. Expanded settings ownerGREEN9/9 covers real
organization conflict recovery/search, notification/job/installation/audit/usage/
passkey retries, scope-preserving cancellation and email draft/reset behavior.
Its first run8/9 had an incorrect expectation of visible brand text when the
configured logo correctly exposes that name as alt text; asserting the actual
image/source and draft footer fixes the test without changing product code.

The complete unit owner remains authoritative for its two pure runner modules,
policy.ts and runtime.ts, declared statically in coverageSourceOwners. Incidental
partial Node calls must not force duplicate execution of their existing Bun
assertions. Runtime production files continue using merged source locations;
other Bun-only files remain disjoint fallbacks. New canaries prove selection
never chooses the higher percentage and missing authoritative evidence fails.
No threshold, runtime source inventory or complete-owner provenance is waived.
Full corrected browser/clean final CI are still pending at this checkpoint.

## Clean383031a checkpoint and next coverage corrections

CI39046596007 at383031a completes the functional owners: unit51/51,
backend287/287, executor33/33, deployment31/31, browser66/66 and
performance1/1. All five coverage owners carry clean, complete exact-SHA
provenance. Mandatory coverage remains RED:218/241 files satisfy80% per-file
line/function minima. This is not release completion; published-image operator
installation/upgrade remains independent and unpublished.

Further actual scoped checks pass for the broker HTTP/auth/body-size contract,
terminal expired/exhausted OTP leases, U105's real executor HTTP processing path,
and authorized persisted email-settings reads. No runtime behavior was changed
for those checks. CV13 first fails because c8's default test filename glob hides
the production contracts/script-test.ts module. Explicit dependency/declaration
excludes retain the owned-source whitelist without treating that production
filename as a test. The actual Node request-contract owner then passes2/2.

Coverage function identity uses authored, unique explicit function declarations
only. A real esbuild transform canary reconciles generated __name helpers and
named-function offsets; nested same-name functions remain distinct. CV14 exposed
an unsafe inferred-name merge for reassigned callbacks (1 function instead of2).
The corrected normalizer preserves inferred/ambiguous/minified records and all14
coverage canaries pass; tooling TypeScript and ESLint pass. This does not claim
perfect reconstruction of anonymous/minified functions: installed V8-to-Istanbul
omits unnamed native function entries, and coincident one-line source locations
can remain ambiguous. Unknown records are retained rather than guessed away.

The merge command now requires its own checkout clean as well as verifying the
source revision and complete owner provenance. Mixed local diagnostic reports
remain diagnostics only, never release evidence. Current full backend coverage
and expanded browser interaction verification are pending at this checkpoint.

Concurrent local unit collection is RED48/51: U11 exceeded the existing5s
compiler test deadline; U14 and editable method dispatch then observed a stopped
esbuild service. This ran during fresh Next build preparation. Contention is a
hypothesis, not a proven root cause; the same complete owner must run alone
without increasing deadlines. This failed invocation is not coverage evidence.
The actual scoped2/2 Node report now contains the previously excluded production
packages/contracts/src/script-test.ts source record. New browser assertions cover
rule thresholds/severity/cooldown/destination persistence, helper export selection,
API-key cancellation/expiry and scoped collection creation/filter/cancellation;
these are pending actual browser execution.

Full local backend owner GREEN295/295 with source collection after the collector
changes. This invocation loaded live-api before LS01 was appended; the subsequent
actual LS01 cancellation/capacity check passes1/1. Complete unit owner rerun alone
is GREEN51/51 in3.46s under the unchanged deadline. The earlier concurrent48/51
failure remains recorded; no timeout was increased. These dirty local reports
remain diagnostic; clean exact-SHA CI is still required. Expanded browser cases
are now executing serially against the frozen test build.

Scoped browser verification: UX50 collection creation/filter/cancellation passes1/1;
U83 helper cancellation and selecting only named exports passes within an initial
1/2 invocation. U305 in that same invocation failed because getByLabel selected
all three HeroUI NumberField input/decrement/increment controls. Correcting the
test to the actual textbox role makes U305 pass1/1, including persisted threshold,
window, cooldown, severity, recovery and selected destination, then cancellation
and disabling. K01 API-key scope selection, actual saved7-day expiry, cancellation
of revocation and eventual bearer denial passes1/1. No product change was needed
for these selector corrections. Final owned-change ESLint, Prettier and test
TypeScript pass; all tests remain registered. Complete clean CI remains pending.

## Exact clean a7d4e76 and remaining UI interactions

CI39050305378 at a7d4e7665fb45f7740883c70611a884562a7e2af passes static,
unit51/51, backend296/296, executor33/33, deployment31/31, browser67/67 and
performance1/1. Downloaded provenance is clean, complete and exact-SHA for all
five coverage owners. Mandatory coverage remains RED233/241: eight UI files
need complete function coverage. No release is certified.

Further local browser checks pass2/2 for catalog-created notification modules,
keyboard publication, pause/enable, active-version rollback, real queued email
test, and overview outage recovery/tooltip values. Initial module tests used an
incorrect return-link label, then asserted navigation before the real compile/
publish response; both are corrected using the actual link and HTTP completion.
Expanded event scope/version filters, replay cancellation/single/bulk actions,
helper keyboard revisions/middleware settings and synthetic method/header/secret/
log filters pass3/3. The initial event-version selector incorrectly assumed a
native HTML select; the retained test uses HeroUI trigger/option roles.

Member cancellation passes in a1/2 invocation. Its unsaved-reload case observed
the actual beforeunload prompt but consumed the test budget waiting for an
intentionally dismissed navigation. Giving only that cancelled reload action a
bounded3s wait (no deadline increase) makes the full dry-test/keep/edit/Escape/
explicit-discard case pass1/1, with stored draft unchanged.

The route version-pin case initially published the intentionally rejecting new
route default and observed its legitimate plain-text503. Its fixture now explicitly
configures acceptance before publication; keyboard-save/rollback/queued-pin
verification and final member/code controls remain pending at this log point.
These are tests of existing behavior, not invented test-first product changes.

Final route version-pin browser case is GREEN1/1: the configured accepting handler
acknowledges202, keyboard-save persists processing draft2, clipboard contains the
actual receiving URL, activating publication1 leaves the accepted event and queued
execution pinned to publication2. The fixture also corrected its initial unquoted
If-Match value, which properly returned428. Final U292 code settings are GREEN1/1
including committed numeric edits and closing/reopening a clean helper editor.
An initial Escape was sent before the asynchronous editor request opened the
modal; waiting for the actual dialog fixes the test. U63 member cancellation
passed in the preceding1/2 invocation; the unrelated code test failure is retained,
not retroactively declared a passing complete owner.

Coverage-integrity CV15 is an actual RED1!==2 for a coincident function name in a
disjoint authored source range. Requiring authored-name uniqueness and overlapping
source ranges makes all15 canaries GREEN. A first overly strict start-line check
also kept genuine duplicate webpack records: clean maps for saveEmailSettings
span26–42 while its declaration spans29–52. Requiring interval overlap preserves
that observed compiler layout while disjoint names remain separate. This is not
perfect anonymous/minified reconstruction; previously documented mapper limits
remain. ESLint expands the new four-property mapping fixtures as required.

Local mixed diagnostics now pass240/241; the remaining member file lacks counters
from its passing case because its containing invocation failed another case.
Those partial results are deliberately not promoted to complete-owner evidence.
The unchanged mandatory clean-CI gate remains authoritative; new clean full browser
and all owning lanes are pending. No80% threshold or executable inventory changed.

Original protocol acceptance now has one actual public HTTP case covering
A6/A8/A9/A11. Both local invocations pass1/1 with real Next, workerd, pinned encrypted
signing secret and PostgreSQL: exact plain-text challenge, no challenge processing,
bad-HMAC401 with retained rejected request, valid binary202 with durable work,
and scheduling-outage500 with no partial acceptance records or leaked SQL/secret.
The final invocation copies Node Buffers into owned Uint8Arrays for fetch's strict
BodyInit types; TypeScript and ESLint pass. This tests existing product behavior,
not a newly invented Red cycle. Final complete deployment owner remains pending.

The preflight now maps all20 original acceptance criteria to actual entrypoints.
It keeps source fixtures distinct from published-image certification, and exposes
operator-specific LAN/Tailscale/domain/tunnel reachability as installation evidence
rather than treating URL acceptance alone as a full physical-network test.

## Exact clean9046ae2 checkpoint

CI39052054695 is fully GREEN at9046ae25c96484e70f5aab438840b77489c63c8d:
static, unit51/51, backend297/297, executor33/33, deployment31/31, browser70/70,
performance1/1 and mandatory merged source coverage241/241 under unchanged80%
per-file minima. Downloaded provenance for all five owners is clean, complete
and exact-SHA. This closes the source coverage gap, not unpublished operator gates.
Exact performance is600/600, zero failures, ACKp9556.522463ms, first-attemptp95
60.212ms/max132.363ms with1,000 seeded bulk jobs and the unchanged4CPU host/oneCPU
container fixture. No new production optimization or SLA is inferred.

Only source acceptance checkboxes supported by the completed whole owners are
closed in tasks.md. Published operator A1, deployment-specific A14, the added
HTTP protocol case's complete deployment invocation and release/upgrade gates
stay open. The planned notification-unit placeholder is reconciled to existing
real-PG U168/U175/U176/U177 coverage; no actual test or owner is removed. Inventory
and its19 tooling tests pass. Historical Red cycles are not fabricated from a
retrospective passing test.


## Subsequent db2fb3e availability failure — investigation open

CI39053349674 passes static checks and complete owners unit51/51, backend297/297,
executor33/33, deployment32/32 and browser70/70. This includes the added public
A6/A8/A9/A11 protocol case. Performance fails its unchanged zero-failure assertion:
one of600 requests did not receive the expected acknowledgment, with599 measured
deliveries. ACKp9584.736426ms, first-attemptp9583.725ms/max247.664ms remain within
the latency limits, but do not excuse the availability failure. Coverage merging
was skipped; this run is not described as a passing coverage checkpoint.

The original benchmark retained a failure count without HTTP/transport details.
It cannot establish the failure cause or whether an unacknowledged request
committed. Two local repetitions pass600/600 with unchanged deadlines and no
request retries; these are reproduction attempts, not proof of remediation.
T054 is reopened. The existing latency.json test artifact now retains sanitized
request sequence/status/public error code/correlation ID/timing and bounded
transport error classifications, plus aggregate database and ingress outcomes.
No raw response bodies, private payloads, credentials or production logger are
added. No production runtime change is justified by the evidence so far.

The current master merge brings only the synchronized agent baseline and source
metadata into this existing alpha branch. It neither merges the alpha into master
nor changes the six unrelated local Docker/migration drafts.

A third local repetition fails a different unchanged target: all600 requests
receive202 and all600 deliver, but first-attemptp953713.417ms exceeds2000ms
(max3919.350ms; ACKp95289.606ms). The retained artifact is
`test-results/85093bd3-38c7-4167-97ae-5a8bdb89ca62/performance/latency.json`.
Queuep953607.356ms dominates claim-to-attemptp95220.158ms and receiver
HTTPp9539.517ms. PostgreSQL reports zero deadlocks and one rollback; host load
is21.39/15.82/14.92 before and19.78/16.33/15.15 after on16 logical CPUs. These
observations narrow that latency symptom to queue wait, but do not establish
its cause or explain the original CI acknowledgment failure. No thresholds,
request retries or production concurrency were changed. TypeScript, ESLint,
Prettier and diff whitespace checks pass for the benchmark reporting changes.

The fourth local reproduction at effbdf7 also accepts/delivers600/600, zero HTTP
failures and zero database deadlocks, but fails latency: first-attemptp95
16031.598ms/max16446.260ms, queuep9515911.437ms, claim-to-attemptp95293.071ms
and HTTPp9551.402ms. ACKp95 remains585.762ms. This violates both the2s p95 and
10s maximum targets (the earlier assertion stops at p95). Host load moves from
23.16/18.74/16.24 to29.74/21.70/17.47 on16 logical CPUs. Artifact
`test-results/da1e1b9c-2269-44df-9f5d-345b29654558/performance/latency.json` is
retained. The increasing shared-host load is a possible contributor, not a
proven sole cause. Additional identical local runs are paused while the clean
CI performance owner finishes; no passing-vote or threshold change is used.


## EX34 native executor bind collision

Inspection found a concrete startup race: the supervisor bound an ephemeral
TCP port, closed it and later asked workerd to rebind that released port. A
deterministic fault-injection test reclaims the released port before startup.
The first fixture kept synthetic accepted sockets open and cancelled during
cleanup; that is not credited as a product Red. After correcting the fixture to
close its synthetic connections, the unchanged product fails EX34 with actual
`runtime_startup_failed` (one failed test, no cancellations).

The installed native workerd supports `--control-fd=3` and experimentally reports
`listen`/`http` with its actual bound ephemeral port. Production now binds port
zero directly in workerd and reads that bounded native control channel before
its existing health probe. No free-port release/rebind window remains; malformed
or absent notifications cannot select an arbitrary fallback port. Existing
execution deadlines, network bridge policy, credentials and resource limits
remain unchanged. EX34 becomes GREEN1/1. Complete executor, TypeScript/lint and
real HTTP validation are in progress.

This proves the collision bug and its local fix; the original db2fb3e failed
request had no status/error classification, so attribution of that CI failure
to this race is unproven. Clean effbdf7 performance independently passes600/600:
ACKp9581.296ms, first-attemptp9585.157ms/max240.788ms, zero deadlocks. It predates
the race fix and is not evidence that the new runtime has passed clean CI.

EX34 complete local executor owner passes34/34 (46.4s); real executor HTTP owner
passes3/3 (24.9s), including binary preservation and incompatible-runtime refusal.
TypeScript, ESLint, formatting and whitespace checks pass. Downloaded effbdf7
CI39055051450 provenance is clean/complete/exact for all five owners, and coverage
is241/241; this is the prior source, not the new runtime fix. The unrelated local
draft diff checksum remains93399599d5b523f77e6e626195efda4816325b5dd9788e94f538366d0684bb11.
The SpecKit profile now separates current product/coverage commands from its
historical bootstrap-only evidence, with mutation strength explicitly unmeasured.
