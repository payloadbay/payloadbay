import { execFileSync } from "node:child_process";
import { executorRuntime, validateRuntime } from "./runtime.ts";

export function requireSandbox() {
	const runtimes = JSON.parse(execFileSync("docker", ["info", "--format", "{{json .Runtimes}}"], { encoding: "utf8" }));

	return validateRuntime(executorRuntime(process.env.PAYLOADBAY_EXECUTOR_RUNTIME), runtimes);
}

if (import.meta.main) {
	const selected = requireSandbox();
	console.log(`Executor deployment preflight: ${selected === "runsc" ? "gVisor" : "standard Docker isolation"}; host runtime registered.`);
	execFileSync("docker", ["compose", "-f", "deploy/compose.dev.yml", "--profile", "sandbox", "run", "--build", "--rm", "executor-check"], { stdio: "inherit" });
}
