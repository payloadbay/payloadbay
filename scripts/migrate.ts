import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { migrate } from "../packages/domain/src/migrate.ts";

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw Error("MIGRATION_DATABASE_URL is required");
try {
	const at = process.argv.indexOf("--directory");
	const directory = at < 0 ? undefined : pathToFileURL(resolve(process.argv[at + 1]) + "/");
	await migrate(url, { directory });
	console.log("Payload Bay migrations complete");
} catch {
	console.error("Payload Bay migration failed; inspect configuration and migration compatibility");
	process.exitCode = 1;
}
