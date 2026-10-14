import type { Pool } from "pg";
import { queueIncidentEmail } from "../../../packages/domain/src/notification-mail.ts";
import { evaluateFailureRules } from "../../../packages/domain/src/notification-rules.ts";

/** One bounded producer loop per trusted worker process; incident reconciliation deduplicates peers. */
export function startNotificationProducer(pool: Pool, options: { intervalMs?: number; encryptionKey?: string } = {}) {
	let active: Promise<unknown> | undefined;
	let stopped = false;
	const interval = options.intervalMs ?? 5000;
	if (!Number.isInteger(interval) || interval < 20) throw Error("Invalid notification producer interval");

	const tick = () => {
		if (stopped || active) return;
		active = evaluateFailureRules(pool)
			.then(async (incidents) => {
				if (!options.encryptionKey) return;
				for (const incident of incidents) await queueIncidentEmail(pool, incident.id, options.encryptionKey);
			})
			.catch(() => console.error("Notification producer database unavailable"))
			.finally(() => {
				active = undefined;
			});
	};

	const timer = setInterval(tick, interval);
	timer.unref();
	tick();

	return {
		async stop() {
			stopped = true;
			clearInterval(timer);
			await active;
		},
	};
}
