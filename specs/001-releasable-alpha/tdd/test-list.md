---
feature: 001-releasable-alpha
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 20
planned_at: '6223754'
updated_at: '6223754'
suite_baseline: green
---

# Test List: First Releasable Payload Bay Alpha

Baseline is13 bootstrap tests, not completed alpha behavior. `USn.m` means acceptance scenario m under User Story n in spec.md. All outer behaviors use the real indicated route/browser/deployment entrypoint when implemented; test paths below are planned, not existing passing tests. Default restricted Docker is supported; actual optional gVisor execution is unverified on this host.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| A1 | An empty supported installation completes exactly one owner bootstrap | US1.1, FR-001, FR-022 | example | GREEN | `tests/deployment/installation.test.ts::A1 real Next installation completes one verified owner` |
| A2 | Anonymous or inactive access returns no private instance data | US1.2, FR-002 | example | GREEN | `tests/deployment/installation.test.ts::A2 real API denies anonymous and inactive access` |
| A3 | An admitted operator signs in with SMTP email code while public signup stays unavailable | US1.3, FR-022 | example | GREEN | `tests/integration/auth.test.ts::A3 admitted operator signs in through SMTP code` |
| A4 | Selecting a template copies its editable source and helpers | US2.1, FR-013 | example | PENDING | Planned owner: `tests/acceptance/dashboard.spec.ts` |
| A5 | Editing draft or parent helper source leaves the active published behavior unchanged | US2.2, FR-017, FR-018 | example | GREEN | `tests/deployment/installation.test.ts::A5 API draft changes leave published runtime behavior unchanged` |
| A6 | Invoking published custom verification code returns its exact protocol response | US2.3, FR-004, FR-024 | example | PENDING | Planned owner: `tests/integration/ingress.test.ts` |
| A7 | Provider success is observable only after event and recoverable work commit | US3.1, FR-006 | example | DONE | `tests/deployment/installation.test.ts::A7 public HTTP acknowledges only durable accepted work` |
| A8 | A protocol-only challenge returns exact bytes without creating processing work | US3.2, FR-006 | example | PENDING | Planned owner: `tests/integration/ingress.test.ts` |
| A9 | Verification failure or invalid ingress result creates no accepted work | US3.3, FR-004, FR-014 | example | PENDING | Planned owner: `tests/integration/ingress.test.ts` |
| A10 | A failing optional destination remains visible without overriding successful app-required policy | US3.4, FR-010, FR-015 | example | DONE | `tests/integration/delivery.test.ts::A10 optional destination failure does not override authored success policy` |
| A11 | A failed acceptance transaction never sends provider success | US3.5, FR-006 | example | PENDING | Planned owner: `tests/integration/ingress.test.ts` |
| A12 | Scoped middleware applies the published order and declared optional-failure policy | US4.1, FR-019 | example | PENDING | Planned owner: `tests/integration/middleware.test.ts` |
| A13 | User-authored routing selects destinations without hidden provider restrictions | US4.2, FR-015 | example | PENDING | Planned owner: `tests/integration/middleware.test.ts` |
| A14 | Reachable administrator-configured localhost LAN 100.x public domain and tunnel destinations deliver | US4.3, FR-007 | example | PENDING | Planned owner: `tests/integration/delivery.test.ts` |
| A15 | Acknowledged work recovers after a crash without claiming JS instruction continuation | US5.1, FR-008, FR-016 | example | PENDING | Planned owner: `tests/integration/recovery.test.ts` |
| A16 | Recovery reuses recorded successful managed sends while uncertain sends retain duplicate risk | US5.2, FR-009, FR-016 | example | PENDING | Planned owner: `tests/integration/recovery.test.ts` |
| A17 | Replaying a terminal event creates new execution identity without changing prior history | US5.3, FR-010, FR-016 | example | PENDING | Planned owner: `tests/integration/delivery.test.ts` |
| A18 | Lost scheduling recovers under a new generation that rejects stale writes | US5.4, FR-008 | example | PENDING | Planned owner: `tests/integration/recovery.test.ts` |
| A19 | With no failure rule deliveries create no threshold notification or email | US5.5, FR-027, FR-028 | example | PENDING | Planned owner: tests/integration/notifications.test.ts |
| A20 | An explicit count1 route rule notifies authorized recipients on its first matching failure | US5.6, FR-028 | example | PENDING | Planned owner: tests/integration/notifications.test.ts |


## Inner loop: component behaviors

Boundary examples sample invariants; no property-based tool is installed. Timers/randomness/network decisions need controllable fixtures; database leases use PostgreSQL server time. Neither an absent table nor an absent runner is Red evidence.

### `packages/domain/src/config.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U1 | Complete SMTP configuration is accepted | FR-011, FR-020, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U1 complete SMTP configuration is accepted` |
| U2 | Partial SMTP configuration reports a configuration error | FR-011, FR-020, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U2 partial SMTP configuration reports a configuration error` |
| U3 | Partial OAuth configuration reports a configuration error | FR-011, FR-020, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U3 partial OAuth configuration reports a configuration error` |
| U4 | Public errors omit secrets and SQL internals | FR-011, FR-020, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U4 public errors omit secrets and SQL internals` |
| U5 | Valid public Zod values retain their documented shapes | FR-011, FR-020, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U5 valid public Zod values retain documented shapes` |

### `packages/domain/src/db.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U6 | Empty installation creates the complete domain schema | FR-006, FR-008, FR-012 | example | DONE | `tests/integration/database.test.ts::U6 empty installation creates complete domain schema` |
| U7 | Acceptance rollback leaves no event or dispatch record | FR-006, FR-008, FR-012 | example | DONE | `tests/integration/database.test.ts::U7 acceptance rollback leaves no event or dispatch` |
| U8 | Concurrent migration attempts serialize under the migration lock | FR-006, FR-008, FR-012 | example | DONE | `tests/integration/database.test.ts::U8 concurrent migrations serialize under migration lock` |
| U9 | Forward upgrade preserves existing records | FR-006, FR-008, FR-012 | example | DONE | `tests/integration/database.test.ts::U9 forward migration preserves existing records` |
| U10 | A dispatch referencing the wrong execution scope is rejected | FR-006, FR-008, FR-012 | example | DONE | `tests/integration/database.test.ts::U10 wrong-scope dispatch is rejected` |

### `apps/executor/src/compiler.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U11 | An editable body invokes its fixed default-export lifecycle entrypoint | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U11 body invokes fixed default lifecycle entrypoint` |
| U12 | A raw wrapper-replacement publication is rejected | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U12 raw wrapper replacement is rejected` |
| U13 | Unregistered imports are rejected at publication | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U13 unregistered imports are rejected at publication` |
| U14 | A supported pinned helper import resolves above the generated wrapper | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U14 pinned helper binding resolves above wrapper` |
| U15 | Generated syntax errors point to the editable source line | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U15 syntax errors point to editable source line` |
| U16 | Invalid stage outcomes are rejected by typed and runtime validation | FR-014, FR-017, FR-024 | example | DONE | `tests/unit/contracts.test.ts::U16 invalid stage outcomes fail typed and runtime validation` |

### `apps/executor/src/supervisor.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U17 | Configured code cannot write a host SSH key | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U17 configured code cannot write host SSH key` |
| U18 | Configured code cannot spawn a native subprocess | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U18 configured code cannot spawn native subprocess` |
| U19 | Configured code cannot import a native addon | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U19 configured code cannot import native addon` |
| U20 | Configured code cannot read unrelated platform credentials | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U20 configured code cannot read unrelated platform credentials` |
| U21 | Bounded direct fetch is available to configured scripts | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U21 bounded direct fetch is available to scripts` |
| U22 | A nonyielding script is terminated at its configured deadline | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U22 nonyielding script terminates at configured deadline` |
| U23 | A script exceeding RSS quota is terminated | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U23 RSS quota terminates allocating script` |
| U24 | A log burst beyond configured quota is bounded | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U24 log burst cannot exceed configured quota` |
| U25 | A failed processing script leaves reserved ingress capacity available | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U25 processing failure leaves reserved ingress capacity` |
| U26 | Explicit missing-runsc selection fails deployment without silently using runc | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U26 explicitly unavailable runsc fails at deployment` |

### `packages/domain/src/execution-lease.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U27 | A live unexpired lease cannot be reclaimed | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U27 live unexpired lease cannot be reclaimed` |
| U28 | A lease expiring at database now becomes recoverable | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U28 expired lease becomes recoverable using database time` |
| U29 | An unclaimed offer before dueAt+30s is not recovered | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U29 unclaimed offer before deadline is not recovered` |
| U30 | An unclaimed offer at its deadline gets a fresh generation | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U30 overdue unclaimed offer gets fresh generation` |
| U31 | Two concurrent sweepers create only one replacement generation | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U31 concurrent sweepers create one replacement generation` |
| U32 | A stale generation cannot write a result | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U32 stale generation cannot overwrite newer result` |
| U33 | A forged broker identity cannot acquire another execution authority | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U33 forged broker capability cannot acquire authority` |
| U34 | A cross-scope broker request is rejected | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U34 cross-route broker authority is rejected` |
| U35 | A suspected-live Graphile worker is never force-unlocked | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U35 suspected live Graphile worker is never unlocked` |

### `packages/domain/src/request-context.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U36 | An invalid browser command origin is rejected | FR-002, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U36 invalid browser command origin is rejected` |
| U37 | A cookie command without required CSRF protection is rejected | FR-002, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U37 cookie command requires CSRF protection` |
| U38 | An unauthenticated command returns401 without private detail | FR-002, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U38 unauthenticated command returns no private detail` |
| U39 | An optimistic version conflict never silently overwrites state | FR-002, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U39 optimistic conflict cannot silently overwrite` |

