# Supabase programmable runtime probe

## Current decision — Supabase feasibility first (2026-10-13)

The earlier recommendation to replace Supabase is withdrawn as premature. Supabase remains the working backend candidate; no migration is authorized. Assess the actual programmable delivery flow before choosing a backend.

A disposable local test on cached `supabase/edge-runtime:v1.74.0` passed for two separately published TypeScript revisions. One async handler returned a custom plaintext response before a delayed HTTP send, continued via `EdgeRuntime.waitUntil`, and returned the actual destination outcome (HTTP 200). A fake parent service-role environment variable was absent when user-worker envVars were empty; this is an observation, not a sandbox security assessment. Publication into worker-local `/tmp` failed because the child could not find its entrypoint; publication into the shared `/functions` directory succeeded. Response observations were 0.098s and 0.062s locally, not edge latency benchmarks.

This diagnostic used in-memory observations, no database or durable queue, no production credentials, and no hosted deployment. Its container was removed. Harness: `/tmp/payloadbay-runtime-probe/probe.py`. Next slice must prove atomic event+queue persistence before acknowledgement, failed HTTP retries, restart recovery, pinned code revision, independent fanout histories and replay. Hosted publication, self-hosted publication lifecycle and code isolation remain explicit tests. `waitUntil` alone is not durable recovery.
