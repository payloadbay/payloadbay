import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { canGenerateReleaseMigrations } from "./migration-policy.ts";

if (!canGenerateReleaseMigrations(process.env)) throw Error("Release migration generation belongs to master CI");
const folder = "packages/domain/drizzle";
mkdirSync(folder, { recursive: true });
const before = new Set(readdirSync(folder).filter((file) => /^\d{4}_.+\.sql$/.test(file)));

function generate(extra: string[] = []) {
	const output = execFileSync("bun", ["run", "--cwd", "packages/domain", "db:generate", ...extra], { encoding: "utf8" });
	process.stdout.write(output);
	if (output.includes("Interactive prompts require a TTY terminal")) throw Error("Schema resolution requires a reviewed source decision");
}

generate();
let created = readdirSync(folder).filter((file) => /^\d{4}_.+\.sql$/.test(file) && !before.has(file));
if (!created.length) {
	generate(["--custom", "--name", "runtime-" + (process.env.GITHUB_SHA ?? "manual").slice(0, 8)]);
	created = readdirSync(folder).filter((file) => /^\d{4}_.+\.sql$/.test(file) && !before.has(file));
}

if (created.length !== 1) throw Error("Expected exactly one generated migration for this merged change");
appendFileSync(folder + "/" + created[0], "\n--> statement-breakpoint\n" + readFileSync("packages/domain/sql/runtime.sql", "utf8"));
console.log("CI generated one release migration with schema and database behavior");
