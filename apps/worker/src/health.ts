import type { Pool } from "pg";

/** Database time keeps readiness comparable across worker replicas and web hosts. */
export function startWorkerHealth(pool: Pool, intervalMs = 15000) {
	let stopped = false;
	let pending: Promise<void> = Promise.resolve();

	const tick = () => {
		if (stopped) return;
		pending = pending
			.then(async () => {
				if (!stopped) await pool.query("UPDATE payloadbay.installation SET worker_seen_at=clock_timestamp() WHERE singleton");
			})
			.catch(() => {
				/* A failed heartbeat ages out; credentials and database errors stay private. */
			});
	};

	tick();
	const timer = setInterval(tick, intervalMs);
	timer.unref();

	return {
		async stop() {
			stopped = true;
			clearInterval(timer);
			await pending;
		},
	};
}
