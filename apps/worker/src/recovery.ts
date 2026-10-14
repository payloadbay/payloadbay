import { recoverPlatformJobs } from "../../../packages/domain/src/platform-recovery.ts";
import type { Pool } from "pg";
import { recoverExpired, heartbeat, type Authority } from "../../../packages/domain/src/execution-lease.ts";
import type { ChildProcess } from "node:child_process";

export async function unlockObservedChild(utils: { forceUnlockWorkers(ids: string[]): Promise<void> }, child: Pick<ChildProcess, "exitCode" | "signalCode">, workerIds: string[]): Promise<boolean> {
	if (child.exitCode === null && child.signalCode === null) return false;
	if (!workerIds.length || workerIds.some((id) => !/^[-a-zA-Z0-9_]+$/.test(id))) throw Error("Exact observed worker IDs required");
	await utils.forceUnlockWorkers([...new Set(workerIds)]);

	return true;
}

export function startRecovery(pool: Pool) {
	let active: Promise<unknown> | undefined;
	const timer = setInterval(() => {
		if (!active)
			active = Promise.all([recoverExpired(pool), recoverPlatformJobs(pool)])
				.catch(() => console.error("Worker recovery database unavailable"))
				.finally(() => {
					active = undefined;
				});
	}, 5000);
	timer.unref();

	return {
		async stop() {
			clearInterval(timer);
			await active;
		},
	};
}

export function startHeartbeat(pool: Pool, authority: Authority, onLost: () => void) {
	let active: Promise<unknown> | undefined;
	let stopped = false;

	const lost = () => {
		if (stopped) return;
		stopped = true;
		clearInterval(timer);
		onLost();
	};

	const timer = setInterval(() => {
		if (!active && !stopped)
			active = heartbeat(pool, authority)
				.then((valid) => {
					if (!valid) lost();
				})
				.catch(lost)
				.finally(() => {
					active = undefined;
				});
	}, 5000);
	timer.unref();

	return {
		async stop() {
			stopped = true;
			clearInterval(timer);
			await active;
		},
	};
}
