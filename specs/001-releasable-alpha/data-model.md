# Alpha data model

Design artifact; schema/runtime sources own implementation and CI owns release migrations. PostgreSQL domain schema is separate from Better Auth and Graphile internals. Use supported Graphile APIs, not private table manipulation. UUID resource identifiers; UTC timestamps; byte payloads; Zod/public contracts independent of tables.

## Access and configuration

| Entity           | Key fields / relationships                                                                              | Invariants                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Installation     | id, bootstrapState, configVersion, mail/provider configuration references                               | Exactly one successful bootstrap; operator environment secrets never returned                                       |
| Identity/Session | Better Auth user/session IDs, normalized email, active, expiresAt                                       | Identity does not imply domain membership; public signup disabled                                                   |
| Passkey          | Better Auth credential ID/public key/counter, userId, device metadata                                   | Auth-library-owned; private keys stay on the authenticator; active admission required for a session                 |
| Invitation       | id, installationId, primary scope, normalized email, tokenDigest, pending grants, creator, expiry/state | Hash-only token; grants applied after matching verified acceptance/current authority checks; cancellation auditable |
| Admission        | installationId,userId,active                                                                            | Unique pair; ordinary admission grants no global role                                                               |
| Organization     | id,installationId,name,slug,ownerUserId,archivedAt | Customer/company; future subscription owner; owner admitted; no public global-admin grant |
| Workspace        | id,organizationId,installationId,name,slug,ownerUserId,archivedAt                                                      | Unique live slug per organization; consistent installation parent; owner admitted/active; last-owner protection                                     |
| Project          | id,workspaceId,name,slug,ownerUserId,archivedAt                                                         | Unique live slug per workspace; explicit scoped ownership                                                           |
| Grant            | id,userId,scopeType/scopeId,rolePreset,effectivePermissions,version                                     | Positive inherited grants; no child deny; grantor cannot escalate                                                   |
| ApiToken         | id,userId,scopeId,permissionSet,hash,expiresAt,revokedAt                                                | Hash only; token rights intersect current user rights                                                               |
| SecretVersion    | id,scopeId,reference,name,encryptedValue,keyId,version,revokedAt                                        | Explicit use/manage rights; never in payload logs/revision plaintext                                                |

Owner transfer and last-owner changes occur transactionally and audit the actor. Scope predicates apply to all resources including list/search/live cursors. Instance grants intentionally cross workspaces; admission alone does not.

## Code, destinations and acceptance

| Entity                     | Key fields / relationships                                                                                       | Invariants                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Endpoint                   | id,projectId,slug,activePublicationId,paused,priority,configVersion                                              | Multiple endpoints per project; publication switch atomic                                                         |
| Draft                      | id,endpointId,stage,body,sharedBindings,version                                                                  | Optimistic concurrency; ingress body is a named-method module; processing/middleware wrappers stay platform-owned |
| StageRevision              | id,stage,bodyDigest,body,SDKVersion,bundleDigest,sourceMapRef                                                    | Immutable validated ingress/processing source                                                                     |
| SharedModuleRevision       | id,scopeId,name,sourceDigest,bundleDigest                                                                        | Frozen imports/dependencies; copy creates local provenance                                                        |
| MiddlewareRevision/Binding | codeRevisionId,scopeId,stage,order,failurePolicy,overridePolicy,originBindingId                                  | Deterministic resolved order; authorized override only                                                            |
| Publication                | id,endpointId,ingressRevisionId,processingRevisionId,effectiveBindings,sharedVersions,dependencyDigest,createdBy | Immutable complete execution manifest; parent edits do not mutate old runs                                        |
| Destination                | id,projectId,name,HTTP config,secretRefs,concurrency,version                                                     | Address categories allowed; actual reachability sender-specific                                                   |
| Event                      | id,endpointId,publicationId,receivedAt,originalBody,headers,contentType,acceptedBody/metadata                    | Original bytes immutable; redacted metadata separate; future derivedFromEventId nullable                          |
| Receipt                    | id,eventId,ackResponseDigest,acceptedAt                                                                          | Accepted event/execution/job in same transaction; response not emitted before commit                              |

Pinned configuration includes destination request snapshot/reference version for reproducible recovery. Secret material remains encrypted/use-authorized; emergency revocation overrides a queued execution and produces visible failure. No promise to retain every retired secret forever. Alpha replay uses original publication/config by default; explicit current-publication replay is audited. Edited payload replay remains future.

## Execution and managed effects

| Entity           | Fields                                                                                                                        | Invariants                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Execution        | id,eventId,publicationId,replayOfId,state,attemptNumber,dispatchGeneration,dueAt,leaseOwner/expiry,pausedAtPolicy,finalResult | Domain lifecycle authoritative; Graphile completion does not erase it                         |
| Dispatch         | executionId,generation,graphileJobId,jobKey,scheduledAt,claimDeadlineAt                                                       | Unique execution/generation; fresh key on recovery; no per-execution named queue lock         |
| ManagedOperation | executionId,operationId,inputDigest,destinationSnapshot,state,successfulAttemptId                                             | Unique pair; reused key with changed input rejected; same-generation single attempt ownership |
| DeliveryAttempt  | id,operationId,executionAttempt,generation,startedAt,endedAt,statusCode/networkError,responseDigest,duration                  | Immutable actual history; bounded/redacted response storage                                   |
| PlatformJob      | id,kind,state,generation,dueAt,expiry,lease,redactedPayloadRef                                                                | Trusted mail/cleanup; critical mail generation recoverable; expired OTP never sent            |
| Audit            | id,actor,scope,operation,resourceId,time,redactedDiff                                                                         | Append-only operator/policy history                                                           |
| ChangeRecord     | monotonic cursor,scope,kind,resourceId,time                                                                                   | Same transaction as visible domain update; NOTIFY only hint, authorized backfill              |

