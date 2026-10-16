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

test("FT02a a workspace is created under its organization rather than the instance", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		const created = await createResource(
			pool,
			{ userId: "operator" },
			{
				type: "workspace",
				parentId: setup.organizationId,
				name: "Engineering",
				slug: "engineering",
			},
		);
		const row = (await db.query("SELECT organization_id,installation_id FROM payloadbay.workspace WHERE id=$1", [created.id])).rows[0];
		assert.equal(row.organization_id, setup.organizationId);
		assert.equal(row.installation_id, setup.installationId);
	});
});

test("FT02b organization owners inherit only their own organization resources", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		await identity(db, "customer");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { createResource, listResources } = await import("../../packages/domain/src/resources.ts");
		const { actorPermissions } = await import("../../packages/domain/src/membership.ts");
		const organization = await createResource(
			pool,
			{ userId: "operator" },
			{
				type: "organization",
				parentId: setup.installationId,
				name: "Customer",
				slug: "customer",
			},
		);
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,'customer',true)", [setup.installationId]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) SELECT 'customer','organization',$1,'owner',permissions FROM payloadbay.grant_record WHERE user_id='operator' AND scope_type='instance'", [organization.id]);
		const workspace = await createResource(
			pool,
			{ userId: "customer" },
			{
				type: "workspace",
				parentId: organization.id,
				name: "Team",
				slug: "team",
			},
		);
		assert.equal((await actorPermissions(pool, { userId: "customer" }, { type: "workspace", id: workspace.id })).has("projects.create"), true);
		assert.equal((await actorPermissions(pool, { userId: "customer" }, { type: "workspace", id: setup.workspaceId })).size, 0);
		assert.deepEqual(
			(await listResources(pool, { userId: "customer" }, "organization")).map((row) => row.id),
			[organization.id],
		);
		assert.deepEqual(
			(await listResources(pool, { userId: "customer" }, "workspace")).map((row) => row.id),
			[workspace.id],
		);
	});
});

test("FT01a a workspace cannot omit its organization", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		await assert.rejects(db.query("INSERT INTO payloadbay.workspace(installation_id,name,slug,owner_user_id) VALUES($1,'Orphan','orphan','operator')", [setup.installationId]), { code: "23502" });
	});
});

test("FT01b workspace names are local to organizations", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		const other = await createResource(
			pool,
			{ userId: "operator" },
			{
				type: "organization",
				parentId: setup.installationId,
				name: "Other",
				slug: "other",
			},
		);
		const workspace = await createResource(
			pool,
			{ userId: "operator" },
			{
				type: "workspace",
				parentId: other.id,
				name: "Default",
				slug: "default",
			},
		);
		assert.equal(workspace.organization_id, other.id);
		await assert.rejects(
			createResource(
				pool,
				{ userId: "operator" },
				{
					type: "workspace",
					parentId: other.id,
					name: "Duplicate",
					slug: "default",
				},
			),
			{ code: "slug_conflict" },
		);
	});
});

test("FT03a organization live changes exclude sibling organizations", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		const { readChanges } = await import("../../packages/domain/src/live.ts");
		const other = await createResource(
			pool,
			{ userId: "operator" },
			{
				type: "organization",
				parentId: setup.installationId,
				name: "Other",
				slug: "other",
			},
		);
		await db.query("SELECT payloadbay.append_change('organization',$1::uuid,'configuration.changed',($1::uuid)::text,'{}'::jsonb)", [setup.organizationId]);
		await db.query("SELECT payloadbay.append_change('organization',$1::uuid,'configuration.changed',($1::uuid)::text,'{}'::jsonb)", [other.id]);
		const result = await readChanges(pool, { userId: "operator" }, { scope: { type: "organization", id: setup.organizationId }, after: "0" });
		assert.deepEqual(
			result.items.map((item) => item.resourceId),
			[setup.organizationId],
		);
	});
});

test("FT05a an organization administrator can invite a new identity without global administration", async () => {
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { createInvitation } = await import("../../packages/domain/src/invitations.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await identity(f.db, "customer");
		const setup = await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		await f.db.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,'customer',true)", [setup.installationId]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('customer','organization',$1,'admin',$2)", [setup.organizationId, rolePermissions.admin]);
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			const scope = { type: "organization" as const, id: setup.organizationId };
			await createInvitation(f.pool, { userId: "customer" }, { scope, email: "new-customer@example.test", grants: [{ scope, role: "viewer", permissions: rolePermissions.viewer }] }, service, config.encryptionKey, config.publicUrl);
			const user = (await f.db.query('SELECT id FROM auth."user" WHERE email=$1', ["new-customer@example.test"])).rows[0];
			assert.equal((await f.db.query("SELECT active FROM payloadbay.admission WHERE user_id=$1", [user.id])).rows[0].active, true);
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE user_id=$1", [user.id])).rows[0].n, 0);
			await f.db.query("UPDATE payloadbay.admission SET active=false WHERE user_id=$1", [user.id]);
			await assert.rejects(createInvitation(f.pool, { userId: "customer" }, { scope, email: "new-customer@example.test", grants: [{ scope, role: "viewer", permissions: rolePermissions.viewer }] }, service, config.encryptionKey, config.publicUrl), { code: "inactive_admission" });
			assert.equal((await f.db.query("SELECT active FROM payloadbay.admission WHERE user_id=$1", [user.id])).rows[0].active, false);
		} finally {
			await service.close();
		}
	});
});
