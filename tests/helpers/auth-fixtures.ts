import type { Pool, PoolClient } from "pg";
import { database } from "../../packages/domain/src/db.ts";
import { prepareDevelopmentDatabase as migrate } from "../../packages/domain/src/development.ts";
import { readServerConfig } from "../../packages/domain/src/config.ts";
import { withFixtures } from "../../scripts/tests/fixtures.ts";

export const setupSecret = "fixture-bootstrap-secret-32-characters";

type AuthFixtureData = {
	pool: Pool;
	db: PoolClient;
	databaseUrl: string;
	smtpPort: number;
	mailUrl: string;
};

export async function authFixture(run: (f: AuthFixtureData) => Promise<void>) {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			await run({ ...f, pool, db });
		} finally {
			db.release();
			await pool.end();
		}
	});
}

export async function identity(db: PoolClient, id: string, verified = true) {
	await db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,$3,clock_timestamp(),clock_timestamp())', [id, id + "@example.test", verified]);

	return id;
}

export function fixtureConfig(f: { databaseUrl: string; smtpPort: number }) {
	return readServerConfig({
		DATABASE_URL: f.databaseUrl,
		PUBLIC_URL: "http://localhost:3000",
		SMTP_HOST: "127.0.0.1",
		SMTP_PORT: String(f.smtpPort),
		SMTP_FROM: "fixture@example.test",
		BETTER_AUTH_SECRET: "fixture-auth-secret-32-characters",
		PAYLOADBAY_ENCRYPTION_KEY: "fixture-encryption-key-32-characters",
		PAYLOADBAY_BOOTSTRAP_SECRET: setupSecret,
		PAYLOADBAY_EXECUTOR_TOKEN: "fixture-executor-token-32-characters",
		PAYLOADBAY_BROKER_SECRET: "fixture-broker-secret-32-characters",
	});
}
