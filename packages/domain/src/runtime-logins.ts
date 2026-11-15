import { Client } from "pg";
import { AppError } from "../../contracts/src/errors.ts";

/** Privileged migration-time setup; application processes receive separate logins. */
export async function provisionRuntimeLogins(url: string, passwords: { app: string; worker: string }) {
	if (passwords.app.length < 32 || passwords.worker.length < 32 || passwords.app === passwords.worker || /[\x00-\x1f]/.test(passwords.app + passwords.worker)) throw new AppError("runtime_credentials_invalid", 503, "Provide separate runtime database passwords of at least 32 characters");
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock(hashtext('payloadbay:runtime-logins:v1'))");
		for (const [name, group, password] of [
			["payloadbay_web", "payloadbay_app", passwords.app],
			["payloadbay_jobs", "payloadbay_worker", passwords.worker],
		]) {
			const existing = (await client.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1", [name])).rows[0];
			if (existing && Object.values(existing).some(Boolean)) throw new AppError("runtime_role_unsafe", 503, "Runtime database login has unsupported administrative privileges");
			const memberships = await client.query("SELECT parent.rolname FROM pg_auth_members member JOIN pg_roles child ON child.oid=member.member JOIN pg_roles parent ON parent.oid=member.roleid WHERE child.rolname=$1", [name]);
			if (memberships.rows.some((row) => row.rolname !== group)) throw new AppError("runtime_role_unsafe", 503, "Runtime database login has unsupported role memberships");
			if (!existing) await client.query(`CREATE ROLE ${name} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
			await client.query(`ALTER ROLE ${name} WITH LOGIN INHERIT PASSWORD ${client.escapeLiteral(password)}`);
			await client.query(`GRANT ${group} TO ${name}`);
		}

		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		await client.end();
	}
}
