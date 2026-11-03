# Delivery latency fixture

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

## Complete clean source checkpoint `9046ae2`

[Alpha Validation 39052054695](https://github.com/payloadbay/payloadbay/actions/runs/39052054695)
passes at exact source `9046ae25c96484e70f5aab438840b77489c63c8d`. Its performance
artifact records 600/600 accepted and delivered, zero failed requests, ACK p95
56.52 ms, first-attempt p95 60.21 ms and maximum 132.36 ms, competing with 1,000
queued bulk jobs. Queue-to-claim p95 is 24.65 ms; claim-to-first-attempt p95 is
37.79 ms.

The x64 runner reports 4 logical CPUs and 16,766,414,848 bytes of host memory.
The existing one-CPU container limits and 512/512/768 MiB app/worker/executor
budgets are unchanged. There are no warm-up webhook requests; per-request
workerd startup is included, and the executor mode is ordinary runc. These
measurements describe this fixture/run, not a production SLA or a new runtime
optimization. Prior passing and contended failing runs remain above.


## Subsequent availability and latency findings remain open

At db2fb3e, [CI39053349674](https://github.com/payloadbay/payloadbay/actions/runs/39053349674)
failed zero-request-failure acceptance: one of600 requests lacked the expected
acknowledgment, with599 measured deliveries. Latency percentiles passed, but the
original failure-count-only artifact cannot classify the HTTP/transport failure
or establish whether the unacknowledged request committed. The prior successful
run does not resolve this finding.

Two local reproductions passed600/600. Two further local runs accepted and
delivered600/600 but failed first-attempt latency: p953713ms/max3919ms, then
p9516032ms/max16446ms. Queue wait accounts for most of that delay (p953607ms
and15911ms respectively); both reports show zero database deadlocks. Their host
load was above16 on the16-CPU shared host, a possible contributor rather than a
proven explanation. Both failures remain recorded in the cycle log. No deadlines,
worker concurrency, retries or acceptance thresholds changed.

The existing latency.json artifact now retains sanitized failed-request
sequence/status/error classification/correlation/timing and aggregate database
and ingress outcomes. It never records raw responses, credentials or payloads.
No production diagnostic logger is introduced. T054 remains open pending
classification and resolution; a later successful repeat alone is not a fix.


## Native bound-port fix — exact clean017cd69

[CI39056043199](https://github.com/payloadbay/payloadbay/actions/runs/39056043199)
passes at017cd69983151b7d7e924ed49a9499c998502861 with600/600 accepted/delivered,
zero failed requests and zero database deadlocks. ACKp95 is51.801ms, first-attempt
p9551.541ms and maximum84.912ms under the unchanged fixture and thresholds.
The deterministic EX34 collision test proves the removed port release/rebind
race; the earlier unclassified request failure cannot be attributed retrospectively.
This exact source closes the changed-runtime fixture gate, not the published
operator release gates or shared-host latency guarantees.
