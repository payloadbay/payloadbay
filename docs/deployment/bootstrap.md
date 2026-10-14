# Tooling bootstrap

This checkout has tooling and a Next.js shell, not the releasable alpha. Product storage, authentication and delivery are upcoming tasks.

From the Core root:

```sh
bun install --frozen-lockfile
bun run web:build
bun run test:inventory
bun run test
bun run test:file tests/unit/tooling.test.ts --name "known dependencies select owning whole files"
bun run test:affected scripts/tests/policy.ts
bun run test:coverage
bun run sandbox:check
```

The final command uses default runc and passes. Set PAYLOADBAY_EXECUTOR_RUNTIME=runsc to test optional gVisor; absent runsc then fails before container startup without downgrade. Development tests require Docker access and permission to bind local ports. Browser tests require the built standalone app, Playwright Chromium and its OS libraries; the current workspace has them installed. Normal CLI commands run on Linux/Windows when Docker is available; no Bash/PowerShell helpers are required. The host workerd probe selects the platform binary through the package's published resolver. Docker images are Linux builds.

Test ownership is explicit in tests/config/inventory.json. Every discovered test must be registered; missing or unowned files fail. The 15 planned product suites are separately listed as unimplemented, never silently counted as passes. Register new suites as behavior work adds them. Bun owns unit cases; Node owns real PostgreSQL/SMTP/HTTP and workerd checks; Playwright owns browser interaction; Node owns image smoke. Each final suite runs once in that lane. Named selection rejects zero matching tests. Affected feedback uses esbuild local import graphs and broadens to all implemented files on unknown changes/analysis failure.

Fixtures use a unique Compose project, synthetic credentials, ephemeral PostgreSQL storage, random loopback ports, and finally-block teardown. No production data or external SMTP endpoint is involved. Browser ports/artifacts are unique per runner invocation. Console artifacts and run summary are under ignored test-results/<run-id>; browser JUnit/trace output is reused. Unit coverage writes coverage/unit/lcov.info. The current required coverage source is tooling policy only, with 80% lines/functions and explicit missing-source checks. Product files are not yet covered. Extend the coverage inventory with each production slice; do not cite this bootstrap percentage as product coverage. No branch/statement coverage guarantee or mutation/property tool is claimed.

Application Docker targets: `smoke` packages the local verified standalone output; `app` builds from source using a BuildKit `heroui_auth_token` secret and official Pro installer. CI HEROUI_AUTH_TOKEN is not configured here, so the clean licensed build target has not passed; local CLI login is not copied into images. Worker image/entrypoint awaits trusted worker implementation. Executor image is runtime feasibility only. deploy/release-manifest.json records actual dependency/image pins and these limitations. No images have been published.

TDD setup/planning follows the scoped bootstrap. Constitution already requires test-first behavior, so no amendment or hook disablement is needed. The complete bootstrap suite is its current green baseline; the alpha's acceptance cases remain pending. Product implementation requires the task-specific foundation proofs, including default-container capability/resource protections; optional gVisor compatibility is separate.
