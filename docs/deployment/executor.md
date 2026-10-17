# Executor deployment modes

PAYLOADBAY_EXECUTOR_RUNTIME defaults to runc (Standard Docker isolation). runsc selects optional gVisor for the executor container only. Compose/Coolify chooses the runtime before the container starts. Set the optional variable before first deployment, or after installing/registering runsc on the Docker host and then recreate/redeploy. Installing a runtime alone or restarting an existing container does not change its runtime. No required host setup for default deployment and no Docker socket inside the app.

Verified2026-10-14: default `bun run sandbox:check` starts the runtime image as non-root under ordinary Docker. Explicit runsc on this host fails the host-side preflight with instructions to install/register it or set the variable back to runc. Direct Compose creation independently returns `unknown or invalid runtime name: runsc` before the executor starts. No fallback or delayed first-event container provisioning. Actual gVisor execution/resource guarantees remain unverified on this host; that is not a blocker for the approved trusted-publisher standard mode.

Instance settings expose executor readiness separately from configured mode. The notification inbox provides a dismissible standard-mode notice for instance administrators. Configured runsc is not host attestation and does not produce a verified-security badge. Additional gVisor isolation remains optional.

The executor image contains the supervisor, bounded compiler and workerd. Approved scripts can use bounded ordinary fetch, including after successful managed destination.send. Managed sends are journaled; direct calls are unjournaled and may repeat on script retry. User code controls complete/retry/fail.

Default executor protections remain non-root/read-only base filesystem, dropped capabilities, no-new-privileges, bounded resources/scratch, no host mounts or app credentials, separate executor process/container and scoped broker access. All publishers must be trusted by the instance operator; standard Docker is not advertised for hostile tenants. Optional gVisor needs its own deployment/compatibility tests.

References: https://docs.docker.com/reference/compose-file/services/#runtime and https://gvisor.dev/docs/user_guide/quick_start/docker/ .

## Coordinated startup compatibility

The executor health response declares protocol version, SDK version and workerd
compatibility date from the same constants used by compiled-stage validation and
runtime configuration. The worker validates that bounded response before starting
recovery, queue consumers or notification/retention producers. Missing, malformed,
unsupported or not-ready responses stop worker startup with a safe configuration
error; an HTTP 200 by itself is insufficient. Docker restart policy can retry startup
after the deployment is corrected.

Deploy the app, worker and executor from the same release. This startup check is
not per-request version negotiation or support for replacing an executor under
already-running workers. Pending-job upgrades and published-release restore remain
separate acceptance gates. A compatible response also does not attest the Docker
host runtime or certify hostile-tenant isolation.
