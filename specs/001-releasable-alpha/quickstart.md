# Quickstart and validation guide

## Current runnable scaffold

From Core root with the installed licensed HeroUI artifacts:

```bash
bun install --frozen-lockfile
bun run web:typecheck
bun run web:lint
bun run web:build
bun run web:dev
```

Clean Pro installation requires local HeroUI CLI login or CI HEROUI_AUTH_TOKEN; install may relocate/remove licensed artifacts, so verify imports and restore through official installer. Bun is package manager; app scripts explicitly run Node. This workspace needs child-process permissions for full Next build; this is environment permission, not passing behavioral tests. To run built standalone output use bun run web:start (HOSTNAME/PORT configure binding). Build prepares local CSS/fonts. Theme source/checksum matches canonical brand/theme.css. Never expose auth/build credentials in client or image layers.

Verified before this planning run: typecheck, lint, production build and standalone HTML/CSS smoke. This command updates documentation, not app behavior. No running durable/auth/worker product implied by shell.

## Required foundation before full-flow checks

Bootstrap now supplies real fixture/image, unit/Node/workerd/browser commands and a verified TDD profile (see docs/deployment/bootstrap.md). Product migrations, full release build, sandbox and acceptance proofs remain tasks. Do not invoke absent product commands or claim an empty selection is a pass. Use local synthetic payloads and disposable Postgres/SMTP/HTTP fixtures; no production credentials. Operator deployment uses prebuilt published images, not Node/Bun installation on host.

## Executable scenarios once tooling exists

1. Clean image installation and migrations, configured local SMTP, concurrent owner bootstrap; exactly one owner, code login, no public signup.
2. Instance/workspace/project preset/custom grants; negative list/detail/payload/token/SSE checks and no privilege escalation.
3. Create project/endpoints/destinations; body-editor compile/test/publish both stages, helper/middleware bindings, signature/policy errors and rollback without mutating old runs.
4. Send exact JSON/binary fixtures; verification rejection, protocol-only challenge, commit rollback, acceptance followed by actual tracked delivery.
5. Healthy critical events under replay/email/cleanup backlog: 10/sec for60s, p95 ack<=1s, acceptance-to-first-attempt<=2s, no critical wait>10s on documented fixture.
6. Destination offline: acknowledgement still follows commit; bounded retries/exhaustion preserve histories; restore/replay creates new execution; successful-event replay supported.
7. Pause/resume: ingestion continues; new sends pause, inflight may finish; retained backlog drains at bounded destination concurrency.
8. Kill child and whole worker/executor container; after replacement services healthy, orphan work claimable<=60s. Inject DB partition and suspend old process; fresh generation rejects stale sends/results. HTTP remote-success/local-result-loss remains duplicate window.
9. SSE reconnect/backfill/gap/resync and permission revocation; Scalar requests local API with scoped token, schemas/docs match actual errors.
10. Executor forbidden imports/processes/files/secrets/network/forged IPC/resource abuse; siblings and ingress capacity survive within declared limits.
11. Pending-job publication/config upgrade, forward migrations, backup/restore, redaction/retention and image compatibility.

## Test execution owners

See plan.md section14. Whole-file/scenario inner loop has no coverage overhead; affected routes broaden when uncertain; final lanes isolated by DB/ports/resources. Reuse JUnit/coverage artifacts, verify source/test inventory and deliberate threshold failure. Production Node tests cover Bun-runtime differences. Acceptance route paths are planned, not currently implemented scripts.

## Release blockers

CI Pro token remains absent. Real SMTP/operator configuration needed for live login. Worker/executor resource/recovery tests and versioned image pins remain unimplemented. Validate standard-container protections; test optional runsc separately and fail early if explicitly selected but absent. Do not publish raw licensed library artifacts/credentials; verify built image distribution against license. Tasks and verified bootstrap TDD profile/list now exist; product suites remain pending.
