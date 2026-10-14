# Current implementation preflight

## Verified bootstrap

Next.js/Node web in apps/web/src/app, requested aliases, HeroUI Pro, canonical local theme/fonts, lint/typecheck/build and standalone HTML/CSS remain verified. Planned alpha packages are installed/pinned in owning Bun manifests; deploy/release-manifest.json records actual image digests and limitations. Tooling TypeScript check passes.

`bun run test`:13 passed,0 failed across5 implemented bootstrap files, measured20.94s. Bun9 tooling assertions; Node real PostgreSQL17 rollback, Graphile migration/job, Drizzle, SMTP/HTTP fixture check; Node local workerd feasibility; Playwright production Pro sheet; Node non-root standalone/runtime image smoke. Fixtures are synthetic, uniquely isolated and torn down. No product workflow acceptance is credited.

Known single-name selection executes exactly1 test; unmatched Bun/Node selections exit1. Inventory rejects missing/unowned files. Affected selection uses local import metadata and broad fallback. Unit coverage policy currently reports100% lines/functions for scripts/tests/policy.ts only, with80% required; missing required source and an actual under-covered Bun fixture fail. Product coverage is unmeasured. Initial fixture/import/browser-library problems were setup failures, not meaningful Red evidence. Tooling policy assertions failed against a loadable stub before implementation, but several infrastructure cases were exercised together; no formal alpha TDD cycles credited.

Verified TDD profile: .specify/memory/tdd-profile.md. Feature test-list now has20 pending acceptance behaviors,180 pending inner behaviors and1 existing shell characterization after the notification design extension. cycle-log contains baseline only. Tasks preserve85 original IDs and add18 acceptance gates (114 total including the11 pending notification tasks). T001/T003/T004/T005/T006 complete with this evidence. T002 partial: local image targets/fixtures pass, clean licensed CI build and trusted worker image pending. T006 verified2026-10-14: default runc check passes, explicit unavailable runsc fails before container creation. Actual gVisor execution remains unverified. No host daemon configuration changed or fallback security claim made.

## Pending product and release work

Domain migrations, login/authorization, public API/Scalar/SSE, durable ingress/processing/recovery, middleware/editor/dashboard, product tests and published images are not implemented. Pro CI HEROUI_AUTH_TOKEN remains absent; clean image build requires BuildKit secret heroui_auth_token. No credential is copied into source/image layers. Real SMTP/operator secrets are deployment inputs; tests use fixtures.

Default container/capability/resource validation must pass before configured-code release. Optional gVisor compatibility requires separate evidence; standard mode requires trusted publishers and does not promise hostile-tenant isolation. Runtime-only local probe/image cannot satisfy them. Graphify index predates current architecture and stays marked stale; verify source.

## Next stage

$speckit-implement can start foundation implementation now. The remaining clean licensed CI build needs the HeroUI build secret, and the trusted worker image follows worker implementation; both remain image/release gates. Optional gVisor is not a default-installation prerequisite. `$speckit-implement` invokes mandatory `$speckit-tdd-run` against the verified profile/list. Do not disable that hook, claim empty product suites passed, or reinitialize SpecKit. See docs/deployment/bootstrap.md and executor.md for runnable tooling and scope.