### `packages/domain/src/auth.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U40 | Exactly one concurrent bootstrap claim creates an owner | FR-022 | example | DONE | `tests/integration/auth.test.ts::U40 concurrent setup creates exactly one owner` |
| U41 | An invalid bootstrap secret cannot create an owner | FR-022 | example | DONE | `tests/integration/auth.test.ts::U41 invalid setup secret cannot create owner` |
| U42 | An unverified bootstrap email cannot become owner | FR-022 | example | DONE | `tests/integration/auth.test.ts::U42 unverified email cannot become instance owner` |
| U43 | OTP request responses do not disclose account membership | FR-022 | example | DONE | `tests/integration/auth.test.ts::U43 code request responses do not disclose membership` |
| U44 | An OTP one millisecond before five-minute expiry may verify | FR-022 | example | DONE | `tests/integration/auth.test.ts::U44 OTP one millisecond before expiry may verify` |
| U45 | An OTP at five-minute expiry is rejected | FR-022 | example | DONE | `tests/integration/auth.test.ts::U45 OTP at five minute expiry is rejected` |
| U46 | A fifth permitted verification attempt is bounded by the attempt policy | FR-022 | example | DONE | `tests/integration/auth.test.ts::U46 fifth verification attempt remains within limit` |
| U47 | A sixth verification attempt is rejected | FR-022 | example | DONE | `tests/integration/auth.test.ts::U47 sixth verification attempt is rejected` |
| U48 | Expired queued OTP mail is not sent | FR-022 | example | DONE | `tests/integration/auth.test.ts::U48 expired queued OTP mail is not sent` |
| U49 | Unverified matching email never silently links OAuth accounts | FR-022 | example | DONE | `tests/integration/auth.test.ts::U49 unverified matching email never links OAuth implicitly` |
| U50 | Public registration stays disabled | FR-022 | example | DONE | `tests/integration/auth.test.ts::U50 public registration stays disabled` |

### `packages/domain/src/authorization.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U51 | Admission alone grants no global resource access | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U51 admission grants no resource access` |
| U52 | Instance permission grants apply to child workspaces and projects | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U52 instance grants apply to child resources` |
| U53 | Workspace permission grants apply only to projects in that workspace | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U53 workspace grants exclude other workspaces` |
| U54 | Project permission grants expose only that project | FR-002, FR-023 | example | DONE | `tests/unit/policy.test.ts::U54 project grant cannot access sibling project` |
| U55 | Child roles cannot revoke inherited positive grants | FR-002, FR-023 | example | DONE | `tests/unit/policy.test.ts::U55 child permissions cannot deny inherited grants` |
| U56 | A grantor cannot assign rights they do not hold | FR-002, FR-023 | example | DONE | `tests/unit/policy.test.ts::U56 grantor cannot escalate permissions` |
| U57 | Concurrent last-owner removal cannot orphan a scope | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U57 concurrent owner demotions cannot orphan scope` |
| U58 | A scoped token is restricted to current user rights | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U58 tokens intersect current user and stored token rights` |
| U59 | A revoked token is rejected immediately | FR-002, FR-023 | example | DONE | `tests/integration/authorization.test.ts::U59 revoked token immediately loses access` |

### `apps/web/src/app/setup/page.tsx`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U60 | Setup screen presents recoverable configuration errors | FR-003, FR-022, FR-023, FR-026 | example | DONE | `tests/acceptance/dashboard.spec.ts::U60 setup explains service errors and retry recovers` |
| U61 | Login screen accepts the SMTP code flow | FR-003, FR-022, FR-023, FR-026 | example | DONE | `tests/acceptance/dashboard.spec.ts::U61 setup and login use real SMTP codes` |
| U62 | Scoped workspace navigation hides inaccessible projects | FR-003, FR-022, FR-023, FR-026 | example | DONE | `tests/acceptance/dashboard.spec.ts::U62 dashboard hides projects outside inherited access` |
| U63 | Member editing exposes preset and customized effective rights | FR-003, FR-022, FR-023, FR-026 | example | DONE | `tests/acceptance/dashboard.spec.ts::U63 member editing preserves presets and customized rights` |
| U64 | The local saved brand theme renders without a remote font/theme fetch | FR-003, FR-022, FR-023, FR-026 | example | DONE | `tests/acceptance/dashboard.spec.ts::U64 local theme fonts and icons render without remote requests` |

### `packages/domain/src/publication.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U65 | A draft with an old If-Match version is rejected | FR-017, FR-018, FR-024 | example | DONE | `tests/integration/publication.test.ts::U65 stale draft version cannot overwrite saved code` |
| U66 | A compile failure preserves the prior active publication | FR-017, FR-018, FR-024 | example | DONE | `tests/integration/publication.test.ts::U66 compile failure preserves active code and revision history` |
| U67 | A complete publication activates both pinned stage revisions atomically | FR-017, FR-018, FR-024 | example | DONE | `tests/integration/publication.test.ts::U67 publication activates both pinned stages atomically` |
| U68 | A draft edit leaves previously pinned executions unchanged | FR-017, FR-018, FR-024 | example | DONE | `tests/integration/publication.test.ts::U68 draft edit does not change pinned published code` |
| U69 | Rolling back publication activates recorded code without rewriting its history | FR-017, FR-018, FR-024 | example | DONE | `tests/integration/publication.test.ts::U69 rollback activates recorded code without changing history` |

### `packages/domain/src/secrets.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U70 | A user without secret-manage rights cannot update a secret | FR-002, FR-011, FR-017, FR-023 | example | DONE | `tests/integration/publication.test.ts::U70 secret use rights do not imply secret management` |
| U71 | A user without secret-use rights cannot resolve it | FR-002, FR-011, FR-017, FR-023 | example | DONE | `tests/integration/publication.test.ts::U71 secret management does not grant value use` |
| U72 | Secret versions are encrypted at rest | FR-002, FR-011, FR-017, FR-023 | example | DONE | `tests/integration/publication.test.ts::U72 secret versions are encrypted and values never appear in audit` |
| U73 | Compilation diagnostics expose no secret plaintext | FR-002, FR-011, FR-017, FR-023 | example | DONE | `tests/integration/publication.test.ts::U73 published secret bindings never enter compiler or diagnostics` |
| U74 | Emergency revocation makes a pinned queued secret fail visibly | FR-002, FR-011, FR-017, FR-023 | example | DONE | `tests/integration/publication.test.ts::U74 revocation prevents old binding from silently using a new version` |

### `packages/domain/src/script-test.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U75 | A copied template stays independent of later source-template edits | FR-004, FR-013, FR-017, FR-018 | example | DONE | `tests/acceptance/dashboard.spec.ts::U75 copied template remains editable and leaves future copies unchanged` |
| U76 | A synthetic test performs no external effects by default | FR-004, FR-013, FR-017, FR-018 | example | DONE | `tests/integration/publication.test.ts::U76 synthetic draft test performs no external effects` |
| U77 | A user without side-effect test authority cannot enable real test mode | FR-004, FR-013, FR-017, FR-018 | example | PENDING | |
| U78 | A generic HMAC template rejects an invalid signature | FR-004, FR-013, FR-017, FR-018 | example | DONE | `tests/integration/ingress.test.ts::U78 generic HMAC template rejects altered raw bytes` |
| U79 | An unverified template explicitly accepts without hidden provider behavior | FR-004, FR-013, FR-017, FR-018 | example | DONE | `tests/integration/ingress.test.ts::U79 explicitly unverified template accepts raw event without provider rules` |

### `apps/web/src/app/components/script-editor.tsx`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U80 | Ingress and Processing bodies have separate editor tabs | FR-024 | example | DONE | `tests/acceptance/dashboard.spec.ts::U80 route editor separates ingress and processing bodies` |
| U81 | The function signature is read-only to the editor user | FR-024 | example | PENDING | |
| U82 | The API cannot bypass the fixed generated wrapper | FR-024 | example | PENDING | |
| U83 | Shared imports appear above the body in generated preview | FR-024 | example | DONE | `tests/acceptance/dashboard.spec.ts::U83 route editor binds helper version and shows generated imports above body` |
| U84 | A publication conflict is visible without overwriting the draft | FR-024 | example | PENDING | |

