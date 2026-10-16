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

test("FT04b a failed default workspace rolls back owner setup", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		await db.query("CREATE FUNCTION payloadbay.fail_workspace_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'workspace_fixture_failure'; END $$");
		await db.query("CREATE TRIGGER fail_workspace_fixture BEFORE INSERT ON payloadbay.workspace FOR EACH ROW EXECUTE FUNCTION payloadbay.fail_workspace_fixture()");
		await assert.rejects(bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret }), /workspace_fixture_failure/);
		for (const table of ["installation", "organization", "workspace", "admission", "grant_record"]) {
			assert.equal((await db.query(`SELECT count(*)::int AS n FROM payloadbay.${table}`)).rows[0].n, 0, `${table} must roll back`);
		}

		await db.query("DROP TRIGGER fail_workspace_fixture ON payloadbay.workspace");
		await db.query("DROP FUNCTION payloadbay.fail_workspace_fixture()");
		const recovered = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		assert.equal(typeof recovered.organizationId, "string");
	});
});

test("FT03b archived organizations revoke descendant access", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { actorPermissions } = await import("../../packages/domain/src/membership.ts");
		const { listResources } = await import("../../packages/domain/src/resources.ts");
		await db.query("UPDATE payloadbay.organization SET archived_at=clock_timestamp() WHERE id=$1", [setup.organizationId]);
		await assert.rejects(actorPermissions(pool, { userId: "operator" }, { type: "workspace", id: setup.workspaceId }), { code: "not_found" });
		assert.deepEqual(await listResources(pool, { userId: "operator" }, "workspace"), []);
	});
});

test("FT04c verified customer onboarding is idempotent and grants no instance role", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		await identity(db, "customer");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { provisionCustomerOrganization } = await import("../../packages/domain/src/onboarding.ts");
		const input = { userId: "customer", name: "Customer company", slug: "customer-company" };
		await assert.rejects(provisionCustomerOrganization(pool, input, "invite_only"), { code: "registration_disabled" });
		const [first, second] = await Promise.all([provisionCustomerOrganization(pool, input, "organization"), provisionCustomerOrganization(pool, input, "organization")]);
		assert.equal(first.organizationId, second.organizationId);
		assert.equal(first.workspaceId, second.workspaceId);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.organization WHERE owner_user_id='customer'")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE user_id='customer' AND scope_type='instance'")).rows[0].n, 0);
		const { actorPermissions } = await import("../../packages/domain/src/membership.ts");
		assert.equal((await actorPermissions(pool, { userId: "customer" }, { type: "workspace", id: first.workspaceId })).has("projects.create"), true);
		assert.equal((await actorPermissions(pool, { userId: "customer" }, { type: "instance", id: setup.installationId })).size, 0);
	});
});

test("FT04d registration permits a verified onboarding session without domain access", async () => {
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	const { authenticateRequest } = await import("../../packages/domain/src/principal.ts");
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await identity(f.db, "customer", false);
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = { ...fixtureConfig(f), registrationPolicy: "organization" as const };
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "customer@example.test", type: "sign-in" } });
			const payload = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE kind='otp_mail'")).rows[0].encrypted_payload;
			const mail = decryptPrivate<{ otp: string }>(payload, config.encryptionKey);
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "customer@example.test", otp: mail.otp }) }));
			assert.equal(response.status, 200, "verified new customers need a narrow onboarding session");
			const cookie = response.headers
				.getSetCookie()
				.map((value) => value.split(";")[0])
				.join("; ");
			const request = new Request(config.publicUrl + "/api/v1/projects", { headers: { cookie } });
			assert.equal(await authenticateRequest(f.pool, service, request), null);
			assert.equal((await service.api.getSession({ headers: request.headers }))?.user.email, "customer@example.test");
		} finally {
			await service.close();
		}
	});
});

