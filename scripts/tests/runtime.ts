export function executorRuntime(value?: string): "runc" | "runsc" {
	if (value && value !== "runc" && value !== "runsc") throw Error("PAYLOADBAY_EXECUTOR_RUNTIME must be runc or runsc");

	return value === "runsc" ? "runsc" : "runc";
}

export function validateRuntime(value: string, runtimes: Record<string, unknown>) {
	const selected = executorRuntime(value);
	if (!runtimes[selected]) throw Error(`Selected executor runtime ${selected} is not registered on this Docker host. Install/register gVisor runsc, or set PAYLOADBAY_EXECUTOR_RUNTIME=runc and recreate/redeploy. Set PAYLOADBAY_EXECUTOR_RUNTIME=runc for standard Docker isolation. No automatic fallback.`);

	return selected;
}
