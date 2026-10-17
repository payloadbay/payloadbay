import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export async function executorFixture(options: { network?: string; brokerUrl?: string; dockerfile?: string } = {}) {
	const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	docker(["build", "--target", "runner", "-f", options.dockerfile ?? "deploy/Dockerfile.executor", "-t", "payloadbay-bootstrap/executor-development:local", "."]);
	const name = "pab-executor-" + randomUUID().slice(0, 8);
	const token = "fixture-executor-token-32-characters";
	docker([
		"run",
		"--rm",
		"-d",
		"--name",
		name,
		"--read-only",
		"--cap-drop",
		"ALL",
		"--security-opt",
		"no-new-privileges:true",
		"--pids-limit",
		"128",
		"--memory",
		"768m",
		"--cpus",
		"1",
		"--tmpfs",
		"/tmp:size=67108864,mode=1777",
		"--add-host",
		"host.docker.internal:host-gateway",
		...(options.network ? ["--network", options.network, "--network-alias", "executor"] : []),
		...(options.brokerUrl ? ["-e", "PAYLOADBAY_BROKER_URL=" + options.brokerUrl] : []),
		"-e",
		"PAYLOADBAY_EXECUTOR_TOKEN=" + token,
		"-p",
		"127.0.0.1::8080",
		"payloadbay-bootstrap/executor-development:local",
	]);
	try {
		const url = "http://127.0.0.1:" + Number(docker(["port", name, "8080/tcp"]).split(":").at(-1));
		let ready = false;
		for (let i = 0; i < 200; i++) {
			try {
				if ((await fetch(url + "/health")).status === 200) {
					ready = true;
					break;
				}
			} catch {}

			await new Promise((r) => setTimeout(r, 50));
		}

		if (!ready) throw Error("Executor fixture did not become ready");

		return {
			url,
			name,
			async stop() {
				docker(["rm", "-f", name]);
			},
		};
	} catch (error) {
		docker(["rm", "-f", name]);
		throw error;
	}
}
