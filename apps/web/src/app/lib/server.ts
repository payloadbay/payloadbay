import "server-only";
import { readServerConfig } from "@domain/config";
import { database } from "@domain/db";
import { createAuth } from "@domain/auth-runtime";

let services: ReturnType<typeof initialize> | undefined;

function initialize() {
	const config = readServerConfig(process.env);
	const pool = database(config.databaseUrl);

	return { config, pool, identity: createAuth(pool, config) };
}

export function getServices() {
	return (services ??= initialize());
}
