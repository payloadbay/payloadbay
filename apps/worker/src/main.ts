import { startNotificationProducer } from "./notifications.ts";
import { run, type Runner } from "graphile-worker";
import { readServerConfig } from "../../../packages/domain/src/config.ts";
import { database } from "../../../packages/domain/src/db.ts";
import { mailTask } from "./tasks/mail.ts";
import { processEventTask } from "./tasks/process-event.ts";
import { startRecovery } from "./recovery.ts";
import { createBroker } from "./broker.ts";

const config = readServerConfig(process.env);
const pool = database(config.databaseUrl);
const runners: Runner[] = [];
const recovery = startRecovery(pool);
const broker = createBroker(pool, config);
let notificationProducer: ReturnType<typeof startNotificationProducer> | undefined;
let closing = false;

async function shutdown(code: number) {
	if (closing) return;
	closing = true;
	const timer = setTimeout(() => process.exit(1), 10000);
	timer.unref();
	broker.closeAllConnections();
	await new Promise<void>((resolve) => broker.close(() => resolve())).catch(() => {});
	await recovery.stop();
	await notificationProducer?.stop();
	await Promise.allSettled(runners.map((runner) => runner.stop()));
	await pool.end();
	clearTimeout(timer);
	process.exit(code);
}

try {
	await pool.query("SELECT max_attempts FROM payloadbay.execution LIMIT 0");
	const executor = await fetch(new URL("/health", config.executorUrl), { signal: AbortSignal.timeout(5000) });
	if (!executor.ok) throw Error("Executor unavailable");
	const event = processEventTask(pool, config);
	const mail = mailTask(pool, config);
	// Independent reserved pools prevent bulk work from consuming the critical delivery/mail slots.
	for (const lane of [
		{ taskList: { process_event: event }, forbiddenFlags: ["bulk", "platform"], concurrency: 2 },
		{ taskList: { process_event: event }, forbiddenFlags: ["critical", "platform"], concurrency: 1 },
		{ taskList: { platform_job: mail }, forbiddenFlags: ["critical", "bulk"], concurrency: 1 },
	]) {
		const runner = await run({
			pgPool: pool,
			noHandleSignals: true,
			pollInterval: 250,
			parsedCronItems: [],
			...lane,
		});
		runners.push(runner);
		runner.promise.catch(() => {
			console.error("Worker runner unavailable");
			void shutdown(1);
		});
	}

	notificationProducer = startNotificationProducer(pool, { encryptionKey: config.encryptionKey });
	broker.listen(Number(process.env.PORT ?? 8081), "0.0.0.0");
	process.on("SIGTERM", () => void shutdown(0));
	process.on("SIGINT", () => void shutdown(0));
} catch {
	console.error("Worker startup failed; check database migration, executor readiness and server configuration");
	await shutdown(1);
}
