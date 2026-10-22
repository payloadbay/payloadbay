# Graph Report - payloadbay  (2026-10-17)

## Corpus Check
- 367 files · ~249,444 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .css 2, .toml 2)

## Summary
- 1723 nodes · 5557 edges · 89 communities (68 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Semantic token usage: unavailable from delegated tool results; no token-cost or savings claim

## Community Hubs (Navigation)
- Route commands and parameters
- Protected script API
- Permissions and invitations
- Test runners and browser fixtures
- Dashboard shell and feedback
- Authentication and owner setup
- Domain schema and lineage
- Script editor and formatting
- Historical foundation fixture
- Client data and loading
- Script editor and formatting
- Event listing APIs
- Web package dependencies
- SQL retention and roles
- Web package dependencies
- Delivery replay and recovery
- Container delivery and latency
- Authentication integration tests
- Script lifecycle SDK
- Notification delivery and rules
- Container delivery and latency
- Notification delivery and rules
- Web TypeScript aliases
- Database tooling commands
- Executor wire and supervision
- Web runtime packages
- Ingress and executor integration
- Operational guidance and review
- Request contracts and tokens
- Live event inspection
- Scoped middleware and changes
- Resource setup and onboarding
- Membership management screens
- Live event inspection
- Test TypeScript aliases
- Workspace package metadata
- Specification and release evidence
- Organization policy controls
- TypeScript compilation contracts
- Installation settings and health
- Ingress and executor integration
- Application layouts and invitations
- Authentication and owner setup
- Worker database and retention
- Notification delivery and rules
- Development test dependencies
- Code publication and testing
- Workspace package metadata
- Resource setup and onboarding
- Worker mail dependencies
- OpenAPI and Scalar
- Zod response contracts
- Historical expansion fixture
- Web development packages
- Request contracts and tokens
- Scoped API key management
- Notification delivery and rules
- Contract package exports
- Resource parameter validation
- Request contracts and tokens
- Job queue administration
- Immutable organization usage
- Scoped notification rule screens
- Worker database and retention
- SDK package exports
- Web build commands
- Notification delivery and rules
- Resource parameter validation
- Historical runtime role fixture
- Core agent guidance
- Tailwind PostCSS configuration
- Local API guidance
- Context navigation principles
- Executor deployment modes
- Email brand artwork
- Dark rounded icon
- Transparent dark icon
- Dark rounded wordmark
- Transparent dark wordmark
- Padded dark wordmark
- Padded light wordmark
- Canonical brand provenance
- Measured latency evidence
- Native preview trust policy

## God Nodes (most connected - your core abstractions)
1. `AppError` - 170 edges
2. `protectedRoute()` - 144 edges
3. `requirePermission()` - 98 edges
4. `transaction()` - 89 edges
5. `uuid()` - 86 edges
6. `api()` - 81 edges
7. `readJson()` - 77 edges
8. `useFeedbackToast()` - 61 edges
9. `LoadingState()` - 51 edges
10. `useDashboard()` - 47 edges

## Surprising Connections (you probably didn't know these)
- `Native named/default @shared module imports, Monaco types and immutable revision pins` --semantically_similar_to--> `Master CI generates one release migration; feature branches use disposable db:push`  [INFERRED] [semantically similar]
  docs/ux-review-2026-10-16.md → packages/domain/drizzle/README.md
- `Implemented foundation and outstanding release gates` --semantically_similar_to--> `Synthetic schema upgrade fixtures`  [INFERRED] [semantically similar]
  specs/001-releasable-alpha/preflight.md → tests/fixtures/schema-history/README.md
- `seedPreviewDemo()` --indirect_call--> `compile()`  [INFERRED]
  packages/domain/src/preview-demo.ts → apps/executor/src/compiler.ts
- `seedPreviewEndpoint()` --indirect_call--> `compile()`  [INFERRED]
  packages/domain/src/preview-demo.ts → apps/executor/src/compiler.ts
- `seedPreviewEndpoint()` --indirect_call--> `execute()`  [INFERRED]
  packages/domain/src/preview-demo.ts → apps/executor/src/supervisor.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Separate design, behavior evidence and published-release certification** — specs_001_releasable_alpha_preflight_verification_checkpoint, specs_001_releasable_alpha_tdd_cycle_log_verification_ledger, specs_001_releasable_alpha_tdd_test_list_test_ownership, specs_001_releasable_alpha_tasks_implementation_tasks [INFERRED 0.95]

## Communities (89 total, 21 thin omitted)

### Community 0 - "Route commands and parameters"
Cohesion: 0.06
Nodes (53): dynamic, GET(), PUT(), runtime, dynamic, GET(), PATCH(), runtime (+45 more)

### Community 1 - "Protected script API"
Cohesion: 0.08
Nodes (50): POST(), PUT(), dynamic, POST(), runtime, dynamic, POST(), runtime (+42 more)

### Community 2 - "Permissions and invitations"
Cohesion: 0.11
Nodes (41): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, GET() (+33 more)

### Community 3 - "Test runners and browser fixtures"
Cohesion: 0.08
Nodes (33): unverifiedHttpTemplate, unverifiedTemplate, @playwright/test, composeReleaseMigration(), before, created, canGenerateReleaseMigrations(), migrationPolicyViolations() (+25 more)

### Community 4 - "Dashboard shell and feedback"
Cohesion: 0.13
Nodes (27): nextConfig, Invitation, OnboardingStatus, KeyMetadata, Context, DashboardState, LoadingStateProps, Notice (+19 more)

### Community 5 - "Authentication and owner setup"
Cohesion: 0.06
Nodes (40): authRoute(), dynamic, GET, POST, runtime, dynamic, failure(), GET() (+32 more)

### Community 6 - "Domain schema and lineage"
Cohesion: 0.04
Nodes (45): admission, admissionWindowCounter, apiToken, audit, authRequestWindow, bytes, changeRecord, customerOnboarding (+37 more)

### Community 7 - "Script editor and formatting"
Cohesion: 0.08
Nodes (30): CodeEditor(), mount(), CodeEditorProps, Helper, HelperImportPicker(), insert(), show(), HelperImportPickerProps (+22 more)

### Community 8 - "Historical foundation fixture"
Cohesion: 0.09
Nodes (40): active_notification_condition, event_endpoint_time, execution_recovery, grants_by_scope, immutable_audit, immutable_event, immutable_publication, immutable_receipt (+32 more)

### Community 9 - "Client data and loading"
Cohesion: 0.09
Nodes (31): InvitationPage(), accept(), LoginPage(), OnboardingPage(), AuthPanel(), requestCode(), submit(), AuthPanelProps (+23 more)

### Community 10 - "Script editor and formatting"
Cohesion: 0.08
Nodes (32): ScriptingGuide(), useUnsavedChanges(), EmailSettingsPage(), act(), save(), Rendered, Settings, Binding (+24 more)

### Community 11 - "Event listing APIs"
Cohesion: 0.08
Nodes (29): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, GET() (+21 more)

### Community 12 - "Web package dependencies"
Cohesion: 0.05
Nodes (38): dependencies, better-auth, @better-auth/passkey, drizzle-orm, graphile-worker, nodemailer, @payloadbay/contracts, pg (+30 more)

### Community 13 - "SQL retention and roles"
Cohesion: 0.07
Nodes (16): immutable_audit, immutable_endpoint_parent, immutable_event, immutable_notification_channel_revision, immutable_organization_parent, immutable_policy_revision, immutable_project_parent, immutable_publication (+8 more)

### Community 14 - "Web package dependencies"
Cohesion: 0.06
Nodes (33): better-auth, @better-auth/passkey, drizzle-kit, drizzle-orm, eslint, eslint-config-next, nodemailer, @payloadbay/contracts (+25 more)

### Community 15 - "Delivery replay and recovery"
Cohesion: 0.17
Nodes (21): POST(), startHeartbeat(), startRecovery(), unlockObservedChild(), processEventTask(), claims, mintBrokerToken(), Authority (+13 more)

### Community 16 - "Container delivery and latency"
Cohesion: 0.14
Nodes (14): prepareDevelopmentDatabase(), docker(), Fixture, removeInfrastructure(), serial, start(), stopFixtures(), withFixtures() (+6 more)

### Community 17 - "Authentication integration tests"
Cohesion: 0.20
Nodes (15): permissions, bootstrapOwner(), recordUsage(), authFixture(), AuthFixtureData, fixtureConfig(), identity(), setupSecret (+7 more)

### Community 18 - "Script lifecycle SDK"
Cohesion: 0.09
Nodes (28): createBroker(), verifyBrokerToken(), canonical(), httpTarget(), managedSend(), assertAuthority(), Body, DestinationTarget (+20 more)

### Community 19 - "Notification delivery and rules"
Cohesion: 0.17
Nodes (21): startRetentionProducer(), cleanupTask(), notificationMessage(), MailPayload, PlatformJob, platformJobTask(), finish(), retry() (+13 more)

### Community 20 - "Container delivery and latency"
Cohesion: 0.12
Nodes (12): createExecutor(), execute(), port(), workerdConfig(), appRoot, standaloneRoot, source, CoverageOptions (+4 more)

### Community 21 - "Notification delivery and rules"
Cohesion: 0.14
Nodes (24): POST(), dynamic, GET(), POST(), runtime, dynamic, GET(), POST() (+16 more)

### Community 22 - "Web TypeScript aliases"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+21 more)

### Community 23 - "Database tooling commands"
Cohesion: 0.07
Nodes (29): scripts, db:check-migration-policy, db:generate, db:generate:ci, db:migrate, db:push, format, format:check (+21 more)

### Community 24 - "Executor wire and supervision"
Cohesion: 0.14
Nodes (20): compileIsolated(), cleanup(), fail(), executor, server, ExecutionError, dynamic, POST() (+12 more)

### Community 25 - "Web runtime packages"
Cohesion: 0.07
Nodes (28): dependencies, better-auth, @better-auth/passkey, drizzle-orm, @fontsource-variable/inter, @heroui-pro/react, @heroui/react, @heroui/styles (+20 more)

### Community 26 - "Ingress and executor integration"
Cohesion: 0.10
Nodes (23): ExecuteOptions, ExecutionResult, boundedPatchBody, bytes, event, ingressDecision, ingressMiddlewareDecision, metadata (+15 more)

### Community 27 - "Operational guidance and review"
Cohesion: 0.08
Nodes (15): Implemented alpha web app: HeroUI Pro, Better Auth OTP/passkeys, authenticated domain Route Handlers, shared SSE and local Scalar, Disposable PR demos: per-PR database, shared synthetic identities, normal OTP/Mailpit and native maintainer deployment approval, Coolify previews: native maintainer deployment policy and PR-source builds; historical failure notes, Development bootstrap: implemented alpha services, owning test lanes and open coverage/release gates, Event retention: disabled default, fenced bounded cleanup and project live invalidation, Organization usage: local immutable measurements, admission policy and fair worker capacity, Permissions: current inherited grants, scoped hashed tokens and renewable 30-day sessions, Approved reusable UI/UX principles: context, command palette, bounded dialogs and complete task verification (+7 more)

### Community 28 - "Request contracts and tokens"
Cohesion: 0.15
Nodes (23): bindings, codeScope, middlewareBindingInput, middlewareOrderInput, middlewareUpdateInput, sharedCopyInput, sharedVersionInput, activationInput (+15 more)

### Community 29 - "Live event inspection"
Cohesion: 0.11
Nodes (17): Attempt, AttemptDetail, decode(), Detail, EventBrowser(), replay(), EventPage, Execution (+9 more)

### Community 30 - "Scoped middleware and changes"
Cohesion: 0.21
Nodes (21): GET(), PATCH(), GET(), POST(), compileSource(), requirePermission(), BindingInput, checkOrigin() (+13 more)

### Community 31 - "Resource setup and onboarding"
Cohesion: 0.20
Nodes (15): dynamic, GET(), runtime, rolePermissions, provisionCustomerOrganization(), RegistrationPolicy, assertResourceCapacity(), dashboardOverview() (+7 more)

### Community 32 - "Membership management screens"
Cohesion: 0.15
Nodes (12): useDashboard(), Invitation, labels, Member, MemberManager(), AccountPage(), addPasskey(), MembersPage() (+4 more)

### Community 33 - "Live event inspection"
Cohesion: 0.13
Nodes (17): DashboardShell(), Context, kinds, Listener, LiveKind, LiveState, LiveSubscription(), useLiveSubscription() (+9 more)

### Community 34 - "Test TypeScript aliases"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, paths (+13 more)

### Community 35 - "Workspace package metadata"
Cohesion: 0.10
Nodes (20): esbuild, eslint, eslint-config-next, nodemailer, pg, prettier, @types/node, typescript (+12 more)

### Community 36 - "Specification and release evidence"
Cohesion: 0.13
Nodes (17): Plan readiness checklist, Scoped user-issued API keys, API-first application and authorized live transport, Forkable notification channels and branded email, Two-stage TypeScript script lifecycle and executor ABI, Organization lineage, metering and local policy, Alpha domain data model, Consolidated alpha implementation plan (+9 more)

### Community 37 - "Organization policy controls"
Cohesion: 0.19
Nodes (14): dynamic, GET(), runtime, workerLanes(), admissionLimit, OrganizationLimits, OrganizationPolicy, organizationPolicyInput (+6 more)

### Community 38 - "TypeScript compilation contracts"
Cohesion: 0.20
Nodes (11): chunks, waiting, compile(), inspect(), inputSchema, SharedModule, Stage, CompilationError (+3 more)

### Community 39 - "Installation settings and health"
Cohesion: 0.17
Nodes (14): dynamic, GET(), runtime, dynamic, GET(), runtime, executorHealthSchema, InstallationHealth (+6 more)

### Community 40 - "Ingress and executor integration"
Cohesion: 0.16
Nodes (12): initialize(), smtpSchema, Environment, resolveBaseUrl(), httpUrl, publicConfiguration(), readConfig(), readServerConfig() (+4 more)

### Community 41 - "Application layouts and invitations"
Cohesion: 0.17
Nodes (11): AuthLayout(), PreviewNotice(), ApiDocumentationPage(), ApiReference, configuration, metadata, RootLayout(), ToastHost() (+3 more)

### Community 42 - "Authentication and owner setup"
Cohesion: 0.34
Nodes (8): consumeOTPQuota(), requestLoginCode(), createAuth(), InvitationGrant, queueMail(), authenticateRequest(), encryptPrivate(), authenticateToken()

### Community 43 - "Worker database and retention"
Cohesion: 0.21
Nodes (8): authSchemaOptions(), database(), typedDatabase(), initializeLibrarySchemas(), migrate(), client, seedLegacyScope(), migrate()

### Community 44 - "Notification delivery and rules"
Cohesion: 0.17
Nodes (13): GET(), bindings, EmailBranding, EmailContent, emailSettingsInput, httpUrl, notificationChannelInput, notificationChannelPreview (+5 more)

### Community 45 - "Development test dependencies"
Cohesion: 0.12
Nodes (16): devDependencies, c8, esbuild, eslint, eslint-config-next, nodemailer, pg, @playwright/test (+8 more)

### Community 46 - "Code publication and testing"
Cohesion: 0.21
Nodes (10): POST(), GET(), GET(), POST(), createSharedVersion(), getSharedVersion(), helperExports(), listSharedVersions() (+2 more)

### Community 47 - "Workspace package metadata"
Cohesion: 0.14
Nodes (13): dependencies, esbuild, typescript, workerd, zod, esbuild, typescript, workerd (+5 more)

### Community 48 - "Resource setup and onboarding"
Cohesion: 0.16
Nodes (11): dynamic, GET(), POST(), runtime, dynamic, GET(), POST(), runtime (+3 more)

### Community 49 - "Worker mail dependencies"
Cohesion: 0.14
Nodes (13): dependencies, graphile-worker, nodemailer, @payloadbay/domain, pg, graphile-worker, nodemailer, @payloadbay/domain (+5 more)

### Community 50 - "OpenAPI and Scalar"
Cohesion: 0.21
Nodes (10): dynamic, GET(), errorEnvelope, apiOperations, apiRequestSchemas, versionedOperations, names, openApiDocument() (+2 more)

### Community 51 - "Zod response contracts"
Cohesion: 0.17
Nodes (9): apiQuerySchemas, events, scopeQuery, selection, states, AuditPage, auditPageSchema, middlewareScope (+1 more)

### Community 52 - "Historical expansion fixture"
Cohesion: 0.18
Nodes (4): delivery_execution_history, destination_one_default, event_global_history, execution_event_history

### Community 53 - "Web development packages"
Cohesion: 0.22
Nodes (9): devDependencies, drizzle-kit, eslint, eslint-config-next, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 54 - "Request contracts and tokens"
Cohesion: 0.31
Nodes (8): DELETE(), dynamic, GET(), POST(), runtime, createToken(), listTokens(), revokeToken()

### Community 55 - "Scoped API key management"
Cohesion: 0.28
Nodes (4): ApiKeyManager(), revoke(), PersonalApiKeysPage(), OrganizationApiKeysPage()

### Community 56 - "Notification delivery and rules"
Cohesion: 0.47
Nodes (6): startNotificationProducer(), snapshotNotificationChannel(), queueIncidentNotifications(), evaluateFailureRules(), failure(), NotificationMailFixtureData

### Community 57 - "Contract package exports"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 58 - "Resource parameter validation"
Cohesion: 0.36
Nodes (7): dynamic, PATCH(), POST(), runtime, activatePublication(), endpointScope(), publish()

### Community 59 - "Request contracts and tokens"
Cohesion: 0.32
Nodes (7): dynamic, GET(), POST(), runtime, authorizeAdmission(), createInvitation(), listInvitations()

### Community 60 - "Job queue administration"
Cohesion: 0.32
Nodes (6): dynamic, GET(), runtime, JobAdministration, jobAdministrationSchema, readJobAdministration()

### Community 61 - "Immutable organization usage"
Cohesion: 0.39
Nodes (6): usageFactInput, UsageMetric, usageMetrics, UsageReport, usageWindowInput, UsageFactInput

### Community 62 - "Scoped notification rule screens"
Cohesion: 0.38
Nodes (4): NotificationRules(), save(), NotificationRulesPage(), WorkspaceNotificationRulesPage()

### Community 63 - "Worker database and retention"
Cohesion: 0.29
Nodes (5): broker, config, pool, recovery, runners

### Community 64 - "SDK package exports"
Cohesion: 0.29
Nodes (6): dependencies, exports, name, private, type, version

### Community 65 - "Web build commands"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 66 - "Notification delivery and rules"
Cohesion: 0.33
Nodes (5): channelKey, notificationPreferenceOutput, notificationRuleOutput, notificationRuleUpdateInput, notificationSubscriptionInput

### Community 68 - "Resource parameter validation"
Cohesion: 0.50
Nodes (4): DELETE(), dynamic, runtime, revokeSecret()

## Knowledge Gaps
- **85 isolated node(s):** `esbuild`, `typescript`, `zod`, `workerd`, `@better-auth/passkey` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 695 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@playwright/test` connect `Test runners and browser fixtures` to `Container delivery and latency`, `Authentication integration tests`, `Workspace package metadata`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `esbuild`, `typescript`, `zod` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Route commands and parameters` be split into smaller, more focused modules?**
  _Cohesion score 0.05879692446856626 - nodes in this community are weakly interconnected._
- **Why does `AppError` connect `Permissions and invitations` to `Route commands and parameters`, `Protected script API`, `Authentication and owner setup`, `Script editor and formatting`, `Event listing APIs`, `Delivery replay and recovery`, `Authentication integration tests`, `Script lifecycle SDK`, `Notification delivery and rules`, `Notification delivery and rules`, `Executor wire and supervision`, `Ingress and executor integration`, `Scoped middleware and changes`, `Resource setup and onboarding`, `Organization policy controls`, `TypeScript compilation contracts`, `Ingress and executor integration`, `Authentication and owner setup`, `Worker database and retention`, `Code publication and testing`, `Request contracts and tokens`, `Notification delivery and rules`, `Resource parameter validation`, `Request contracts and tokens`, `Immutable organization usage`, `Resource parameter validation`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `Protected script API` be split into smaller, more focused modules?**
  _Cohesion score 0.0773892773892774 - nodes in this community are weakly interconnected._
- **Why does `api()` connect `Client data and loading` to `Membership management screens`, `Live event inspection`, `Dashboard shell and feedback`, `Authentication and owner setup`, `Script editor and formatting`, `Script editor and formatting`, `Scoped API key management`, `Live event inspection`, `Scoped notification rule screens`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Permissions and invitations` be split into smaller, more focused modules?**
  _Cohesion score 0.11433756805807622 - nodes in this community are weakly interconnected._

## Source verification and limitations

Refreshed from source `7fa7da0` plus the documented cleanup diff on 2026-10-17,
using Graphify 0.9.85 and its optional SQL parser tree-sitter-sql 0.3.11. Scope:
317 code files, 43 documents and seven canonical copied brand assets. All 50
semantic sources produced attributed fragments. Historical Supabase probes and
schema fixtures remain historical; they are not a second supported backend.
Semantic concepts describe source claims, not release certification.

Raw extraction diagnostics: 0 missing endpoint fields,
19 unresolved endpoint references,
6 exact duplicate edges, 12 self-loops
and 158 same-endpoint edges coalesced by
the simple undirected graph. Unresolved placeholders and coalesced relation/location
variants limit precision. Verify exact direction, provenance and parallel
relationships in source. Some self-loops are genuine recursion; qualified library
calls can be mistaken for local calls (for example z.uuid versus the local uuid
helper). The valid inline TypeScript import type in
`tests/integration/middleware.test.ts` was not parsed; its symbols are absent.
TypeScript checks pass independently. Another 23 configuration/data files yielded
no symbols. This is navigation assistance, not a complete call graph, runtime
proof, security audit or exhaustive executable coverage inventory.
