import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
import { Pool, type PoolClient } from "pg";

export function database(connectionString: string) {
	const pool = new Pool({
		connectionString,
		max: 10,
		connectionTimeoutMillis: 5000,
		statement_timeout: 10000,
		lock_timeout: 5000,
		idle_in_transaction_session_timeout: 10000,
	});
	pool.on("error", () => console.error("Database connection unavailable"));
	pool.on("connect", (client) => client.on("error", () => console.error("Database client connection unavailable")));

	return pool;
}

export async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await run(client);
		await client.query("COMMIT");

		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

export function typedDatabase(pool: Pool) {
	return drizzle(pool, { schema });
}
