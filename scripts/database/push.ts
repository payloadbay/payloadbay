import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { initializeLibrarySchemas } from "../../packages/domain/src/library-schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production") throw Error("db:push is for development; production applies CI-generated migrations");
const client = new Client({ connectionString: url });
await client.connect();
try {
	await client.query("SELECT pg_advisory_lock(hashtext('payloadbay:migrations:v1'))");
	await client.query("CREATE SCHEMA IF NOT EXISTS payloadbay");
	await client.query("CREATE SCHEMA IF NOT EXISTS auth");
	await initializeLibrarySchemas(url);
	execFileSync(process.execPath, [fileURLToPath(new URL("../../packages/domain/node_modules/drizzle-kit/bin.cjs", import.meta.url)), "push", "--config", "drizzle.config.ts"], { cwd: fileURLToPath(new URL("../../packages/domain/", import.meta.url)), env: process.env, stdio: "inherit" });
	await client.query("CREATE TABLE IF NOT EXISTS payloadbay.schema_migration(name text PRIMARY KEY,digest text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
	await client.query(await readFile(new URL("../../packages/domain/sql/runtime.sql", import.meta.url), "utf8"));
} finally {
	await client.query("SELECT pg_advisory_unlock(hashtext('payloadbay:migrations:v1'))").catch(() => {});
	await client.end();
}