Execution states: queued → running → succeeded / retry_wait / failed_terminal. retry_wait → queued at due time; operator replay creates a new queued execution even from succeeded. Pause is dispatch policy: running work may finish; queued work stays queued and parked without deleting events. Resume atomically schedules parked work. No arbitrary instruction-pointer continuation.

Managed operation states: ready → sending → succeeded / failed / uncertain. A committed successful outcome is reusable during recovery; failed outcomes permit another recorded attempt. Sending/uncertain after owner loss may need another at-least-once attempt. Never promise exactly-once HTTP.

Recovery uses PostgreSQL server time, compare-and-swap expected generation/live lease, heartbeat every5s, 30s lease and every5s sweep. Sweep covers expired running leases and overdue unclaimed queued dispatch offers (dueAt+30s), excluding paused scopes. This includes a crash after Graphile claim but before domain claim. Sweep transaction creates fresh dispatch and increments generation; old broker/results rejected. Concurrent sweepers cannot both advance same generation. Index due/state/lease expiry, endpoint/time event browsing, scope/user grant lookup and execution/operation identity. Product histories outlive queue rows. Retention excludes unfinished work/revisions it references.

## Migration and validation

Drizzle owns append-only domain migrations; Better Auth and Graphile schema updates coordinated under migration lock. Use distinct least-privilege app/worker/executor responsibilities. Empty install and forward upgrade reach equivalent schemas; pause/drain or test mixed versions explicitly. Test referential scope mismatch, bootstrap/last-owner race, duplicate operation digest conflict, atomic rollback, stale generation writes and cursor gaps. Never infer applied production migrations from experiment branches.

## Notification backbone (design extension)

| Entity                     | Fields                                                                                                            | Invariants                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| NotificationRule           | id,projectId,endpointId?,destinationId?,enabled,signal,count,window,severity,recoveryPolicy,cooldown,version      | No automatically active failure rule; count/window positive; filters stay within owning project                                    |
| NotificationIncident       | id,conditionKey,revision,generation,kind,scope,subject,severity,status,firstSeen,lastSeen,resolvedAt,redactedData | One active identity per condition/revision; repeats update, resolution preserves history; new incident generation may notify again |
| NotificationRecipientState | incidentId,userId,readAt,dismissedAt                                                                              | Unique incident/user; dismissal per-user and restart-persistent, not global resolution                                             |
| NotificationDispatch       | incidentId,generation,userId,channel,state,platformJobId                                                          | Unique incident-generation/user/channel; current permission/preferences rechecked before SMTP                                      |

Incident changes append authorized ChangeRecord in the same transaction. No arbitrary HTML/private webhook bodies in notification data. Existing Endpoint IDs represent UI ingress-route filters. Version-check/probe producers remain future scope.

2026-10-15 review: NotificationRule has exactly one of projectId or workspaceId.
Workspace rules do not bind a route/destination and aggregate their descendant
projects. NotificationSubscription remains per rule/user/channel with SMTP off by
default. Invitation and passkey tables are covered by development initialization;
release migration files remain CI-generated after merge.

### Ingress history clarification — 2026-10-15

Event storage also retains bounded active-route requests whose valid ingress
outcome is reject or respondOnly, or whose handler fails (error). `ingress_outcome` distinguishes these immutable
records from accept (default for existing accepted history); `request_method` and
`response_status` expose request/response metadata. Non-accepted rows have an
empty accepted body, no receipt, execution, dispatch or job, and cannot be replayed
for delivery. `event.recorded` changes refresh these rows through authorized SSE.
Accepted-event/job atomicity is unchanged. Delivery-attempt list view returns one
row per attempt with the original event ID for inspection.

## Organization usage and policy extension — planned 2026-10-16

Organization is required above workspace. Self-hosted grants inherit instance →
organization → workspace → project. Hosted authorization begins at organization;
platform instance grants never supply customer rights. Customer-invited staff
use ordinary explicit membership, acceptance and revocation. The physical
ownership chain remains instance → organization → workspace → project. Existing scope IDs/history survive an explicit additive
alpha-data mapping; existing scoped members gain no broader grants. Cross-org
moves are unavailable until a separately designed transfer exists.

| Entity | Fields | Invariants |
| --- | --- | --- |
| UsageFact | organizationId, workspaceId/projectId where relevant, metric, sourceKey, quantity bigint, occurredAt | Append-only, unique metric/source identity, no payload/secrets; authoritative occurrence and tenant are immutable |
| UsageCounter / rollup | organizationId, metric, explicit time bucket/window, quantity bigint | Updated only for inserted facts; reconcilable; payload pruning does not reset totals |
| OrganizationPolicy | organizationId, revision, typed capabilities/resource ceilings/work limits, optional explicit measurement window | Operator-controlled, validated/audited; null commercial ceiling means unlimited; no provider calls on request path |
| Capacity authority | organization/destination association, execution/operation identity, generation/lease authority | Atomic claim, bounded deferral, expired capacity recoverable, stale owner cannot release replacement authority |
| Onboarding provisioning | verified identity + idempotency/provisioning state + resulting organization/workspace IDs | Exactly one result under retries; invitation path joins existing scope; no instance role escalation |

These definitions are pending runtime work. Use existing execution lease/state
as the capacity authority where possible rather than adding a competing lease
system. See [tenant-metering contract](contracts/tenant-metering.md) for precise
fact identities, failure behavior and source insertion points.
