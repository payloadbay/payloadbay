import type { Pool } from "pg";
import type { ServerConfig } from "@payloadbay/domain/config";
import { queueEventRetention } from "@payloadbay/domain/retention";

/** Hourly work is deduplicated in PostgreSQL; this loop only offers due work. */
export function startRetentionProducer(pool: Pool, config: ServerConfig, options: { intervalMs?: number } = {}) {
	const interval = options.intervalMs ?? 60000;
	if (!Number.isInteger(interval) || interval < 20) throw Error("Invalid retention producer interval");
	let stopped = false;
	let active: Promise<unknown> | undefined;

	const tick = () => {
		if (stopped || active || config.eventRetentionDays === 0) return;
		active = queueEventRetention(pool, config)
			.catch(() => console.error("Retention producer database unavailable"))
			.finally(() => {
				active = undefined;
			});
	};

	const timer = config.eventRetentionDays > 0 ? setInterval(tick, interval) : undefined;
	timer?.unref();
	tick();

	return {
		async stop() {
			stopped = true;
			if (timer) clearInterval(timer);
			await active;
		},
	};
}
