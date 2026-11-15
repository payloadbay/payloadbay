# Bounded diagnostic recording

Accepted events retain their full original bytes and processing job atomically
before acknowledgement. Their delivery/retry/replay guarantees are unchanged.

Rejected, error and protocol-only requests share a per-organization diagnostic
budget of 1,000 retained rows and 16 MiB of accounted body/header/metadata storage.
Once either budget fills, the provider still receives the original decision;
additional per-request event, change and usage-fact rows are not created. A
fixed-size organization counter records the number of omitted diagnostics.
Normal trusted event retention releases row and byte capacity after deletion.
Disabling retention preserves existing diagnostics and does not reset the budget.

This bounds diagnostic storage under abusive traffic. It is not a commercial
plan limit and does not make rejected requests cost-free to evaluate. Per-event
traffic views show retained diagnostic samples once recording is limited.
