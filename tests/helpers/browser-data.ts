import { database } from "../../packages/domain/src/db.ts";

export async function resetBrowserData() {
	const url = process.env.DATABASE_URL;
	if (!url || !/^\/case_[0-9a-f]+$/.test(new URL(url).pathname)) throw Error("Browser reset requires a disposable case database");
	const pool = database(url);
	try {
		let idle = false;
		for (let i = 0; i < 100; i++) {
			const jobs = await pool.query("SELECT count(*)::int AS n FROM graphile_worker.jobs");
			if (jobs.rows[0].n === 0) {
				idle = true;
				break;
			}

			await new Promise((r) => setTimeout(r, 50));
		}

		if (!idle) throw Error("Fixture worker must finish outstanding jobs before resetting browser data");
		const cleared = await fetch(process.env.PAB_TEST_MAIL_URL + "/api/v1/messages", { method: "DELETE" });
		if (!cleared.ok) throw Error("Browser SMTP fixture reset failed");
		if (process.env.PAB_TEST_HTTP_URL) {
			const reset = await fetch(process.env.PAB_TEST_HTTP_URL + "/reset", { method: "POST" });
			if (!reset.ok) throw Error("Browser HTTP fixture reset failed");
		}

		const tables = (await pool.query("SELECT schemaname,tablename FROM pg_catalog.pg_tables WHERE schemaname IN ('auth','payloadbay') AND tablename<>'schema_migration'")).rows;

		const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';

		await pool.query("TRUNCATE " + tables.map((row) => quote(row.schemaname) + "." + quote(row.tablename)).join(",") + " RESTART IDENTITY CASCADE");
	} finally {
		await pool.end();
	}
}