test("FT04e enabled customer registration verifies a new email without premature admission", async () => {
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	await authFixture(async (f) => {
		await identity(f.db, "operator");
		await bootstrapOwner(f.pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = { ...fixtureConfig(f), registrationPolicy: "organization" as const };
		const service = createAuth(f.pool, config);
		try {
			const response = await service.handler(new Request(config.publicUrl + "/api/auth/email-otp/send-verification-otp", { method: "POST", headers: { origin: config.publicUrl, "content-type": "application/json" }, body: JSON.stringify({ email: "new-company@example.test", type: "sign-in" }) }));
			assert.equal(response.status, 200);
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.platform_job WHERE kind='otp_mail'")).rows[0].n, 1);
			const user = (await f.db.query('SELECT id FROM auth."user" WHERE email=$1', ["new-company@example.test"])).rows[0];
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.admission WHERE user_id=$1", [user.id])).rows[0].n, 0);
		} finally {
			await service.close();
		}
	});
});

test("FT01c legacy workspace mapping preserves event execution and grant identity", async () => {
	const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
	const { readFile } = await import("node:fs/promises");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	await authFixture(async ({ db }) => {
		await identity(db, "fixture-owner");
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, rolePermissions.owner]);
		const eventId = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [eventId, scope.endpoint, scope.publication])).rows[0];
		const { scheduleDispatch } = await import("../../packages/domain/src/execution-lease.ts");
		await scheduleDispatch(
			db,
			{
				id: execution.id,
				endpoint_id: scope.endpoint,
				dispatch_generation: 1,
				due_at: new Date(),
			},
			0,
		);
		const dispatches = (await db.query("SELECT execution_id,generation,graphile_job_id,job_key FROM payloadbay.dispatch ORDER BY execution_id,generation")).rows;
		const jobs = (await db.query("SELECT id,key FROM graphile_worker.jobs ORDER BY id")).rows;
		const grants = (await db.query("SELECT * FROM payloadbay.grant_record ORDER BY id")).rows;
		await db.query("DROP TRIGGER immutable_workspace_parent ON payloadbay.workspace");
		await db.query("ALTER TABLE payloadbay.workspace ALTER COLUMN organization_id DROP NOT NULL");
		await db.query("UPDATE payloadbay.workspace SET organization_id=NULL WHERE id=$1", [scope.workspace]);
		await db.query("DELETE FROM payloadbay.organization WHERE id=$1", [scope.organization]);
		const source = await readFile(new URL("../../packages/domain/sql/runtime.sql", import.meta.url), "utf8");
		await db.query(source);
		const mapped = (await db.query("SELECT organization_id FROM payloadbay.workspace WHERE id=$1", [scope.workspace])).rows[0];
		assert.ok(mapped.organization_id, "legacy workspace must receive an organization");
		await db.query(source);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.organization")).rows[0].n, 1);
		assert.deepEqual((await db.query("SELECT * FROM payloadbay.grant_record ORDER BY id")).rows, grants);
		assert.deepEqual((await db.query("SELECT execution_id,generation,graphile_job_id,job_key FROM payloadbay.dispatch ORDER BY execution_id,generation")).rows, dispatches);
		assert.deepEqual((await db.query("SELECT id,key FROM graphile_worker.jobs ORDER BY id")).rows, jobs);
		assert.equal((await db.query("SELECT event_id,endpoint_id,publication_id FROM payloadbay.execution WHERE id=$1", [execution.id])).rows[0].event_id, eventId);
		assert.equal((await db.query("SELECT workspace_id FROM payloadbay.project WHERE id=$1", [scope.project])).rows[0].workspace_id, scope.workspace);
	});
});

test("FT01d generated upgrade adds lineage before enforcing its required constraint", async () => {
	const { readFile } = await import("node:fs/promises");
	const { composeReleaseMigration } = await import("../../scripts/database/compose-migration.ts");
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		await db.query("ALTER TABLE payloadbay.workspace DROP COLUMN organization_id CASCADE");
		await db.query("DELETE FROM payloadbay.organization WHERE id=$1", [setup.organizationId]);
		const generated = 'ALTER TABLE "payloadbay"."workspace" ADD COLUMN "organization_id" uuid NOT NULL;';
		const behavior = await readFile(new URL("../../packages/domain/sql/runtime.sql", import.meta.url), "utf8");
		await db.query(composeReleaseMigration(generated, behavior));
		assert.equal((await db.query("SELECT organization_id FROM payloadbay.workspace WHERE id=$1", [setup.workspaceId])).rows[0].organization_id, setup.workspaceId);
		await assert.rejects(db.query("INSERT INTO payloadbay.workspace(installation_id,name,slug,owner_user_id) VALUES($1,'Orphan','orphan','operator')", [setup.installationId]), { code: "23502" });
	});
});

test("FT01e mapping retains archived workspace visibility", async () => {
	const { readFile } = await import("node:fs/promises");
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		await db.query("DROP TRIGGER immutable_workspace_parent ON payloadbay.workspace");
		await db.query("ALTER TABLE payloadbay.workspace ALTER COLUMN organization_id DROP NOT NULL");
		await db.query("UPDATE payloadbay.workspace SET organization_id=NULL,archived_at=clock_timestamp() WHERE id=$1", [setup.workspaceId]);
		await db.query("DELETE FROM payloadbay.organization WHERE id=$1", [setup.organizationId]);
		await db.query(await readFile(new URL("../../packages/domain/sql/runtime.sql", import.meta.url), "utf8"));
		const mapped = (await db.query("SELECT o.archived_at FROM payloadbay.organization o JOIN payloadbay.workspace w ON w.organization_id=o.id WHERE w.id=$1", [setup.workspaceId])).rows[0];
		assert.ok(mapped.archived_at, "archived legacy workspace must not create a visible organization");
	});
});

test("FT03c organization ownership cannot be changed underneath retained resources", async () => {
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
				name: "Other company",
				slug: "other-company",
			},
		);
		await assert.rejects(db.query("UPDATE payloadbay.workspace SET organization_id=$2 WHERE id=$1", [setup.workspaceId, other.id]), /immutable resource parent/);
	});
});