### `packages/domain/src/ingress.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U85 | Original binary request bytes remain unchanged | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U85 accepted binary bytes are durable before acknowledgement` |
| U86 | A valid HMAC accepts exactly the verified raw bytes | FR-004, FR-005, FR-006, FR-011, FR-014 | example | PENDING | |
| U87 | A body of exactly1MiB is within the initial body limit | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U87 exactly one MiB raw event is accepted intact` |
| U88 | A body larger than1MiB is rejected | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U88 oversized raw event is rejected before accepted work` |
| U89 | Headers at16KiB remain within the initial limit | FR-004, FR-005, FR-006, FR-011, FR-014 | example | PENDING | |
| U90 | Headers larger than16KiB are rejected | FR-004, FR-005, FR-006, FR-011, FR-014 | example | PENDING | |
| U91 | Ingress at its2s deadline is terminated without false acceptance | FR-004, FR-005, FR-006, FR-011, FR-014 | example | PENDING | |
| U92 | A protocol response preserves plaintext content type and exact body | FR-004, FR-005, FR-006, FR-011, FR-014 | example | PENDING | |
| U93 | A reject outcome creates no processing work | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U93 reject records the inbound request without queued work` |
| U94 | An acceptance transaction rollback sends no success | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U94 queue failure rolls back accepted event and acknowledgement` |
| U95 | Invalid CRLF response headers are rejected | FR-004, FR-005, FR-006, FR-011, FR-014 | example | DONE | `tests/unit/contracts.test.ts::U95 ingress response rejects CRLF header injection` |

### `packages/domain/src/delivery.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U96 | Managed send returns actual configured2xx success | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U96 managed configured destination returns real HTTP success` |
| U97 | A non2xx destination response records a failed attempt | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U97 non-success HTTP response remains a failed recorded attempt` |
| U98 | A managed HTTP attempt times out at10s | FR-007, FR-009, FR-010, FR-015, FR-016 | example | PENDING | |
| U99 | A same operation key with different input digest is rejected | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U99 operation ID cannot change its request content` |
| U100 | Recovery reuses a committed successful operation result | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U100 fresh recovery generation reuses committed HTTP success` |
| U101 | A failed operation may create another immutable attempt | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U101 retrying failed operation creates another retained attempt` |
| U102 | Remote success without local commit remains uncertain rather than exactly-once | FR-007, FR-009, FR-010, FR-015, FR-016 | example | PENDING | |
| U103 | HTTP redirects are not followed | FR-007, FR-009, FR-010, FR-015, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U103 managed destination redirect is recorded without following it` |
| U104 | Address category alone never rejects an authorized target | FR-007, FR-009, FR-010, FR-015, FR-016 | example | PENDING | |

### `apps/worker/src/tasks/process-event.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U105 | Complete result records handler success | FR-008, FR-011, FR-025 | example | DONE | `tests/integration/ingress.test.ts::U105 continuous worker handles accepted event and records completion` |
| U106 | Retry result schedules a bounded delayed attempt | FR-008, FR-011, FR-025 | example | DONE | `tests/integration/recovery.test.ts::U106 retry schedules a delayed fresh fenced generation` |
| U107 | Fail result retains terminal handler history | FR-008, FR-011, FR-025 | example | PENDING | |
| U108 | Processing at its30s deadline terminates under retry policy | FR-008, FR-011, FR-025 | example | PENDING | |
| U109 | A fifth default processing attempt may run | FR-008, FR-011, FR-025 | example | PENDING | |
| U110 | Retry exhaustion after five default attempts retains the event | FR-008, FR-011, FR-025 | example | PENDING | |
| U111 | A critical event progresses despite competing lower-priority backlog | FR-008, FR-011, FR-025 | example | PENDING | |
| U112 | The documented fixture meets p95ack≤1s | FR-008, FR-011, FR-025 | example | PENDING | |
| U113 | The documented fixture meets p95first-attempt≤2s | FR-008, FR-011, FR-025 | example | PENDING | |
| U114 | No critical fixture waits longer than10s | FR-008, FR-011, FR-025 | example | PENDING | |

### `apps/web/src/app/(dashboard)/projects/[projectId]/events/page.tsx`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U115 | Raw payload read requires separate payload permission | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/integration/ingress.test.ts::U115 raw event payload requires distinct payload permission` |
| U116 | Event rendering escapes script/HTML payload text | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/acceptance/dashboard.spec.ts::U116 event inspector displays HTML payload as escaped text` |
| U117 | Attempts remain distinct from handler completion | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/integration/delivery.test.ts::U117 inspection distinguishes delivery attempt failure from handler completion` |
| U118 | A list request defaults to50 records | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/integration/ingress.test.ts::U118 event inspection defaults to fifty records and preserves cursor precision` |
| U119 | A list request may request200 records | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/integration/ingress.test.ts::U119 event inspection accepts a two-hundred record page` |
| U120 | A list limit above200 is rejected | FR-003, FR-005, FR-010, FR-015 | example | DONE | `tests/integration/ingress.test.ts::U120 event inspection refuses a limit above two hundred` |

### `packages/domain/src/middleware.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U121 | Published middleware executes instance workspace project endpoint order | FR-019 | example | DONE | `tests/integration/middleware.test.ts::U121 publication pins middleware in hierarchy order and executes it before handler` |
| U122 | An invalid optional patch keeps the last valid context | FR-019 | example | DONE | `tests/integration/middleware.test.ts::U122 optional invalid middleware patch preserves last valid context` |
| U123 | Required ingress middleware failure rejects acceptance | FR-019 | example | DONE | `tests/integration/middleware.test.ts::U123 required ingress middleware failure returns rejection without main handler` |
| U124 | Required processing middleware failure follows configured retry/fail | FR-019 | example | DONE | `tests/integration/middleware.test.ts::U124 required processing middleware failure follows retry or fail configuration` |
| U125 | A child cannot override a non-overridable parent binding | FR-019 | example | DONE | `tests/integration/middleware.test.ts::U125 a non-overridable parent binding blocks child replacement` |
| U126 | Middleware cannot remove platform control-plane authorization | FR-019 | example | PENDING | |

### `packages/domain/src/shared-code.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U127 | A shared-module copy preserves its origin but becomes locally editable | FR-007, FR-015, FR-018, FR-019 | example | DONE | `tests/integration/publication.test.ts::U127 shared code copy preserves origin and edits create local immutable version` |
| U128 | An unauthorized cross-scope shared-module modification is rejected | FR-007, FR-015, FR-018, FR-019 | example | DONE | `tests/integration/publication.test.ts::U128 project shared code editor cannot create a parent scope revision` |
| U129 | A custom authorized target uses the managed operation journal | FR-007, FR-015, FR-018, FR-019 | example | PENDING | |
| U130 | A parent module edit leaves queued publication behavior unchanged | FR-007, FR-015, FR-018, FR-019 | example | DONE | `tests/integration/publication.test.ts::U130 queued events retain helper code after parent version changes` |

### `apps/web/src/app/components/middleware-bindings.tsx`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U131 | Inherited middleware provenance is visible | FR-018, FR-019 | example | DONE | `tests/acceptance/dashboard.spec.ts::U131 inherited middleware shows provenance and copies a local override` |
| U132 | A forbidden override control cannot modify the parent policy | FR-018, FR-019 | example | PENDING | |
| U133 | Publishing changed bindings activates an immutable effective snapshot | FR-018, FR-019 | example | PENDING | |

### `packages/domain/src/recovery.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U134 | Whole-container loss leaves acknowledged work recoverable | FR-008, FR-009, FR-016 | example | PENDING | |
| U135 | Crash after Graphile claim before domain claim recovers the offer | FR-008, FR-009, FR-016 | example | PENDING | |
| U136 | A suspended old process cannot send after its generation is fenced | FR-008, FR-009, FR-016 | example | PENDING | |
| U137 | A DB partition cannot authorize stale results on reconnect | FR-008, FR-009, FR-016 | example | PENDING | |
| U138 | A healthy replacement makes orphan work claimable within60s | FR-008, FR-009, FR-016 | example | PENDING | |
| U139 | A missing heartbeat never proves the old process dead | FR-008, FR-009, FR-016 | example | PENDING | |

### `packages/domain/src/replay.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U140 | Paused endpoints continue accepting events | FR-008, FR-010, FR-016 | example | PENDING | |
| U141 | Pause prevents new processing claims while inflight attempts may finish | FR-008, FR-010, FR-016 | example | PENDING | |
| U142 | Resume dispatches retained backlog at bounded concurrency | FR-008, FR-010, FR-016 | example | DONE | `tests/integration/ingress.test.ts::U142 large resume batches remain bounded and recovery picks up the rest` |
| U143 | A failed-event replay creates a new execution identity | FR-008, FR-010, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U143 failed event replay creates separate durable execution history` |
| U144 | A successful-event replay also creates new history | FR-008, FR-010, FR-016 | example | PENDING | |
| U145 | A same replay key with different input is409 | FR-008, FR-010, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U145 replay idempotency rejects changed policy under the same key` |
| U146 | Original publication is the default replay policy | FR-008, FR-010, FR-016 | example | DONE | `tests/integration/delivery.test.ts::U146 replay keeps original publication after active version changes` |
| U147 | Explicit current-publication replay is audited | FR-008, FR-010, FR-016 | example | PENDING | |
| U148 | Retention cannot delete unfinished work or its required revisions | FR-008, FR-010, FR-016 | example | PENDING | |

