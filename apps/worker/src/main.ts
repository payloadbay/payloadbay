import { resolveInstallationConfiguration } from "@payloadbay/domain/installation-configuration";
import { startWorkerHealth } from "./health.ts";
import { probeExecutor } from "@payloadbay/domain/installation";
import { workerLanes } from "./runner-lanes.ts";
import { startNotificationProducer } from "./notifications.ts";
import { run, type Runner } from "graphile-worker";
import { readServerConfig } from "../../../packages/domain/src/config.ts";
import { database } from "../../../packages/domain/src/db.ts";
import { platformJobTask } from "./tasks/platform-job.ts";
import { processEventTask } from "./tasks/process-event.ts";
import { startRecovery } from "./recovery.ts";
import { createBroker } from "./broker.ts";
import { startRetentionProducer } from "./retention.ts";

const config = readServerConfig(process.env);
const pool = database(config.databaseUrl);
const runners: Runner[] = [];
let recovery: ReturnType<typeof startRecovery> | undefined;

const currentConfig = async () => (await resolveInstallationConfiguration(pool, config)).config;

const broker = createBroker(pool, config, currentConfig);
let notificationProducer: ReturnType<typeof startNotificationProducer> | undefined;
let retentionProducer: ReturnType<typeof startRetentionProducer> | undefined;
let closing = false;
let health: ReturnType<typeof startWorkerHealth> | undefined;

async function shutdown(code: number) {
	if (closing) return;
	closing = true;
	const timer = setTimeout(() => process.exit(1), 10000);
	timer.unref();
	broker.closeAllConnections();
	await new Promise<void>((resolve) => broker.close(() => resolve())).catch(() => {});
	await health?.stop();
	await recovery?.stop();
	await notificationProducer?.stop();
	await retentionProducer?.stop();
	await Promise.allSettled(runners.map((runner) => runner.stop()));
	await pool.end();
	clearTimeout(timer);
	process.exit(code);
}

try {
	await pool.query("SELECT max_attempts FROM payloadbay.execution LIMIT 0");
	const executor = await probeExecutor(config);
	if (executor.state !== "ready") throw Error("Executor compatibility/readiness unavailable");
	recovery = startRecovery(pool);

	const event = async (input: unknown) => processEventTask(pool, await currentConfig())(input);

	const platform = async (input: unknown) => platformJobTask(pool, await currentConfig())(input);
	// Independent reserved pools prevent bulk work from consuming the critical delivery/mail slots.
	for (const lane of workerLanes(pool, { process_event: event, platform_job: platform })) {
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

	health = startWorkerHealth(pool);
	notificationProducer = startNotificationProducer(pool, { encryptionKey: config.encryptionKey, publicUrl: config.publicUrl });
	retentionProducer = startRetentionProducer(pool, config, { resolveConfig: currentConfig });
	broker.listen(Number(process.env.PORT ?? 8081), "0.0.0.0");
	process.on("SIGTERM", () => void shutdown(0));
	process.on("SIGINT", () => void shutdown(0));
} catch {
	console.error("Worker startup failed; check database migration, executor compatibility/readiness and server configuration");
	await shutdown(1);
}
