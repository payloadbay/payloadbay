import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { requirePermission } from "./membership.ts";
import { publicConfiguration, type ServerConfig } from "./config.ts";
import { executorHealthSchema, installationHealthSchema, installationSettingsSchema, type InstallationHealth } from "../../contracts/src/installation.ts";

export async function readInstallationSettings(pool: Pool, actor: Actor, installationId: string, config: ServerConfig) {
	await requirePermission(pool, actor, { type: "instance", id: installationId }, "settings.manage");

	return installationSettingsSchema.parse({
		...publicConfiguration(config),
		registrationPolicy: config.registrationPolicy,
		eventRetentionDays: config.eventRetentionDays,
		deadlines: { ingressMs: config.ingressDeadlineMs, processingMs: config.processingDeadlineMs, httpMs: config.httpTimeoutMs },
	});
}

async function probeExecutor(config: ServerConfig): Promise<InstallationHealth["executor"]> {
	try {
		const response = await fetch(new URL("/health", config.executorUrl), { signal: AbortSignal.timeout(3000), redirect: "error" });
		const reader = response.body?.getReader();
		if (!reader) throw Error();
		const parts: Uint8Array[] = [];
		let bytes = 0;
		try {
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				bytes += chunk.value.byteLength;
				if (bytes > 16384) throw Error();
				parts.push(chunk.value);
			}
		} finally {
			await reader.cancel();
		}

		const result = executorHealthSchema.parse(JSON.parse(Buffer.concat(parts).toString("utf8")));

		return {
			state: response.ok && result.ready ? "ready" : "not_ready",
			runtime: result.runtime,
			configuredMode: result.configuredMode,
			hostAttestation: false,
		};
	} catch {
		return {
			state: "unavailable",
			runtime: null,
			configuredMode: null,
			hostAttestation: false,
		};
	}
}

export async function readInstallationHealth(pool: Pool, actor: Actor, installationId: string, config: ServerConfig) {
	await requirePermission(pool, actor, { type: "instance", id: installationId }, "settings.manage");
	await pool.query("SELECT singleton,bootstrap_state FROM payloadbay.installation LIMIT 1");

	return installationHealthSchema.parse({
		checkedAt: new Date().toISOString(),
		database: "available",
		executor: await probeExecutor(config),
		worker: "not_checked",
		smtp: "not_checked",
	});
}