### `packages/domain/src/change-stream.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U149 | Authenticated reconnect backfills authorized retained changes without a gap | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U149 authenticated SSE reconnect backfills then follows committed changes` |
| U150 | An expired cursor produces resync-required | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U150 expired cursor requests authorized HTTP resync` |
| U151 | Permission revocation terminates the live stream | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U151 revoked permissions close existing stream` |
| U152 | A slow client cannot retain unbounded output | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U152 slow SSE consumer is disconnected at bounded output` |
| U153 | A15s heartbeat keeps the authenticated stream observable | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U153 live stream emits fifteen second heartbeat` |
| U154 | Private bodies are not broadcast as change metadata | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U154 metadata-only SSE sends references even when persisted changes contain private event data` |
| U155 | Generated OpenAPI agrees with the implemented API schemas | FR-020, FR-021 | example | DONE | `tests/integration/live-api.test.ts::U155a–d actual route, body, header and query parity` |
| U156 | Local Scalar sends token-authenticated requests to this installation | FR-020, FR-021 | example | DONE | `tests/acceptance/api-docs.spec.ts::U156a–c local assets, scoped token/revocation and mobile navigation` |

### `apps/web/src/app/components/event-timeline.tsx`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U157 | Live attempt completion updates the timeline without polling reloads | FR-003, FR-010, FR-021, FR-025 | example | DONE | `tests/acceptance/dashboard.spec.ts::U157b open attempt inspector refreshes when delivery completes` |
| U158 | Replaying a successful event creates a separate timeline | FR-003, FR-010, FR-021, FR-025 | example | DONE | `tests/acceptance/dashboard.spec.ts::U116` successful replay lineage and preserved history |
| U159 | Lower rights cannot inspect privileged job administration | FR-003, FR-010, FR-021, FR-025 | example | DONE | `tests/integration/authorization.test.ts::U159`; `tests/acceptance/dashboard.spec.ts::U159` |
| U160 | Queue age distinguishes critical backlog from provider acknowledgement latency | FR-003, FR-010, FR-021, FR-025 | example | DONE | `tests/integration/authorization.test.ts::U160`; `tests/acceptance/dashboard.spec.ts::U160` |

### `deploy/compose.yml`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U161 | Prebuilt-image installation needs no host Node or Bun | FR-001, FR-012 | example | PENDING | |
| U162 | Application images expose no build authentication credentials | FR-001, FR-012 | example | PENDING | |
| U163 | Default deployment starts without gVisor; an explicitly missing runsc fails before event execution | FR-001, FR-012 | example | PENDING | |

### `scripts/backup.ts`

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U164 | Backup restore retains pending jobs and publication manifests | FR-012 | example | PENDING | |
| U165 | Supported forward image/schema upgrade preserves pending work | FR-012 | example | PENDING | |
| U166 | Unsupported mixed-version execution is rejected visibly | FR-012 | example | PENDING | |

### Existing application shell characterization

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U167 | Existing local shell opens and dismisses the Pro setup sheet | FR-026; spec.md current scaffold status | characterization | BASELINE | `tests/acceptance/bootstrap.spec.ts::local branded shell opens the HeroUI Pro setup sheet` |

## Invariants and edge cases still to place

No untraced product requirement is deferred. Before coding an unfamiliar dependency feature, append its discovered failure boundary under its actual owner; retain stable IDs. Time/random/external-read decisions without journaling have explicitly unsupported transparent recovery; managed operation input mismatch must fail rather than silently replay different effects. Script/script-secret/middleware/resource behavior is validated by the numbered cases above, not by the local engine feasibility smoke.

## Out of scope

- Supabase backend and Deno runtime: replaced by confirmed stack.
- Full MCP OAuth server, edge ingress, pulling Runner, status-page automation and edited-payload replay: future scope in spec.md.
- Arbitrary npm/native modules, host filesystem/process APIs and arbitrary JavaScript instruction-pointer continuation: outside the approved runtime contract.
- Production/global-edge latency SLA: only the documented local fixture thresholds are acceptance targets.

## Verification commands

Copied verbatim from the verified profile:
- single: `bun run test:file {file} --name "{name}"`
- file: `bun run test:file {file}`
- suite: `bun run test`
- coverage: `bun run test:coverage`
- acceptance: `bun run test:file {file}`
- mutation: null (not verified/installed)
- watch: null (not verified/installed)

## Deployment clarification2026-10-14

Standard mode is runc, optional gVisor is runsc. Missing explicitly selected runsc must fail container creation, never first-event provisioning or silent fallback. Instance-admin mode notice is discreet/dismissible and opens host setup/Coolify-variable/redeploy instructions; an env value is configured mode, not host attestation. Direct fetch after successful managed send is allowed and remains unjournaled on recovery. These refine FR001/003/007/011/015/017 and their existing pending cases; no completed behavior was rewritten.

## Notification backbone refinement

### packages/domain/src/notifications.ts and notification UI

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U168 | Without a rule failed deliveries produce no incident | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U168 U175 U176 U177 opt-in thresholds exclude other routes destinations and expired failures` |
| U169 | Repeated active condition identity updates one incident | FR-027 | example | DONE | `tests/integration/notifications.test.ts::U169 active condition reconciles one durable incident` |
| U170 | Resolved conditions preserve historical incident state | FR-027 | example | DONE | `tests/integration/notifications.test.ts::U170 disabled rules resolve incidents without deleting history` |
| U171 | A project-only administrator cannot read instance notices | FR-027 | example | DONE | `tests/integration/notifications.test.ts::U171 project administrator cannot inspect instance runtime advice` |
| U172 | Dismissal for one user survives restart without dismissing for another | FR-027 | example | DONE | `tests/integration/notifications.test.ts::U172 per user dismissal survives condition reconciliation` |
| U173 | Configured runsc resolves isolation advice without claiming host attestation | FR-027 | example | DONE | `tests/integration/notifications.test.ts::U173 runsc configuration resolves advice without host attestation` |
| U174 | Count1 fires on the first matching managed delivery failure | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U174 trusted notification producer fires at the first matching failure` |
| U175 | CountN does not fire at N-1 distinct operations | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U168 U175 U176 U177 opt-in thresholds exclude other routes destinations and expired failures` |
| U176 | CountN fires at exactly N distinct operations | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U168 U175 U176 U177 opt-in thresholds exclude other routes destinations and expired failures` |
| U177 | A failure outside the selected ingress route cannot trigger its rule | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U168 U175 U176 U177 opt-in thresholds exclude other routes destinations and expired failures` |
| U178 | A retry of the same operation does not inflate distinct-delivery count | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U178 opt-in threshold counts failed operations rather than retries` |
| U179 | Revoked access prevents already queued notification email | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U179 revoked access prevents already queued notification email` |
| U180 | Unread severity selects an accessible bell warning or danger control | FR-027 | example | DONE | `tests/acceptance/notification-inbox.spec.ts::U180 U181 notification attention describes severity and follows real scoped producer changes` |
| U181 | A notice uses typed producer/service/inbox reconciliation rather than an environment-driven UI branch | FR-027 | example | DONE | `tests/acceptance/notification-inbox.spec.ts::U180 U181 notification attention describes severity and follows real scoped producer changes` |

### Discovered public-result boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U182 | A typed application error preserves its safe public code | FR-020 | example | DONE | `tests/unit/contracts.test.ts::U182 typed application error preserves safe public code` |
| U183 | Valid binary protocol outcomes remain valid at the runtime boundary | FR-014, FR-005 | example | DONE | `tests/unit/contracts.test.ts::U183 valid binary protocol outcome remains valid` |

### Coordinated schema boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U184 | Domain migration coordinates distinct auth and queue schemas | FR-006, FR-012, FR-022 | example | DONE | `tests/integration/database.test.ts::U184 migration coordinates auth and queue schemas` |
| U185 | A real forward upgrade preserves retained event bytes | FR-012 | example | DONE | `tests/integration/database.test.ts::U185 real forward upgrade preserves retained event bytes` |
| U186 | Application role can enqueue atomically without reading private queue tables | FR-002, FR-006 | example | DONE | `tests/integration/database.test.ts::U186 app role enqueues atomically without private queue reads` |

### Executor completion boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U187 | Cancellation interrupts a running nonyielding script | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U187 cancellation interrupts a nonyielding script` |
| U188 | An oversized script result is rejected under output quota | FR-011, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U188 oversized script result is rejected` |
| U189 | Standard Docker executor starts with no host mounts or Docker socket | FR-001, FR-017 | example | DONE | `tests/executor/isolation.test.ts::U189 standard Docker executor starts without host mounts` |

### Typed storage boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U190 | Drizzle reads retained bytes through typed domain mappings | FR-005, FR-012 | example | DONE | `tests/integration/database.test.ts::U190 Drizzle reads retained bytes through typed mappings` |

### Migration entrypoint

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U191 | Node migration entrypoint applies the committed schema | FR-001, FR-012 | example | DONE | `tests/integration/database.test.ts::U191 Node migration entrypoint applies committed history fixture` |

### Fast isolated fixture allocation

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U192 | Test infrastructure is reused with a fresh database for each case | SC-006, FR-012 | example | DONE | `tests/integration/database.test.ts::U192 fixture infrastructure reuse preserves database isolation` |

| U193 | Reused HTTP fixtures do not expose previous-case receipts | SC-006, FR-012 | example | DONE | `tests/integration/database.test.ts::U193 reused HTTP fixtures expose no earlier receipts` |

### Recovery authority positive boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U194 | A live current-generation owner can commit completion | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U194 live current owner commits completion` |

