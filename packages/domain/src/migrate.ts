import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { initializeLibrarySchemas } from "./library-schema.ts";
import { AppError } from "../../contracts/src/errors.ts";

export async function migrate(url: string, options: { through?: string; directory?: URL } = {}): Promise<void> {
	const directory = options.directory ?? new URL("../drizzle/", import.meta.url);
	let names: string[];
	try {
		names = (await readdir(directory)).filter((name) => /^[0-9]+_.*\.sql$/.test(name));
	} catch {
		throw new AppError("release_migrations_unavailable", 503, "CI-generated release migrations are unavailable");
	}

	if (!names.length) throw new AppError("release_migrations_unavailable", 503, "CI-generated release migrations are unavailable");
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		await client.query("SELECT pg_advisory_lock(hashtext('payloadbay:migrations:v1'))");
		await client.query("CREATE SCHEMA IF NOT EXISTS payloadbay");
		await client.query("CREATE SCHEMA IF NOT EXISTS auth");
		await initializeLibrarySchemas(url);
		await client.query("CREATE TABLE IF NOT EXISTS payloadbay.schema_migration (name text PRIMARY KEY, digest text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
		for (const name of names.filter((n) => /^[0-9]+_.*\.sql$/.test(n) && (!options.through || n <= options.through)).sort()) {
			const source = await readFile(new URL(name, directory), "utf8");
			const digest = createHash("sha256").update(source).digest("hex");
			const existing = await client.query("SELECT digest FROM payloadbay.schema_migration WHERE name=$1", [name]);
			if (existing.rowCount) {
				if (existing.rows[0].digest !== digest) throw Error("Applied migration differs from release");
				continue;
			}

			await client.query("BEGIN");
			try {
				await client.query(source);
				await client.query("INSERT INTO payloadbay.schema_migration(name,digest) VALUES($1,$2)", [name, digest]);
				await client.query("COMMIT");
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			}
		}
	} finally {
		await client.query("SELECT pg_advisory_unlock(hashtext('payloadbay:migrations:v1'))").catch(() => {});
		await client.end();
	}
}
