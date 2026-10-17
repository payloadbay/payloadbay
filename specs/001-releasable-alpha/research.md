# Phase 0 research: confirmed programmable alpha

Research date 2026-10-13. Decisions below distinguish installed evidence, proposed design and release verification. No product implementation performed by this command.

## R1. Integrated application and current scaffold
Decision: preserve approved Next.js/Node.js, PostgreSQL/Drizzle, Better Auth and Graphile architecture. Installed web pins Next16.4.0/React19.3.0/TS5.9.3/Tailwind4.3.3; explicit Node scripts and Webpack standalone output. @/* maps src/app/* and @types maps src/app/types.ts.
Rationale: complete product deployment and source-of-truth API; plain scaffold already validated.
Alternatives: Supabase remains technically viable but not selected; no second backend implementation. Server Actions not used as public command protocol.
Evidence: source apps/web/package.json/tsconfig/next.config, recorded lint/typecheck/build/standalone HTTP smoke. https://nextjs.org/docs/app/guides/self-hosting .

## R2. API/live documentation
Decision: shared server-only services, Zod validation/OpenAPI, locally bundled Scalar and one authenticated SSE stream with durable authorized cursor/backfill.
Rationale: one command contract for browser, SDK and later MCP; push changes separate from mutations. Durable records prevent loss of NOTIFY hints.
Alternatives: next-ws patch/WebSocket not required for one-way updates; no duplicated Action/API implementations.
Sources: https://nextjs.org/docs/app/api-reference/file-conventions/route and https://scalar.com/products/api-references/integrations/nextjs .

## R3. Queue and recovery ownership
Decision: Graphile job consumption with event/job transaction; product Execution generation/lease governs broker calls/results. Running-lease/overdue-unclaimed-offer recovery creates fresh generation-specific Graphile dispatch, leaving old unknown/live locks alone. Confirmed dead child IDs may be unlocked through supported administration.
Rationale: Graphile documented hard-crash cleanup can take >=4h. Reusing a locked named queue would block fast replacement. Missing heartbeat proves lost authority, not process death. Journal identities and fencing preserve domain recovery while acknowledging external HTTP duplicate windows.
Alternatives: private Graphile table mutation/heartbeat-only force unlock rejected; queue engine not rebuilt or silently replaced. BullMQ PostgreSQL exists but is not selected.
Sources: https://worker.graphile.org/docs/library/add-job , https://worker.graphile.org/docs/admin-functions , https://worker.graphile.org/docs/error-handling . Lease/generation/replacement-dispatch design is Payload Bay's engineering inference, not a library guarantee. Mandatory whole-container/partition/concurrency tests must prove it.

## R4. Prompt healthy delivery
Decision: continuous consumption, reserved ingress/critical-delivery/mail capacity, priorities, independent destination concurrency and backlog age metrics. Fixture targets p95ack<=1s, accepted-to-first-attempt<=2s, maxcriticalwait10s at10events/sec for60s; orphan dispatch<=60s after services healthy.
Rationale: fast receipt alone does not activate paid features promptly. Priority cannot preempt occupied workers.
Alternatives: periodic batching or acknowledgement-only benchmark rejected. No production/global edge SLA claimed.
Source: https://worker.graphile.org/docs/techniques . Thresholds are selected acceptance targets, not measured results.

## R5. Script stage/editor/ABI
Decision: immutable generated signatures and editable bodies for two endpoint stages, Monaco plus typed helpers/shared-module bindings; compiler result/source-map checks on server. Tagged accept/reject/respondOnly and complete/retry/fail contracts, stable managed send identity.
Rationale: prevents renamed hooks breaking invocation; isolates provider response from worker delivery and makes action journals feasible.
Alternatives: giant fully editable lifecycle file, provider-specific SDK primitives, static imports inside function body and arbitrary JS continuation rejected. Future extra cleanup hooks remain deferred.
Source: https://github.com/microsoft/monaco-editor . Specific wrapper/ABI is our product design, not a Monaco built-in restriction.

## R6. Workerd executor and host isolation
Decision: maintainer confirmed self-hosted workerd for configured ingress/processing scripts. Fresh process per execution, frozen TypeScript bundles, restricted service bindings and capability broker; Node stays the application/trusted-job runtime. Approved default is ordinary restricted Docker; optional host gVisor/runsc is a deployment choice, not an installation prerequisite. PAYLOADBAY_EXECUTOR_RUNTIME defaults to runc; explicit missing runsc fails creation without fallback. Direct fetch is supported alongside tracked destination sends. No Docker socket or per-email-job sandbox.
Rationale: established Workers engine, web APIs/WebCrypto and selectively supported Node APIs fit event handling; self-hosting requires no Cloudflare account. Workerd alone is explicitly not a hardened sandbox; runtime restrictions and ordinary Docker limits cannot establish defense against engine escape. We integrate an existing host sandbox instead of implementing a hypervisor.
Alternatives: Deno dropped following announced support horizon; QuickJS requires more web API plumbing; node:vm is not a security boundary. Hosted Cloudflare adds isolation layers not supplied by the standalone binary. Full npm/native compatibility is not promised.
Evidence: disposable local workerd1.20261013.1/esbuild0.28.2 probe passed TS compilation, valid/invalid raw-body HMAC, plaintext response, backend binding/result and global outbound denial. No production dependencies changed; no gVisor/isolation/durability proof. Foundation must verify nested Coder support, whole-process termination, per-run resources/sibling availability, broker fencing and deployment latency. Missing optional runsc does not block standard mode; selecting unavailable runsc fails before execution, never downgrades. Trusted publishers are required; hostile-tenant isolation is not advertised.
Sources: https://github.com/cloudflare/workerd , https://developers.cloudflare.com/workers/runtime-apis/nodejs/ , https://gvisor.dev/docs/ , https://gvisor.dev/docs/user_guide/quick_start/docker/ , https://deno.com/blog/cloudflare .

## R7. Auth, permissions and email
Decision: Better Auth SMTP email OTP default, signup/passwords disabled, bootstrap secret + verified email, admitted scoped invitations, env-enabled supported OAuth; positive grants inherit instance/workspace/project and tokens intersect current permissions.
Rationale: requested passwordless experience and small role presets with customizable permissions; owner/membership/auth identity are distinct.
Alternatives: blanket Community global-admin behavior and automatic domain isolation by auth library rejected. No unverified-email account linking. Magic links/password toggles and broad enterprise identity integrations later.
Sources: https://better-auth.com/docs/plugins/email-otp , https://better-auth.com/docs/plugins/organization , https://nodemailer.com/smtp . Clipify source config.ts, mcp-options.ts, permissions.ts and organization-access.ts verified the scoped permission/OAuth pattern; do not copy provider/billing roles.

## R8. Brand/Pro and delivery packaging
Decision: HeroUI Pro1.0.0-beta.10 with required base packages, canonical brand/theme.css export snapshot/provenance and local Inter5.3.0. Published Docker roles share release manifest; no runtime theme/font CDN.
Evidence: authenticated MCP/CLI; Sheet/Command import and SSR smoke; apps/web theme source metadata matches /home/coder/brand/theme.css. DESIGN frontmatter matches saved system; PRODUCT embedded assets preserved. Theme https://heroui.pro/ds/8f0da332-3e6b-432a-be89-469be673b68b .
Rationale: brand repository remains single source of truth; consuming app copy builds without sibling checkout.
Alternatives: OSS-only downgrade, raw Pro source vendoring, automatic live asset fetch and silently regenerated brand documents rejected. CI HEROUI_AUTH_TOKEN still absent; require build-secret configuration and validate image contents against licensed distribution terms.
Sources: https://heroui.pro/docs/react/getting-started/installation and https://heroui.pro/terms .

## R9. Testing and version evidence
Decision: Bun unit/component candidate; real Node/Postgres/executor/image/browser lanes, scoped whole-file inner loop, affected feedback, single final execution owner and reusable coverage/report artifacts. Verify actual runner before TDD profile.
Rationale: avoid Clipify's redundant suite/report work while preserving complete inventory and meaningful Red evidence. Bun docs describe unenforced statement threshold and LCOV-only gate pitfalls; do not falsely promise all coverage metrics enforced.
Alternatives: second reporting framework merely for terminology and Bun-only production compatibility claims rejected.
Source: https://bun.com/docs/test/code-coverage . No performance comparison or product tests currently run.

Registry-resolved proposed pins (not installed/verified): graphile-worker0.18.0, better-auth1.7.7, drizzle-orm0.45.4, drizzle-kit0.31.11, pg8.23.1, zod4.6.7, @scalar/nextjs-api-reference0.12.10, monaco-editor0.57.0, @playwright/test1.64.0, nodemailer10.1.0. Exact PostgreSQL17/executor image patches/digests and dependency compatibility are foundation tests; no fictional registry digests supplied.

## Phase 0 conclusion
All product choices resolved; Phase 1 model/contracts/quickstart now substantive. Remaining implementation proof includes executor restrictions/resources, whole-container generation recovery, latency/coverage enforcement and release/migration checks. No unresolved product clarification or constitution exception; no tasks/TDD profile fabricated.

## R10 — Confirmed icon library (2026-10-14)

Decision: use `@tabler/icons-react`, confirmed by the user. Its broad outline/filled catalogue and adjustable outline stroke suit the dashboard and notification severity states. Use static imports bundled with the application; default to outline, reserving available filled variants for emphasis. Package installation and actual component checks belong to UI implementation. Sources: [Tabler catalogue](https://tabler.io/icons), [official React package](https://github.com/tabler/tabler-icons/tree/main/packages/icons-react).

## R11 — Organization, local usage and policy foundation (2026-10-16)

Decision: add Organization above Workspace before release; implement local
organization-owned metering, policy and capacity foundations now, commercially
unlimited by default on self-hosted. Separate payment/license activation from
runtime capabilities and separate metering from telemetry and billing.
Rationale: organization lineage and stable usage identities need to exist before
released data depends on the old hierarchy. n8n provides useful local-policy,
retained-statistic and atomic resource-quota patterns, but not a drop-in hostile-
tenant SaaS control plane or a matching commercial policy.
Alternatives: delaying every foundation task to H01, copying commercial n8n code,
a separate hosted fork, a single ambiguous retry-inflated execution counter.
All rejected. Detailed evidence and source links:
[research-n8n-foundation.md](research-n8n-foundation.md).

No unresolved foundation question remains about tenant hierarchy: the maintainer
selected Instance → Organization → Workspace → Project. Prices, paid capability
catalog, billing provider and production hosting topology remain deliberately
outside this foundation rather than guessed implementation requirements.
