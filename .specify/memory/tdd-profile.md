---
detected_at: '6223754'
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
