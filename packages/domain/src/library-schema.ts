import { runMigrations } from "graphile-worker";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { authSchemaOptions } from "./auth-schema.ts";
import { database } from "./db.ts";

/** Library-owned schemas are installed through their supported migration APIs. */
export async function initializeLibrarySchemas(url: string) {
	const authPool = new Pool({ connectionString: url, options: "-c search_path=auth" });
	try {
		await (await getMigrations(authSchemaOptions(authPool))).runMigrations();
	} finally {
		await authPool.end();
	}

	const queuePool = database(url);
	try {
		await runMigrations({ pgPool: queuePool });
	} finally {
		await queuePool.end();
	}
}
