import type { Pool } from "pg";
import type { ServerConfig } from "@payloadbay/domain/config";
import { runEventRetention } from "@payloadbay/domain/retention";

export function cleanupTask(pool: Pool, config: ServerConfig) {
	return (job: { id: string; generation: number }) => runEventRetention(pool, config, job);
}
