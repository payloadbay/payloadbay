# Alpha delivery latency fixture

Run `bun run test:performance` separately from other owning test lanes. It builds
committed Dockerfile snapshots without modifying local Docker drafts, starts
restricted app/worker/workerd containers and disposable PostgreSQL plus a healthy
HTTP receiver, then sends 600 real HTTP requests at 10 per second for 60 seconds.
One thousand previously queued lower-priority executions compete throughout;
their scripts wait 100 ms before completing. No provider payloads or credentials
are recorded in benchmark evidence.

The app and worker each receive one CPU and 512 MiB; the executor one CPU and 768 MiB. The initial local
host reported16logical CPUs and about135GB memory; the later GitHub-hosted
runner reported4logical CPUs and about16GB. This fixture does
not reserve an exclusive host. Each report records exact image IDs, source
revision, resource limits, host load, sample counts and backlog observations.

Acknowledgement timing covers the HTTP request through its complete response
body. Delivery timing starts at the event's stored acceptance-transaction
`received_at` and ends at its first outbound attempt. Existing immutable
`processing.attempt.started` facts split queue wait from time after claim. These
are different measurements; fast acknowledgement does not establish fast delivery.
Published bundles are prepared first; per-execution workerd startup is included.
There are no synthetic warm-up webhook requests.

## Verified on 2026-10-17

| Condition                        | ACK p95 | First attempt p95 | First attempt max | Accepted/delivered |
| -------------------------------- | ------: | ----------------: | ----------------: | -----------------: |
| Concurrent Coolify preview build |  430 ms |           5336 ms |           5677 ms |            600/600 |
| After that build finished        |  129 ms |            156 ms |            265 ms |            600/600 |

The first run failed the agreed first-attempt p95 target. The second passed all
three targets: ACK p95 ≤ 1 second, first-attempt p95 ≤ 2 seconds, and no critical wait > 10 seconds. Images,
CPU/memory limits, workload and thresholds were identical; production code did
not change. This supports shared-host contention as a factor, without proving it
was the only difference. These results are fixture evidence, not production SLAs.
The concurrent-build failure is retained rather than counted as a pass.

Passing-run queue-to-claim p95 was 54 ms, claim-to-first-HTTP p95 was 104 ms and HTTP
p95 was 18 ms. Bulk remained queued for the complete measurement. For latency-sensitive
installations, reserve enough host resources and account for competing builds;
per-container worker priority cannot reserve host CPU or I/O capacity.

Ignored artifacts are under `test-results/<run-id>/performance/latency.json`.
The first run was `4b57aec5-1e62-4500-8bea-2637b0eda8d6`; the passing run was
`c0f409eb-5240-4e9c-aa99-552dbffec2cf`. The separate host observation in the first
run was taken while it was active, not a before/after sample. Thresholds are
asserted after the numerical report is saved, including on failure.

## Latest worker source on a fresh CI runner

[Alpha Validation run39033406697](https://github.com/payloadbay/payloadbay/actions/runs/39033406697)
passed the performance owner at exact source
`ef479c49079638430694e7b103d00c35c47a1f71`, including the reserved maintenance
runner. Artifact `alpha-performance-39033406697-1` records all600accepted requests
delivered, no failed requests, ACK p95 **116.789ms**, first-attempt p95
**131.701ms** and maximum **258.514ms**. Queue-to-claim p95 was41.760ms,
claim-to-attempt80.785ms and HTTP16.330ms. The1000-item seeded bulk backlog remained
nonempty (997→668observed queued items). Resource limits and targets above were
unchanged. Host load moved from1.90/1.15/0.51to2.49/1.46/0.66.

This clean-checkout result validates the changed worker under this fixture; it
does not erase the earlier shared-host contention failure or establish an SLA.
