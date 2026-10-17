---
detected_at: '6223754'
current_source_checkpoint: '017cd69'
current_release_gate: 'published-images-and-migration-automation'
ecosystems:
- typescript
default: typescript
stacks:
  typescript:
    cwd: .
    runner: 'Bun orchestrator: Bun unit / Node test / Playwright'
    single: bun run test:file {file} --name "{name}"
    file: bun run test:file {file}
    suite: bun run test
    watch: null
    coverage: bun run test:coverage
    mutation: null
    acceptance: bun run test:file {file}
    property: null
    approval: null
    contract: null
    test_glob: tests/**/*.test.ts; tests/acceptance/*.spec.ts
    exemplar:
      unit: tests/unit/tooling.test.ts
      integration: tests/integration/fixtures.test.ts
      executor: tests/executor/feasibility.test.ts
      acceptance: tests/acceptance/bootstrap.spec.ts
      deployment: tests/deployment/images.test.ts
    helpers:
    - scripts/tests/fixtures.ts
    - tests/config/inventory.json
    - tests/config/playwright.config.ts
    - scripts/tests/run.ts
verified:
- single
- file
- suite
- failure-output
- coverage
- acceptance
suite_baseline: green
suite_seconds: 20.94
---

# Verified TDD stack profile

## Current implementation profile — 2026-10-17

The original bootstrap evidence below is historical. Product suites now exist
across unit, backend, executor, browser, deployment and performance owners; the
bootstrap counts, missing-credential note and unimplemented-product statements
below must not be used as the current application status.

The runner still uses the commands in the frontmatter. `bun run test` includes
performance; run `bun run test:performance` separately from other local owning
lanes when diagnosing latency. Node runs two owning files concurrently, while
performance runs one. Unknown/unregistered or empty selections fail. All artifacts
live under `test-results/<run-id>/<owner>/`, including unit LCOV under
`unit/coverage/lcov.info`; do not use stale reports from an earlier invocation.

`bun run test:coverage` is the unit-only feedback gate, not full product coverage.
For source-mapped collection, use `bun scripts/tests/run.ts <owner> --collect-coverage` for each of unit/node/executor/browser/deployment. The merge
command is `bun run test:coverage:merge <artifact-directory>`. It requires a clean
checkout and one complete, clean, exact-SHA artifact from each owner, then checks
the complete executable runtime inventory plus required sources against the
unchanged80% per-file line/function minima. Mixed/dirty partial local reports are
diagnostic only. Private browser/server maps belong to the test build, not the
operator image. Coverage percentage does not measure mutation strength.

Clean9046ae2 CI39052054695 passed unit51, backend297, executor33, browser70,
deployment31, performance1 and merged coverage241/241. Later db2fb3e
CI39053349674 passed all functional owners (deployment32), but failed performance
availability; its coverage merge was skipped. Local subsequent latency failures
also remain recorded. Clean effbdf7 CI39055051450 subsequently passes all owners and241/241 coverage;
its performance result does not explain the preceding failure. The native bind-race
fix now passes complete clean017cd69 CI39056043199: unit51/backend297/executor34/
browser70/deployment32/performance1 and coverage241/241. Published-release
automation and operator acceptance remain separate open gates. Refer to the
feature preflight/cycle log for the latest outcome; do not treat the earlier green
checkpoint as closure of a subsequent failure.

Mutation tooling remains null and no independent final TDD audit is claimed.
Historical test-first evidence is not invented from retrospective acceptance
passes. Published-image install/upgrade/restore, optional host runsc, and physical
Android keyboard behavior remain separate gates. Licensed CI installation now
works through the configured secret; never copy a credential into these records.

## Maintainer UX and hosted-access follow-up — 2026-10-17

Actual Red evidence: mobile Overview was absent; publication-table UX53 could not
find its grid; U116 could not find the delivery-attempt selector; HT01 inherited
platform rights into hosted customer scopes; HT02 exposed customer audit activity.
The strengthened mobile assertion also reproduced a current breadcrumb ending
at 401px beyond its 374px container. Native HeroUI item sizing was corrected.

Scoped Green evidence: authorization20/20, organizations23/23 and organization
policy7/7. Eleven distinct browser flows pass across the scoped runs: U116, U83,
U300, U157b, UX54, U265, U301, U292, mobile overview/hierarchy, UX53 and K01.
The final four-flow run rechecks geometry, helper/script editing and native paste
against the completed source. ESLint, web/tooling TypeScript and changed-source
Prettier pass. HT03 verifies actual customer invitation, pending/accepted rights
and revocation for a hosted staff account; it confirms an existing invitation
path rather than claiming an invented Red cycle.

Low-level Playwright insertText left JSON delimiter debris; real clipboard paste
and the actual HTTP echo flow pass. The speculative select-all override was
removed. No editor test backdoor, production logger, relaxed timeout, generated
release migration or unrelated Docker/workflow draft was introduced. This scoped
review does not replace the previous complete clean-CI checkpoint above. Public
hosted certification, instance middleware trust policy, physical Android input
and published release acceptance remain separate work.

## Historical bootstrap profile

The root TypeScript entrypoint dispatches each file to its explicit owning runner. Bun never replaces production Node integration. All five exemplar files/helpers were read and run. HEAD6223754 plus current uncommitted bootstrap files; refresh after runner changes.

## Conventions

- Unit: bun:test test/expect, tests/unit/*.test.ts. tooling.test.ts pins inventory, selection and coverage safety.
- Integration/executor/deployment: node:test and node:assert/strict through tsx. fixtures.test.ts uses actual PostgreSQL, Graphile migrations/job execution, Drizzle, SMTP and byte-exact HTTP. feasibility.test.ts is a temporary workerd process, not sandbox proof. images.test.ts checks non-root container startup.
- Browser: Playwright test/expect against accessible roles. bootstrap.spec.ts characterizes the existing HeroUI Pro sheet, not login/delivery. Build the standalone web app first; browser fixtures use production, not dev HMR.
- Reuse scripts/tests/fixtures.ts withFixtures: unique Compose project, ephemeral data, synthetic SMTP credentials, random loopback ports and finally teardown. No production/shared database allowed.
- Register every new file in tests/config/inventory.json before starting its Red cycle. Missing/unowned files are setup errors, never Red. Keep the planned product inventory until its real suites are implemented. Use tests/config/playwright.config.ts for unique browser ports/artifacts, scripts/tests/run.ts for verified selection.

## Evidence and limitations

13 bootstrap tests passed, 0 failed; wall time in frontmatter. No alpha acceptance is implemented. Current unit feedback is about15ms; complete bootstrap about21s. Use owning whole files without coverage in the inner loop; full inventory at completion. Single named command ran exactly1 test; unmatched Bun/Node names exited1. Unknown dependencies broaden to all registered tests. Reports/JUnit/traces reuse ignored test-results/<run-id>; unit LCOV is coverage/unit/lcov.info.

Coverage currently measures scripts/tests/policy.ts and scripts/tests/runtime.ts only: reported100% lines/functions, required80%. Missing/unloaded required source and under-threshold samples fail. An actual under-covered Bun fixture exits nonzero with text+LCOV. Extend required sources with product implementation; no product-wide or branch/statement coverage guarantee. First missing-module run was broken setup, not Red. Bootstrap policy initially exercised several cases together; no formal alpha TDD cycle is credited for that infrastructure work.

Mutation/property/approval/dedicated contract tools are absent and null; use boundary examples and later deliberate-mutant samples. Watch unverified/null. No DOM unit harness claimed; UI tests currently use a real browser. This is one unified root test stack, not a claim of implemented tests in every workspace.

Docker access/local-bind permissions required in this restricted workspace. gVisor/runsc absent: default sandbox:check passes; explicit runsc fails deployment with no fallback. This does not block the approved trusted-publisher standard Docker mode. Clean CI licensed build needs heroui_auth_token BuildKit secret/CI HEROUI_AUTH_TOKEN, currently absent; local CLI login is never copied. Standalone app smoke/runtime-only executor images pass; trusted worker image awaits implementation.

Constitution2.2.0 already mandates test-first behavior; no amendment or hook disablement applied. See docs/deployment/bootstrap.md and executor.md for actual scope and limitations.

## Implementation fixture refinement

Node files are limited to two concurrent owning files. Within each process, disposable PostgreSQL/SMTP/HTTP containers are reused; each fixture callback receives a fresh database, SMTP/HTTP state resets, callbacks serialize and containers tear down in node:test after hooks. No shared production data or credentials. Owning file and single-test commands are unchanged.
