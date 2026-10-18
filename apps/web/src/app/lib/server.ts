import { resolveInstallationConfiguration } from "@domain/installation-configuration";
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

let configuredIdentity: { version: number; identity: ReturnType<typeof createAuth> } | undefined;
let authenticationRefresh: Promise<ReturnType<typeof getServices>> | undefined;

/** Refresh only OAuth identity configuration; deployment SMTP and execution settings stay unchanged. */
export async function getConfiguredServices() {
	if (authenticationRefresh) return authenticationRefresh;
	authenticationRefresh = (async () => {
		const base = getServices();
		const { config, version } = await resolveInstallationConfiguration(base.pool, base.config);
		if (!configuredIdentity || configuredIdentity.version !== version) {
			configuredIdentity = { version, identity: createAuth(base.pool, config, base.identity.databasePool) };
		}

		return { pool: base.pool, config, identity: configuredIdentity.identity };
	})();
	try {
		return await authenticationRefresh;
	} finally {
		authenticationRefresh = undefined;
	}
}