### Broker capability positive boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U195 | Valid signed broker capability preserves its pinned authority | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U195 valid capability preserves pinned execution authority` |

### Observed child exit boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U196 | Only observed-dead child worker IDs are passed to supported unlock API | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U196 observed dead child unlocks only exact worker IDs` |

### Claim and heartbeat boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U197 | A queued generation is claimed by at most one worker | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U197 queued generation is claimed once` |
| U198 | Only a current live owner can extend its database lease | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U198 only live current owner extends database lease` |

### Supervisor recovery timer

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U199 | A healthy supervisor automatically sweeps expired work every five seconds | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U199 healthy supervisor sweeps expired work automatically` |

### Lease expiry under lock contention

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U200 | Result authority is rechecked after waiting for its row lock | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U200 result authority rechecks expiry after row lock` |
| U201 | A heartbeat blocked past expiry cannot revive its old lease | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U201 heartbeat cannot revive lease after blocked expiry` |

### Abandoned transaction recovery bound

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U202 | Abandoned application transactions release database locks within ten seconds | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U202 abandoned transaction releases locks within timeout` |

### Worker heartbeat cadence

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U203 | Active workers renew live ownership every five seconds | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U203 active worker renews lease on five second cadence` |

### Validated server prerequisites and bounds

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U204 | Complete server configuration receives bounded alpha defaults | FR-011, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U204 complete server configuration receives bounded defaults` |
| U205 | Invalid execution limits are rejected without exposing configuration secrets | FR-011 | example | DONE | `tests/unit/contracts.test.ts::U205 invalid limits expose no configuration secrets` |

### Shared HTTP handler envelope

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U206 | Private commands return canonical unauthorized HTTP errors before invocation | FR-002, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U206 private HTTP command is unauthorized before invocation` |

### Browser API command ergonomics

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U207 | Browser commands send same-origin protected JSON requests | FR-020 | example | DONE | `tests/integration/live-api.test.ts::U207 browser commands send protected same origin JSON` |

### SMTP configuration boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U208 | Invalid SMTP TLS flags fail rather than silently downgrading | FR-011, FR-022 | example | DONE | `tests/unit/contracts.test.ts::U208 invalid SMTP TLS flag cannot silently downgrade` |

