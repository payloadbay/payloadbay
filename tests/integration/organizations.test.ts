import test from "node:test";
import assert from "node:assert/strict";
import { authFixture, identity, setupSecret } from "../helpers/auth-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";

test("FT04a owner setup creates a default organization and workspace atomically", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const result = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const created = result as typeof result & { organizationId?: string; workspaceId?: string };
		assert.equal(typeof created.organizationId, "string", "setup must provision an organization");
		assert.equal(typeof created.workspaceId, "string", "setup must provision a workspace");
		const workspace = (await db.query("SELECT organization_id,installation_id FROM payloadbay.workspace WHERE id=$1", [created.workspaceId])).rows[0];
		assert.equal(workspace.organization_id, created.organizationId);
		assert.equal(workspace.installation_id, created.installationId);
	});
});
