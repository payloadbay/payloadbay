# Script lifecycle and executor ABI v1

## Editor/publication input

Endpoint owns two stage slots: ingress and processing. API/editor source is {stage,body,sharedModuleBindings,draftVersion}. Platform generates frozen default-export wrapper and typed ctx; user edits body/helper modules only. Shared module imports are generated above wrapper, exposed as typed namespaces; no static import inside function body, arbitrary module/path imports or shell/native install scripts. Compilation/type/policy validation and runtime tagged-result validation enforce the contract even for API submissions. Source maps convert generated line errors to sourceId/line/column; stage names are registry identity, not mutable user function names.

Publication pins both bodies, source maps, resolved middleware/shared revisions, dependency bundle digest and SDK version. Draft edits never mutate published/queued behavior. Test uses synthetic fixtures and dry-run managed operations by default; actual sends/secrets require explicit authorized test mode and audit. Secrets never included in returned compilation data.

## Ingress

Input: immutable original body bytes, preserved header values/content type, endpoint identity, receipt timestamp, trusted network metadata, scoped helper namespaces, logs and granted secret capabilities. Start deadline2s, max body1MiB/header16KiB, bounded log output; operator may tune within configured limits. Deadline and response-size policies are versioned config; no production latency promise for arbitrary heavy code.

Return tagged union:
- accept: selected event body/content type/metadata and provider response {status,headers,body}; platform commits raw Event/Receipt/Execution/Graphile job and publication snapshot before response.
- reject: provider response; no accepted event/job.
- respondOnly: exact protocol response; no processing job unless code instead explicitly accepts.

ctx.accept/reject/respondOnly construct results; they do not emit early uncommitted success. Status/headers/body validated; no CRLF/hop-by-hop misuse, binary/base64 transfer preserved. Ingress uses WebCrypto/ordinary provider template helpers; platform provides no verifyProvider API. Bounded direct fetch is permitted; ingress-side external effects before commit are unjournaled and may duplicate. Use Processing managed sends for tracked durable delivery.

## Processing

Input: execution/event/publication identity, immutable accepted/raw byte context, pinned helper modules/middleware, attempt/recovery generation and capability SDK. Deadline30s initial, managed HTTP timeout10s, 256MiB target process RSS, bounded scratch/log/output; enforcement is foundation-tested, not just a V8 heap flag. Outcome union complete, retry(reason,optional bounded delay), fail(reason). Runtime errors/timeouts use bounded retry policy; default max5 attempts exponential delay/jitter with endpoint override. Actual attempts remain recorded even if final user policy says complete.

ctx.destinations.send(nameOrAuthorizedCustomTarget,{operationId,body,headers?}) returns {ok,status?,networkError?,attemptId,response?}. Success means actual configured HTTP success policy (default2xx), never queue receipt. Broker performs HTTP from deployment network, redirects disabled initially; custom code controls body/destination within scoped capability. All address categories are allowed; localhost is sender-relative. No database privileges or arbitrary broker SQL.

ManagedOperation(executionId,operationId) also stores canonical input digest (method,target/body/headers relevant to send). Reusing a key with changed input rejects. Stable loop keys required. On recovery committed successful result is reused, failed sends can create new attempts, uncertain inflight may duplicate. Operator replay creates a new execution/action namespace. Direct runtime fetch is permitted without managed-operation tracking. Script code can await a configured destination send, then fetch Discord or another API and choose complete/retry/fail from the actual responses. Direct effects may repeat if the whole script retries, even when a recorded managed send is reused; no hidden provider restrictions or automatic direct-fetch journaling. Recorded time/random/external-read decisions can be journaled; unjournaled nondeterminism gets explicit unsupported recovery behavior, never transparent continuation.

## Middleware

Separate ingress/processing middleware binding types. Inputs immutable except typed patch returned to context; return continue(patch?) or stage-appropriate short-circuit decision. Binding order instance/workspace/project/endpoint then within-scope order. Validate patch/result before applying; optional failure records error and uses last valid context, not partial mutation. Required ingress failure rejects before acceptance; required processing failure requests configured retry/fail. Middleware cannot erase original bytes or bypass control-plane auth. Publishing pins effective bindings; copies/override authority is explicit.

## Trusted broker and recovery

Executor supervisor strips child environment and uses immutable offline workerd bundles with generated configuration, bounded workerd fetch networking plus the authorized broker service binding. Each fresh process has bounded inputs/logs/results and isolated scratch. Treat broker requests as untrusted; broker supplies identity itself and verifies scope, generation, live lease, operation digest and resource quotas. Reject late results/sends. Never mount Docker socket or share platform credentials. Build/dependency resolution is also unprivileged.

Domain execution lease/generation recovery is independent of Graphile locks. After running lease or unclaimed dispatch-offer deadline expiry (paused scopes excluded), transaction fences old generation and enqueues a fresh generation-specific dispatch. Old handler/broker calls fail current-ownership checks; HTTP already sent can duplicate. Only confirmed dead Graphile worker IDs may be force-unlocked through supported API. Whole-container and partition recovery tests do not infer death from missed heartbeats.

Per-process resource containment, native/import bypasses, forged IPC, disk/KV abuse, output bursts and sibling availability must pass executor tests. Workerd internals are not the public SDK. Pin engine/compatibility flags and compiled bundle manifest; preserve ABI/body publication meaning across tested upgrades. Ordinary restricted Docker is the default; optional host gVisor selects runsc at deployment. Fresh workerd process per execution, bounded direct fetch and explicit broker binding. Missing selected runsc fails deployment with no downgrade, not the first event. Standard-container/capability/resource proofs remain release gates; hostile-tenant isolation is not promised. Administrative UI distinguishes configured mode from verified host evidence.