### JSON command input bounds

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U209 | JSON command body above its limit is rejected before parsing | FR-011, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U209 oversized JSON body is rejected before parsing` |
| U210 | JSON command at its byte limit preserves its public value | FR-011, FR-020 | example | DONE | `tests/integration/live-api.test.ts::U210 JSON body at limit retains public value` |

### Public configuration projection

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U211 | Public configuration contains no server credential fields or values | FR-011, FR-022 | example | DONE | `tests/integration/config.test.ts::U211 public configuration contains no server credentials` |

| U212 | Browser API bundles exclude private domain configuration code | FR-011, FR-020 | example | DONE | `tests/integration/config.test.ts::U212 browser bundle excludes private domain code` |

### Supported identity provisioning and rate schema

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U213 | Auth migration includes private provisioning and durable request-rate storage | FR-012, FR-022 | example | DONE | `tests/integration/auth.test.ts::U213 auth migration supports provisioning and durable rate policy` |

### OTP request dispatch and quota

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U214 | An active admitted account requests its code through Better Auth | FR-022 | example | DONE | `tests/integration/auth.test.ts::U214 active admitted account requests Better Auth code` |
| U215 | Configured per-email request limits survive process-local state | FR-022 | example | DONE | `tests/integration/auth.test.ts::U215 per email request quota is durable` |

### Durable mail privacy

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U216 | Durable OTP mail payload is encrypted and authenticated at rest | FR-011, FR-022 | example | DONE | `tests/integration/auth.test.ts::U216 durable mail payload is encrypted and authenticated` |

### Durable OTP dispatch

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U217 | OTP mail stores encrypted durable work and queues it atomically | FR-006, FR-022 | example | DONE | `tests/integration/auth.test.ts::U217 OTP mail creates encrypted recoverable dispatch` |

### Passwordless private identity provisioning

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U218 | Supported private provisioning creates identity without admitting it | FR-022, FR-023 | example | DONE | `tests/integration/auth.test.ts::U218 private provisioning creates non admitted identity` |

### Low-entropy OTP storage boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U219 | Stored email-code verification is keyed independently of the database contents | FR-011, FR-022 | example | DONE | `tests/integration/auth.test.ts::U219 stored OTP verifier is keyed outside database` |

### Mail scheduling privacy boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U220 | Mail scheduling failures do not reveal admitted account existence | FR-011, FR-022 | example | DONE | `tests/integration/auth.test.ts::U220 scheduling failure preserves generic code response` |

### Durable SMTP delivery

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U221 | A trusted queued OTP job sends its current code through SMTP | FR-022 | example | DONE | `tests/integration/auth.test.ts::U221 trusted OTP job sends current code through SMTP` |

### Trusted mail task boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U222 | Malformed mail job references fail before database access | FR-011, FR-022 | example | DONE | `tests/integration/auth.test.ts::U222 malformed mail reference fails before SQL` |

### Public Next authentication transport

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U223 | Public Next auth routes run the verified passwordless service | FR-022 | example | DONE | `tests/deployment/installation.test.ts::U223 Next auth route mounts passwordless service` |

### Resend invalidation

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U224 | A superseded queued email code is not sent | FR-022 | example | DONE | `tests/integration/auth.test.ts::U224 superseded queued OTP code is not sent` |

### Mail worker privileges and retry budget

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U225 | Mail worker can check current OTP records without session access | FR-002, FR-022 | example | DONE | `tests/integration/auth.test.ts::U225 mail worker reads OTP state without session access` |

### Critical platform-job recovery

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U226 | Expired mail ownership receives fresh recoverable generation | FR-008, FR-022 | example | DONE | `tests/integration/auth.test.ts::U226 expired platform ownership gets fresh generation` |

### Trusted mail attempt accounting

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U227 | A claimed mail job increments its bounded domain attempt counter | FR-008, FR-022 | example | DONE | `tests/integration/auth.test.ts::U227 claimed mail increments bounded attempt count` |

### Trusted mail retry scheduling

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U228 | SMTP failure schedules delayed fresh-generation durable mail retry | FR-008, FR-022 | example | DONE | `tests/integration/auth.test.ts::U228 SMTP failure schedules fresh delayed retry` |

### Mail exhaustion boundary

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U229 | Fifth failed mail attempt retains terminal state rather than retrying forever | FR-008, FR-022 | example | DONE | `tests/integration/auth.test.ts::U229 fifth failed mail attempt is terminal` |

### Critical platform-job supervisor integration

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U230 | Automatic supervisor recovery includes lost mail dispatches | FR-008, FR-022 | example | DONE | `tests/integration/auth.test.ts::U230 supervisor automatically recovers mail dispatch` |

### Discovered membership boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U231 | Inactive admission immediately loses inherited grants | FR-002, FR-023 | boundary | DONE | `tests/integration/authorization.test.ts::U231 inactive admission rejects inherited grants` |
| U232 | Membership API cannot grant additional rights or accept a stale write | FR-002, FR-023 | boundary | DONE | `tests/integration/authorization.test.ts::U232 membership rejects escalation and stale writes` |
| U233 | Tokens are hash-only and authentication observes scope and revocation | FR-002, FR-023 | boundary | DONE | `tests/integration/authorization.test.ts::U233 token creation stores only hash and revocation is immediate` |
| U234 | Setup mail requires operator secret and cannot reopen completed setup | FR-001, FR-023 | boundary | DONE | `tests/integration/auth.test.ts::U234 owner setup code is secret protected and closes permanently` |
| U235 | HTTP authentication checks current admission and completed setup | FR-002, FR-023 | boundary | DONE | `tests/integration/auth.test.ts::U235 request authentication denies anonymous and inactive sessions` |
| U236 | Resource creation is scoped and duplicate slugs cannot overwrite | FR-002, FR-023 | boundary | DONE | `tests/integration/authorization.test.ts::U236 resource creation scopes owner and preserves unique slugs` |

### Discovered API/configuration boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U237 | Inaccessible projects cannot consume a users listing limit | FR-002, FR-023 | boundary | DONE | `tests/integration/authorization.test.ts::U237 inaccessible projects do not consume listing limit` |
| U238 | Blank optional SMTP credentials select anonymous SMTP but partial credentials fail | FR-022 | boundary | DONE | `tests/unit/contracts.test.ts::U238 blank SMTP credentials are absent while partial auth fails` |
| U239 | API JSON parsing rejects lookalike media types | FR-021, FR-023 | boundary | DONE | `tests/integration/live-api.test.ts::U239 lookalike JSON media type is rejected before parsing` |

### Compiler service boundaries

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| U240 | Compilation runs in a bounded fresh trusted child and preserves editable diagnostics | FR-017, FR-024 | boundary | DONE | `tests/executor/compiler.test.ts::U240 isolated compiler preserves bundles and body diagnostics` |
| U241 | Executor compiler RPC requires its platform token and works in the prebuilt container | FR-017, FR-022 | boundary | DONE | `tests/executor/compiler.test.ts::U241 prebuilt executor provides authenticated compilation` |
| U242 | Shared code cannot read host files through TypeScript reference directives | FR-011, FR-017 | boundary | DONE | `tests/executor/compiler.test.ts::U242 TypeScript reference directives cannot read a host canary` |
| U243 | Large valid compiler output is completely flushed before child exit | FR-017, FR-024 | boundary | DONE | `tests/executor/compiler.test.ts::U243 large compiler result is flushed before child exits` |
| U244 | Embedded SDK declarations match the canonical source | FR-017, FR-024 | boundary | DONE | `tests/unit/contracts.test.ts::U244 embedded compiler SDK cannot drift from canonical source` |
| U245 | Public compilation errors preserve editable diagnostics without private internals | FR-021, FR-024 | boundary | DONE | `tests/unit/contracts.test.ts::U245 compilation API errors retain body line diagnostics` |
| U246 | Publication compiler client uses authenticated local RPC and validates replies | FR-017, FR-022 | boundary | DONE | `tests/integration/executor-client.test.ts::U246 compiler client authenticates and preserves validated diagnostics` |
| U247 | New ingress routes start unpublished and inactive code is not exposed to metadata-only users | FR-002, FR-004, FR-024 | boundary | DONE | `tests/integration/publication.test.ts::U247 ingress route creation is scoped and unpublished` |

| U248 | Body-only draft update preserves configured shared bindings | FR-017, FR-018 | boundary | DONE | `tests/integration/publication.test.ts::U248 body-only edit preserves configured shared bindings` |

| U249 | Script lifecycle helpers preserve binary bodies and call managed sends | FR-004, FR-007, FR-017 | integration | DONE | `tests/executor/isolation.test.ts::U249 script SDK helpers preserve bytes and invoke managed destination` |

| U250 | Executor HTTP RPC preserves binary request and response bodies | FR-004, FR-011, FR-014 | integration | DONE | `tests/integration/executor-client.test.ts::U250 executor HTTP invocation preserves binary bodies` |

| U251 | HTTP broker enforces live signed capabilities and preserves binary send bodies | FR-007, FR-011, FR-015 | integration | DONE | `tests/integration/delivery.test.ts::U251 HTTP broker requires current signed execution authority` |

| U252 | Direct script fetch encodes large binary bodies within the configured limit | FR-007, FR-011, FR-014 | boundary | DONE | `tests/executor/isolation.test.ts::U252 direct fetch preserves a large binary request body` |

| U253 | Restricted worker image picks durable work and brokers delivery from the deployment network | FR-007, FR-008, FR-011, FR-012 | deployment | DONE | `tests/deployment/images.test.ts::U253 restricted worker image delivers accepted bytes through isolated executor` |

| U254 | First configured destination becomes the project default while later defaults are explicit | FR-007, FR-015 | example | DONE | `tests/integration/delivery.test.ts::U254 first destination is default and explicit switch is atomic` |

| U255 | Published default selection wins over a destination literally named default | FR-007, FR-015, FR-017 | boundary | DONE | `tests/integration/delivery.test.ts::U255 pinned explicit default wins over legacy default name` |

| U256 | Destination edits use optimistic version checks without overwriting another operator | FR-007, FR-018 | boundary | DONE | `tests/integration/delivery.test.ts::U256 stale destination editor cannot overwrite saved target` |

| U257 | Exhausted executions cannot acquire a sixth default processing attempt | FR-008, FR-025 | boundary | DONE | `tests/integration/recovery.test.ts::U257 sixth default execution attempt cannot be claimed` |

| U258 | Escaped secret values are redacted before structured log serialization | FR-011, FR-017 | boundary | DONE | `tests/executor/isolation.test.ts::U258 quoted and multiline secrets are redacted from structured logs` |

| U259 | Secret selector exposes authorized version metadata without values or unrelated parent secrets | FR-002, FR-011, FR-017, FR-023 | boundary | DONE | `tests/integration/publication.test.ts::U259 secret selector only returns authorized metadata` |

| U260 | Configuration APIs expose authorized destinations and secret metadata without secret values | FR-002, FR-007, FR-011, FR-023 | integration | DONE | `tests/deployment/installation.test.ts::U260 configuration API exposes scoped destinations and secret metadata` |

| U261 | Project dashboard creates actual ingress routes and default HTTP destinations | FR-003, FR-007, FR-023 | browser | DONE | `tests/acceptance/dashboard.spec.ts::U261 project dashboard configures ingress route and destination` |

| U262 | Dashboard API client retains source-position diagnostics from publication errors | FR-017, FR-024 | boundary | DONE | `tests/integration/live-api.test.ts::U262 API client keeps publication diagnostic source positions` |

| U263 | Editable default delivery template derives completion/retry from actual managed-send result | FR-007, FR-010, FR-013, FR-015 | example | DONE | `tests/integration/publication.test.ts::U263 default processing template retries unsuccessful managed send` |

| U264 | Recovery terminates exhausted crashed executions rather than leaving an unclaimable queue loop | FR-008, FR-025 | boundary | DONE | `tests/integration/recovery.test.ts::U264 crashed final attempt becomes terminal without another dispatch` |

| U265 | HMAC route editor creates encrypted secret versions and saves explicit bindings | FR-003, FR-004, FR-011, FR-017, FR-024 | browser | DONE | `tests/acceptance/dashboard.spec.ts::U265 route editor binds an encrypted signing secret version` |

| U266 | Ingress scripts and event history exclude Payload Bay session cookies and platform API credentials | FR-002, FR-011, FR-023 | boundary | DONE | `tests/integration/ingress.test.ts::U266 ingress cannot read or persist platform session credentials` |

| U267 | Newly created routes default to managed delivery rather than premature processing completion | FR-007, FR-010, FR-013 | example | DONE | `tests/integration/publication.test.ts::U267 new route processing retries failed default delivery` |

| U268 | Provider response cannot set application cookies or hop-by-hop transport headers | FR-004, FR-011, FR-014 | boundary | DONE | `tests/unit/contracts.test.ts::U268 provider response cannot set application cookies or transport headers` |

| U269 | Pausing delivery still durably accepts incoming events while preventing new processing claims | FR-006, FR-008, FR-010 | example | DONE | `tests/integration/ingress.test.ts::U269 paused delivery continues durable event acceptance without processing claim` |

| U270 | Resuming delivery promptly offers queued events with fresh fenced dispatches | FR-006, FR-008, FR-010 | example | DONE | `tests/integration/ingress.test.ts::U270 resume replaces unclaimed paused offer without waiting for deadline` |

| U271 | Real event API separates metadata/payload privileges and durable replay | FR-002, FR-003, FR-005, FR-010 | integration | DONE | `tests/deployment/installation.test.ts::U271 event API separates metadata payload and replay privileges` |

| U272 | Durable SSE cursors follow transaction commit order across concurrent changes | FR-003, FR-023, FR-026 | concurrency | DONE | `tests/integration/live-api.test.ts::U272 durable changes serialize cursor allocation until prior commit` |

| U273 | Accepted events commit a durable live-change reference in the acceptance transaction | FR-006, FR-026 | integration | DONE | `tests/integration/ingress.test.ts::U273 acceptance includes durable change without private payload` |

| U274 | Live backfill exposes authorized resource references without unrelated scopes or metadata | FR-002, FR-020, FR-021 | boundary | DONE | `tests/integration/live-api.test.ts::U274 live backfill excludes unrelated scope and private data` |

| U275 | Event dashboard updates from authenticated SSE without a manual reload | FR-020, FR-021 | boundary | DONE | `tests/acceptance/dashboard.spec.ts::U275 stored event appears through authenticated live updates` |

| U276 | Discrete runtime advice uses the real scoped notification inbox with personal dismissal | FR-027 | boundary | DONE | `tests/acceptance/dashboard.spec.ts::U276 administrator opens and personally dismisses runtime advice` |

| U278 | Authoritative Drizzle source recreates required defaults keys and relational constraints | FR-001, FR-012 | boundary | DONE | `tests/integration/database.test.ts::U278 Drizzle source recreates complete usable domain schema` |

| U279 | Disposable development bootstrap uses authoritative source without generating release migrations | FR-001, FR-012 | boundary | DONE | `tests/integration/database.test.ts::U279 development bootstrap installs current source with no release artifacts` |

| U280 | Feature branches cannot generate or stage CI-owned release migration artifacts | FR-012 | boundary | DONE | `tests/unit/tooling.test.ts::U280 migration generation belongs to master CI only` |

| U281 | Development db push installs current source and runtime invariants without migration generation | FR-001, FR-012 | boundary | DONE | `tests/integration/database.test.ts::U281 db push installs developer schema without release generation` |

| U282 | Missing CI release artifacts fail before database initialization with no development fallback | FR-012 | boundary | DONE | `tests/integration/database.test.ts::U282 missing release artifacts fail before any database connection` |

| U283 | SMTP verification fixture selects a new message for the intended recipient despite indexing lag | FR-023 | discovered | DONE | `tests/unit/tooling.test.ts::U283 OTP selector matches new recipient mail despite stale index count` |

| U284 | Middleware uses stage-specific typed patches and cannot replace immutable request identity or original bytes | FR-019, FR-024 | boundary | DONE | `tests/unit/contracts.test.ts::U284 middleware continuation accepts only stage appropriate mutable fields` |

| U285 | Pinned middleware runtime orders scopes and isolates mutable context between calls | FR-019 | boundary | DONE | `tests/integration/middleware.test.ts::U285 pinned middleware executes hierarchy then scope order before handler` |

| U286 | Middleware fixed wrappers expose typed continuation in real workerd execution | FR-019, FR-024 | boundary | DONE | `tests/executor/compiler.test.ts::U286 typed middleware continuation runs in real workerd` |

| U287 | Shared modules cannot hide dynamic imports outside the registered dependency graph | FR-011, FR-018, FR-024 | boundary | DONE | `tests/executor/compiler.test.ts::U287 shared source cannot dynamically import an unregistered runtime module` |

| U288 | Actual ingress and trusted job pickup execute each publication-pinned middleware stage | FR-004, FR-019 | boundary | DONE | `tests/integration/middleware.test.ts::U288 actual ingress and worker execute their pinned middleware stages` |

| U289 | Middleware edits use version conflicts and leave recorded publication code unchanged | FR-017, FR-019 | boundary | DONE | `tests/integration/middleware.test.ts::U289 middleware edit conflicts preserve publication pinned revision` |

| U290 | Real shared-code and middleware APIs enforce scoped token rights and optimistic versions | FR-002, FR-018, FR-019, FR-020 | boundary | DONE | `tests/deployment/installation.test.ts::U290 real API manages scoped shared code and versioned middleware` |

| U291 | Middleware PATCH preserves omitted secret shared and required-action settings | FR-017, FR-019 | boundary | DONE | `tests/unit/contracts.test.ts::U291 middleware patch does not invent omitted configuration defaults` |

| U292 | Dashboard creates local shared helpers and typed middleware through the real API | FR-018, FR-019, FR-026 | boundary | DONE | `tests/acceptance/dashboard.spec.ts::U292 project code page creates helper version and processing middleware` |

| U293 | Project navigation opens scoped code management | FR-018, FR-019 | example | DONE | `tests/acceptance/dashboard.spec.ts::U293 project navigation opens scoped code management` |

| U294 | Executor RPC preserves zero direct-fetch budget | FR-017, FR-018 | example | DONE | `tests/executor/compiler.test.ts::U294 executor RPC preserves zero direct-fetch budget` |

| U295 | Merged middleware patch obeys aggregate limits | FR-017, FR-019 | example | DONE | `tests/integration/middleware.test.ts::U295 merged middleware patch obeys aggregate limits` |

| U296 | Project member navigation uses project scope | FR-004 | example | DONE | `tests/acceptance/dashboard.spec.ts::U296 project member navigation uses project scope` |

| U297 | Dry executor simulates managed delivery without network | FR-017, FR-018 | example | DONE | `tests/executor/compiler.test.ts::U297 dry executor simulates managed delivery without network` |

| U298 | Real API executes synthetic draft and denies missing test permission | FR-018 | example | DONE | `tests/deployment/installation.test.ts::U298 real API executes synthetic draft and denies missing test permission` |

| U299 | Action feedback appears in toasts instead of inline boxes | UI feedback | example | DONE | `tests/acceptance/dashboard.spec.ts::U299 action feedback appears in toasts instead of inline boxes` |

| U300 | Route editor tests unsaved ingress with synthetic fixture | FR-018 | example | DONE | `tests/acceptance/dashboard.spec.ts::U300 route editor tests unsaved ingress with synthetic fixture` |

| U301 | Code scope picker navigates workspace and project | FR-018, FR-019 | example | DONE | `tests/acceptance/dashboard.spec.ts::U301 code scope picker navigates workspace and project` |

| U302 | Repeated saves show fresh dismissible toast feedback | UI feedback | example | DONE | `tests/acceptance/dashboard.spec.ts::U302 repeated saves show fresh dismissible toast feedback` |

| U303 | Publication enforces shared dependency limits before activation | FR-017, FR-018 | example | DONE | `tests/integration/publication.test.ts::U303 publication enforces shared dependency limits before activation` |

| U304 | Real API manages opt-in rules with scoped permissions and versions | FR-028 | example | DONE | `tests/deployment/installation.test.ts::U304 real API manages opt-in rules with scoped permission and versions` |

| U305 | Project dashboard configures explicit route failure notifications | FR-028 | example | DONE | `tests/acceptance/dashboard.spec.ts::U305 project dashboard configures explicit route failure notifications` |

| U306 | Real pause/resume APIs preserve scoped versions | FR-008, FR-010 | example | DONE | `tests/deployment/installation.test.ts::U306 real pause and resume APIs preserve scoped versions` |

| U307 | Route editor pauses/resumes delivery with versioned commands | FR-008, FR-010 | example | DONE | `tests/acceptance/dashboard.spec.ts::U307 route editor pauses and resumes delivery with versioned commands` |

| U308 | Invalid native provider responses never commit accepted work | FR-005, FR-006, FR-014 | example | DONE | `tests/integration/ingress.test.ts::U308 invalid native provider responses never commit accepted work` |

| U309 | Executor wire budget preserves maximum escaped and binary bodies | FR-011, FR-014, FR-017 | example | DONE | `tests/executor/compiler.test.ts::U309 executor wire budget preserves maximum escaped and binary bodies` |

| U310 | Configuration cannot advertise unsupported alpha payload limits | FR-011, FR-014 | example | DONE | `tests/unit/contracts.test.ts::U310 configuration cannot advertise unsupported alpha body or header limits` |

| U311 | Resumed old jobs receive a fresh claim window | FR-008, FR-016 | example | DONE | `tests/integration/recovery.test.ts::U311 a resumed old job gets a fresh claim window` |

| U312 | Accepted metadata stays within the processing metadata budget | FR-014, FR-017 | boundary | DONE | `tests/unit/contracts.test.ts::U312 accepted metadata stays within the processing metadata budget` |

| U313 | SMTP subscriptions require current scoped notification access | FR-027, FR-028 | example | DONE | `tests/integration/notifications.test.ts::U313 SMTP subscriptions require current scoped notification access` |
| U314 | Active incident email dispatch is durable and deduplicated | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U314 active incident email dispatch is durable and deduplicated` |
| U315 | Opted-in authorized recipient receives an SMTP incident summary | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U315 opted-in authorized recipient receives an SMTP incident summary` |

| U316 | Continuous failure producer queues opted-in SMTP notifications | FR-028 | example | DONE | `tests/integration/notifications.test.ts::U316 continuous failure producer queues opted-in SMTP notifications` |

| U317 | Scoped notification readers manage only their own SMTP preferences through API | FR-027, FR-028 | example | DONE | `tests/deployment/installation.test.ts::U317 scoped readers manage only their own SMTP preferences through API` |

| U318 | Source-build preview | PR images build locally from source and wait for preview schema | deployment | DONE | `tests/deployment/preview.test.ts` |

| U319 | Coolify runtime selects the actual preview base URL over stale explicit configuration | FR-022, FR-029 | boundary | DONE | `tests/unit/contracts.test.ts::U319 base URL follows Clipify Coolify runtime precedence` |

| U320 | Fresh preview seeds the known admitted reviewer and sample project with real OTP login | FR-022, FR-029 | example | DONE | `tests/integration/preview.test.ts::U320 preview seed provisions a repeatable admitted demo owner and project` |
| U321 | Preview warning is evaluated at runtime and absent from ordinary installations | FR-029 | example | DONE | `tests/integration/preview.test.ts::U321 preview warning is shown by runtime mode and absent outside previews` |
| U322 | Adding another owner cannot permit demoting the fixed preview reviewer identity | FR-002, FR-029 | boundary | DONE | `tests/integration/preview.test.ts::U322 preview reviewer cannot be locked out by adding another owner then demoting the demo account` |

## Organization/metering foundation extension — planned 2026-10-16

These are pending behavior scenarios for F01–F12, not green tests. New test paths
must be registered before execution; the following ownership is the design target.
Existing behavior suites remain mandatory when affected.

| Group | Required red/green scenarios | Owning route after registration |
| --- | --- | --- |
| FT01 organization lineage | Required org parent, sibling/installation mismatch, safe repeat mapping, no widened historical grants/changed IDs or lost jobs | integration organization suite |
| FT02 permissions | Org inheritance, project-only parent privacy, multi-org membership, last-owner transfer, operator suspension | integration authorization/organization suites |
| FT03 full isolation | Direct IDs, lists/aggregates/search, tokens, SSE/backfill/revocation, secrets/helpers/middleware/publications, job/broker lineage | existing domain/live/token/code suites plus org isolation suite |
| FT04 onboarding | Concurrent verified provisioning, resumable setup, defaults, existing invitation instead of extra org, signup policy off by default | auth/organization integration and onboarding browser suite |
| FT05 invitations | Org inviter admits new verified member without global grant, cannot revive suspended user or grant sibling roles; cancel/expire/recheck | invitation/auth integration |
| FT06 usage facts | Ingress outcomes, atomic rollback, no secrets, positive quantities/ownership constraints, duplicate identity only counted once | usage/ingress integration |
| FT07 execution usage | Logical initial/replay executions, retries/claims separate, generation recovery/heartbeats/cache don't inflate; fenced terminal writes | usage/replay/recovery/delivery integration |
| FT08 retained totals | Payload/history pruning leaves facts/totals; UTC-window queries, reconciliation and no cross-org aggregate leak | usage integration |
| FT09 local policy | Unlimited self-host still meters, absent network dependency, operator-only revisioned writes, malformed hosted policy failure | policy/config integration |
| FT10 atomic quotas | Parallel resource creates at last slot, transactional usage admission, quota change preserves accepted work | organization policy/ingress integration |
| FT11 capacity | Multi-process claims, lease expiry/restart/stale completion, no attempt burned while deferred, destination concurrency, no spin, bounded other-org progress | recovery/delivery/container integration |
| FT12 UI/deployment | Native modal/table onboarding, scoped contexts/breadcrumb/search, new/invited OTP, unrelated-org preview accounts, released image setup/mapping | browser and deployment lanes |

Do not mark these complete from prior project-only preview evidence. This planning
update did not execute the implementation TDD run hook or generate release SQL.

### Active foundation behavior cycles

These granular cases track implementation evidence. They do not mark an entire
F-task or release gate complete. The earlier scenario matrix is a planning index;
case IDs below follow the implemented F-task ownership.

| ID | State | Behavior | Owning suite |
| --- | --- | --- | --- |
| FT01a–e | DONE | Required organization, local slugs, preserved historical IDs/grants, staged migration constraint, archived mapping | organizations.test.ts |
| FT02a–c | DONE | Organization parents and inherited ownership exclude sibling workspaces; last active owner survives transfer | organizations.test.ts |
| FT03a–c | DONE | Scoped SSE, archive revocation, immutable resource parent | organizations.test.ts |
| FT03e–i | DONE | Unrelated-customer secrets/helper pins, scoped tokens despite multi-org membership, suspension, event/analytics/live isolation and cross-org publication/middleware pins and accessible token revocation | organizations.test.ts |
| FT03d | DONE | Archived organization cannot accept new ingress | ingress.test.ts |
| FT04a–e | DONE | Atomic owner defaults/rollback, idempotent customer provisioning, narrow verified session, default-off registration | organizations.test.ts |
| FT05a | DONE | Organization invitation admission never grants global role or revives inactive identity | organizations.test.ts |
| FT06a | DONE | Organization collection and scoped workspace modal | dashboard.spec.ts |
| FT06c | DONE | Organization code and member screens retain scoped permissions and navigation | dashboard.spec.ts |
| FT06b | DONE | Mobile real-email onboarding through first project and ingress route | onboarding.spec.ts |
| FT07a–e | DONE | Concurrent fact dedup, immutable facts, atomic counter rollback, tenant lineage, UTC window boundaries, rollup reconciliation, and source-history pruning independence | metering.test.ts |
| FT08a–d | DONE | Atomic ingress metrics, recovery/claims separate from logical work, terminal failure and idempotent replay | ingress.test.ts |
| FT08f | DONE | Oversized transformed outcome retains bounded raw ingress/error fact without accepted work | ingress.test.ts |
| FT08e | DONE | Cached send does not create another managed attempt | delivery.test.ts |
| FT09a–g | DONE | Unlimited self-host defaults, hosted invalid-policy rejection, optimistic audited writes, resource/admission races and accepted-work preservation | organization-policy.test.ts / ingress.test.ts |
| FT10a–f | DONE | Serialized org capacity, no-attempt preclaim deferral, real queue fairness, legacy eligibility and destination expiry/fencing and independent process replacement | recovery.test.ts / organizations.test.ts / delivery.test.ts |
| FT11a–b | DONE | Authorized policy reads and real mobile usage window/policy/API flow | organization-policy.test.ts / dashboard.spec.ts |

Foundation affected verification and exact-source remote preview are complete at
f5a71d5; see cycle-log.md for broad lanes, infrastructure-blocked cases and their
passing targeted reruns. Four real OTP reviewer roles, unrelated-organization
isolation, a new queued HTTP delivery and local usage passed on Coolify. Separate
original alpha release gates remain open. No release SQL was generated locally.


### API-key settings — maintainer 2026-10-17

| id | behavior | traces | kind | state | test |
|---|---|---|---|---|---|
| K01a | Personal settings creates a scoped show-once key and revokes it | K01, K04 | example | DONE | `tests/acceptance/api-docs.spec.ts::K01 personal settings creates a show-once API key and revokes it` |
| K02a | Organization settings supports all or selected workspace access | K02, K04 | example | DONE | `tests/acceptance/api-docs.spec.ts::K02 organization settings creates a key limited to selected workspaces` |
| K03a | A persisted workspace restriction excludes siblings and organization-wide access | K03 | example | DONE | `tests/integration/authorization.test.ts::K03 organization keys enforce a persisted selected-workspace boundary` |
| K03b | Foreign scopes, escalation and invalid workspace restrictions are refused | K03 | example | DONE | `tests/integration/authorization.test.ts::K03 organization keys enforce a persisted selected-workspace boundary` |

| R08a | Bounded dialogs center on desktop and stay viewport-bound on mobile | R08 | example | DONE | `tests/acceptance/dashboard.spec.ts::R08 bounded dialogs center on desktop and remain inside the mobile viewport` |

- L01 DONE: optional runtime sign-in information is escaped plain text, absent when blank (including preview), no account selector/prefill and hidden during OTP entry; bootstrap browser owner.

- LIV01 DONE: dashboard events, overview and notification inbox share one authorized EventSource; real committed producers update both consumers and client navigation retains the same connection. `tests/acceptance/dashboard.spec.ts::U157 dashboard multiplexes`. Open-attempt timeline U157b also passed in the complete 53-test browser checkpoint.

- AD01 DONE: instance-authorized audit API/UI exposes bounded metadata without raw diffs/secrets, stable pagination, invalid cursor/limit rejection and current-rights enforcement. Completes the audit portion of T077.

- AD03 DONE: failed next-page request must retry on Load more without discarding visible audit history. Browser test proves the second click never requests the unchanged cursor.

- IH01 DONE: instance settings/health inspection projects safe configuration and measured database/executor health, distinguishes unmeasured services and denies lower-scope/current-rights removal.

- TG01 DONE: registered files with unknown owning lanes must fail inventory validation instead of being omitted; performance is a recognized separate lane.

- PF01 DONE: measured release acceptance, 600 real HTTP requests at10/s for60s with1000 lower-priority queued executions; p95 ACK<=1s, p95 stored acceptance-to-first-attempt<=2s, no critical wait>10s. Record fixture/image/resource conditions and all results before asserting. Existing-system acceptance; no fabricated pre-implementation Red.

- RT01 DONE: event retention configuration defaults disabled, accepts explicit whole-day windows and rejects invalid/negative/fractional/out-of-bounds values.


- RT03 DONE (test-after): disabled cleanup and actual non-superuser app/worker capability/immutability/batch boundaries.
- RT04 DONE (test-after): lease expiry mid-delete rolls back pruning and audit together.

- RT05 DONE: pruning wins the event lock; concurrent replay returns controlled not_found.

- RT06 DONE: post-lock fresh-snapshot eligibility preserves newly committed replay work; non-read-committed calls are rejected by the deletion capability.

- RT02 DONE: old completed/protocol-only event pruning preserves pending work and usage/audit/code history.
- RT07 DONE: full bounded batches queue a single durable continuation; duplicate references and short batches do not extend it.
- RT08 DONE: recovered maintenance preserves low priority and dedicated queue classification.
- RT09 DONE: actual Graphile runners keep platform/mail capacity available while maintenance is blocked (behavioral Red then Green).
- RT10 DONE: concurrent producers deduplicate hourly work; default-disabled config schedules nothing (initial missing-entrypoint observation, no fabricated behavioral Red).
- RT11 DONE: producer immediate scheduling and stop/drain lifecycle (initial missing-module observation, no fabricated behavioral Red).
- RT12 DONE (test-after): real worker startup schedules and executes opt-in cleanup without an operator command.
- RT13 DONE: instance settings safely expose the default-disabled and configured retention window (IH02; native IH01 browser flow).
- RT14 DONE: pruning invalidation is payload-free, limited to affected projects and rolled back with failed cleanup.
- RT15 DONE: actual live pruning removes an expired row and closes an open inspector without an action-error toast.
- RT16 DONE: real database daylight-saving offsets cannot shorten or extend the configured elapsed-day boundary.
