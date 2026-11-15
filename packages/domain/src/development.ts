import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initializeLibrarySchemas } from "./library-schema.ts";

let exportedSchema: string | undefined;

/** Disposable developer/test bootstrap. This does not create release migration artifacts. */
export async function prepareDevelopmentDatabase(url: string) {
	if (process.env.NODE_ENV === "production") throw Error("Development schema bootstrap is unavailable in production");
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		await client.query("SELECT pg_advisory_lock(hashtext('payloadbay:migrations:v1'))");
		await client.query("CREATE SCHEMA IF NOT EXISTS payloadbay");
		await client.query("CREATE SCHEMA IF NOT EXISTS auth");
		await initializeLibrarySchemas(url);
		const existing = (await client.query("SELECT to_regclass('payloadbay.installation') AS installed")).rows[0].installed;
		if (!existing) {
			exportedSchema ??= execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/drizzle-kit/bin.cjs", import.meta.url)), "export", "--dialect", "postgresql", "--schema", fileURLToPath(new URL("./schema.ts", import.meta.url))], { encoding: "utf8" });
			await client.query("BEGIN");
			try {
				await client.query(exportedSchema);
				await client.query("COMMIT");
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			}
		}

		await client.query("CREATE TABLE IF NOT EXISTS payloadbay.schema_migration(name text PRIMARY KEY,digest text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
		await client.query(await readFile(new URL("../sql/runtime.sql", import.meta.url), "utf8"));
	} finally {
		await client.query("SELECT pg_advisory_unlock(hashtext('payloadbay:migrations:v1'))").catch(() => {});
		await client.end();
	}
}
