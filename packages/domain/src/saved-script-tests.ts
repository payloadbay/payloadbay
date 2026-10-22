import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { savedScriptTestInput } from "../../contracts/src/script-test.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { endpointFor } from "./endpoints.ts";
import { requirePermission } from "./membership.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { transaction } from "./db.ts";

export async function listSavedScriptTests(pool: Pool, actor: Actor, endpointId: string, key: string) {
	const { endpoint } = await endpointFor(pool, actor, endpointId, "code.read");
	await requirePermission(pool, actor, { type: "project", id: endpoint.project_id }, "code.test");
	const rows = (await pool.query("SELECT * FROM payloadbay.saved_script_test WHERE endpoint_id=$1 ORDER BY name,id LIMIT 100", [endpointId])).rows;

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		version: row.version,
		definition: decryptPrivate(row.encrypted_definition, key),
	}));
}

export async function saveScriptTest(pool: Pool, actor: Actor, endpointId: string, id: string | undefined, input: unknown, key: string) {
	const data = savedScriptTestInput.safeParse(input);
	if (!data.success) throw new AppError("invalid_input", 400, "Provide a named, bounded test fixture and TypeScript assertions");

	return transaction(pool, async (db) => {
		const { endpoint } = await endpointFor(db, actor, endpointId, "code.edit");
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "code.test");
		await db.query("SELECT id FROM payloadbay.endpoint WHERE id=$1 FOR UPDATE", [endpointId]);
		let row;
		if (id) {
			row = (await db.query("UPDATE payloadbay.saved_script_test SET name=$3,version=version+1,encrypted_definition=$4,updated_at=clock_timestamp() WHERE id=$1 AND endpoint_id=$2 AND version=$5 RETURNING id,name,version", [id, endpointId, data.data.name, encryptPrivate(data.data.definition, key), data.data.version])).rows[0];
			if (!row) throw new AppError("version_conflict", 409, "Test changed or is unavailable; reload before saving");
		} else {
			if (data.data.version !== 0) throw new AppError("version_conflict", 409, "A new test starts at version zero");
			if (Number((await db.query("SELECT count(*) FROM payloadbay.saved_script_test WHERE endpoint_id=$1", [endpointId])).rows[0].count) >= 100) throw new AppError("test_limit", 409, "Keep at most 100 saved tests per route");
			row = (await db.query("INSERT INTO payloadbay.saved_script_test(endpoint_id,name,encrypted_definition) VALUES($1,$2,$3) RETURNING id,name,version", [endpointId, data.data.name, encryptPrivate(data.data.definition, key)])).rows[0];
		}

		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'code.test_saved',$3,$4)", [actor.userId, endpoint.project_id, row.id, JSON.stringify({ name: row.name, resourceName: row.name, version: row.version })]);

		return row;
	});
}

export async function deleteScriptTest(pool: Pool, actor: Actor, endpointId: string, id: string) {
	return transaction(pool, async (db) => {
		const { endpoint } = await endpointFor(db, actor, endpointId, "code.edit");
		await requirePermission(db, actor, { type: "project", id: endpoint.project_id }, "code.test");
		const row = (await db.query("DELETE FROM payloadbay.saved_script_test WHERE id=$1 AND endpoint_id=$2 RETURNING id,name", [id, endpointId])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Saved test unavailable");
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'code.test_deleted',$3,$4)", [actor.userId, endpoint.project_id, id, JSON.stringify({ resourceName: row.name })]);

		return { deleted: true };
	});
}
