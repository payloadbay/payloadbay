import test from "node:test";
import type { Pool, PoolClient } from "pg";
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

test("FT03e unrelated organization secrets and code cannot be read or pinned across customers", async () => {
	await authFixture(async ({ pool, db }) => {
		const { createSecret, resolveSecret, resolvePinnedSecrets, listSecrets } = await import("../../packages/domain/src/secrets.ts");
		const { createSharedVersion, getSharedVersion, resolveSharedModules, listSharedVersions } = await import("../../packages/domain/src/shared-code.ts");
		const { compile } = await import("../../apps/executor/src/compiler.ts");
		const { a, projectA, projectB } = await customerPair(pool, db);
		const scopeA = { type: "organization" as const, id: a.organizationId };
		const key = "fixture-encryption-key-32-characters";
		const secret = await createSecret(pool, { userId: "customer-a" }, { scope: scopeA, name: "signingKey", value: "synthetic-secret" }, key);
		assert.equal(await resolveSecret(pool, { userId: "customer-a" }, secret.id, key), "synthetic-secret");
		assert.equal((await resolvePinnedSecrets(pool, projectA.id, { signingKey: secret.id }, key)).signingKey, "synthetic-secret");
		await assert.rejects(resolveSecret(pool, { userId: "customer-b" }, secret.id, key), { code: "forbidden" });
		await assert.rejects(resolvePinnedSecrets(pool, projectB.id, { signingKey: secret.id }, key), { code: "secret_unavailable" });
		assert.deepEqual(await listSecrets(pool, { userId: "customer-b" }, { type: "project", id: projectB.id }), []);
		const helper = await createSharedVersion(
			pool,
			{ userId: "customer-a" },
			{
				scope: scopeA,
				name: "formatEvent",
				source: "export function formatEvent() { return 'synthetic'; }",
				compile,
			},
		);
		assert.equal((await resolveSharedModules(pool, { userId: "customer-a" }, { type: "project", id: projectA.id }, { formatEvent: helper.id })).formatEvent.revisionId, helper.id);
		await assert.rejects(getSharedVersion(pool, { userId: "customer-b" }, helper.id), { code: "forbidden" });
		await assert.rejects(resolveSharedModules(pool, { userId: "operator" }, { type: "project", id: projectB.id }, { formatEvent: helper.id }), { code: "invalid_shared_binding" });
		assert.deepEqual(await listSharedVersions(pool, { userId: "customer-b" }, { type: "project", id: projectB.id }), []);
	});
});

async function customerPair(pool: Pool, db: PoolClient) {
	const { provisionCustomerOrganization } = await import("../../packages/domain/src/onboarding.ts");
	const { createResource } = await import("../../packages/domain/src/resources.ts");
	await identity(db, "operator");
	await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
	for (const user of ["customer-a", "customer-b"]) await identity(db, user);
	const a = await provisionCustomerOrganization(pool, { userId: "customer-a", name: "Customer A", slug: "customer-a" }, "organization");
	const b = await provisionCustomerOrganization(pool, { userId: "customer-b", name: "Customer B", slug: "customer-b" }, "organization");
	const projectA = await createResource(
		pool,
		{ userId: "customer-a" },
		{
			type: "project",
			parentId: a.workspaceId,
			name: "App",
			slug: "app",
		},
	);
	const projectB = await createResource(
		pool,
		{ userId: "customer-b" },
		{
			type: "project",
			parentId: b.workspaceId,
			name: "App",
			slug: "app",
		},
	);

	return {
		a,
		b,
		projectA,
		projectB,
	};
}

test("FT03f organization tokens stay scoped when their owner joins another customer's project", async () => {
	await authFixture(async ({ pool, db }) => {
		const { a, b, projectA, projectB } = await customerPair(pool, db);
		const { createToken, authenticateToken } = await import("../../packages/domain/src/tokens.ts");
		const { setGrant, actorPermissions } = await import("../../packages/domain/src/membership.ts");
		const { listResources } = await import("../../packages/domain/src/resources.ts");
		const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
		await setGrant(
			pool,
			{ userId: "customer-b" },
			{
				scope: { type: "project", id: projectB.id },
				userId: "customer-a",
				role: "viewer",
				permissions: rolePermissions.viewer,
				expectedVersion: null,
			},
		);
		assert.deepEqual(new Set((await listResources(pool, { userId: "customer-a" }, "project")).map((item) => item.id)), new Set([projectA.id, projectB.id]));
		assert.deepEqual(
			(await listResources(pool, { userId: "customer-a" }, "organization")).map((item) => item.id),
			[a.organizationId],
		);
		assert.equal((await actorPermissions(pool, { userId: "customer-a" }, { type: "organization", id: b.organizationId })).size, 0);
		const token = await createToken(
			pool,
			{ userId: "customer-a" },
			{
				scope: { type: "organization", id: a.organizationId },
				name: "Scoped automation",
				permissions: ["metadata.read"],
				expiresAt: new Date(Date.now() + 3600000),
			},
		);
		const actor = await authenticateToken(pool, token.secret);
		assert.ok(actor);
		assert.deepEqual(
			(await listResources(pool, actor, "project")).map((item) => item.id),
			[projectA.id],
		);
		await assert.rejects(actorPermissions(pool, actor, { type: "project", id: projectB.id }), { code: "unauthenticated" });
		await db.query("UPDATE payloadbay.admission SET active=false WHERE user_id='customer-a'");
		assert.equal(await authenticateToken(pool, token.secret), null);
	});
});

test("FT03g event detail, aggregates and live backfill expose only authorized customer projects", async () => {
	await authFixture(async ({ pool, db }) => {
		const { a, b, projectA, projectB } = await customerPair(pool, db);
		const { seedEvent } = await import("../helpers/domain-fixtures.ts");
		const { listEvents, eventDetails, eventPayload } = await import("../../packages/domain/src/events.ts");
		const { dashboardOverview } = await import("../../packages/domain/src/overview.ts");
		const { appendChange } = await import("../../packages/domain/src/changes.ts");
		const { readChanges } = await import("../../packages/domain/src/live.ts");
		const events: string[] = [];
		for (const project of [projectA, projectB]) {
			const endpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Webhook','webhook',gen_random_uuid()::text) RETURNING id", [project.id])).rows[0].id;
			const revisions = await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES('ingress','fixture','fixture','1','fixture','fixture','{}'),('processing','fixture','fixture','1','fixture','fixture','{}') RETURNING id");
			const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) VALUES($1,$2,$3,'fixture','operator') RETURNING id", [endpoint, revisions.rows[0].id, revisions.rows[1].id])).rows[0].id;
			const event = await seedEvent(db, { endpoint, publication });
			events.push(event);
			await appendChange(db, { scope: { type: "project", id: project.id }, kind: "event.recorded", resourceId: event });
		}

		const actor = { userId: "customer-a" };
		assert.deepEqual(
			(await listEvents(pool, actor, {})).items.map((item) => item.id),
			[events[0]],
		);
		assert.equal((await eventDetails(pool, actor, events[0])).projectId, projectA.id);
		await assert.rejects(eventDetails(pool, actor, events[1]), { code: "forbidden" });
		await assert.rejects(eventPayload(pool, actor, events[1]), { code: "forbidden" });
		assert.equal((await dashboardOverview(pool, actor)).totals.ingress, 1);
		const changes = await readChanges(pool, actor, { scope: { type: "organization", id: a.organizationId }, after: "0" });
		assert.deepEqual(
			changes.items.filter((item) => item.kind === "event.recorded").map((item) => item.resourceId),
			[events[0]],
		);
		await assert.rejects(readChanges(pool, actor, { scope: { type: "organization", id: b.organizationId }, after: "0" }), { code: "forbidden" });
		const accessible = await readChanges(pool, actor, { scope: { type: "accessible", id: (await db.query("SELECT id FROM payloadbay.installation")).rows[0].id }, after: "0" });
		assert.deepEqual(
			accessible.items.filter((item) => item.kind === "event.recorded").map((item) => item.resourceId),
			[events[0]],
		);
	});
});

test("FT10c a flooded organization cannot hide a neighboring organization behind its backlog", async () => {
	await authFixture(async ({ pool, db }) => {
		const { b, projectA, projectB } = await customerPair(pool, db);
		const { nextOrganizationFlags } = await import("../../packages/domain/src/organization-scheduling.ts");
		const { scheduleDispatch, claimExecution, finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
		const { transaction } = await import("../../packages/domain/src/db.ts");
		const { seedEvent } = await import("../helpers/domain-fixtures.ts");
		const { run } = await import("../../apps/worker/node_modules/graphile-worker/dist/index.js");
		const offers: { id: string; endpoint: string; project: string }[] = [];
		for (const project of [projectA, projectB]) {
			const endpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key,priority) VALUES($1,'Webhook','webhook',gen_random_uuid()::text,0) RETURNING id", [project.id])).rows[0].id;
			const revisions = await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES('ingress','fixture','fixture','1','fixture','fixture','{}'),('processing','fixture','fixture','1','fixture','fixture','{}') RETURNING id");
			const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) VALUES($1,$2,$3,'fixture','operator') RETURNING id", [endpoint, revisions.rows[0].id, revisions.rows[1].id])).rows[0].id;
			const event = await seedEvent(db, { endpoint, publication });
			for (let index = 0; index < (project.id === projectA.id ? 40 : 1); index++) {
				const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING *", [event, endpoint, publication])).rows[0];
				await transaction(pool, (client) => scheduleDispatch(client, execution, 0));
				offers.push({ id: execution.id, endpoint, project: project.id });
			}
		}

		const seen: string[] = [];
		const runner = await run({
			pgPool: pool,
			noHandleSignals: true,
			pollInterval: 50,
			concurrency: 1,
			forbiddenFlags: () => nextOrganizationFlags(pool, "critical"),
			taskList: {
				process_event: async (payload: any) => {
					const execution = await claimExecution(pool, payload.executionId, payload.generation, "fairness-worker");
					if (!execution) return;
					seen.push(offers.find((offer) => offer.id === execution.id)!.project);
					await finishExecution(
						pool,
						{
							executionId: execution.id,
							endpointId: execution.endpoint_id,
							generation: execution.dispatch_generation,
							owner: "fairness-worker",
						},
						{ kind: "complete" },
					);
				},
			},
		});
		try {
			const deadline = Date.now() + 5000;
			while (!seen.includes(projectB.id) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
			assert.ok(seen.includes(projectB.id), "neighbor must progress while backlog remains");
			assert.ok(seen.indexOf(projectB.id) <= 2, "neighbor gets a turn within three claims, not after forty older jobs");
		} finally {
			await runner.stop();
		}

		// A pre-upgrade offer has no tenant flag; it must remain eligible without rewriting its identity.
		const previous = offers.find((offer) => offer.project === projectB.id)!;
		const legacy = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) SELECT event_id,endpoint_id,publication_id FROM payloadbay.execution WHERE id=$1 RETURNING *", [previous.id])).rows[0];
		const key = "legacy:" + legacy.id;
		const payload = JSON.stringify({ executionId: legacy.id, endpointId: legacy.endpoint_id, generation: 1 });
		const job = (await db.query("SELECT (graphile_worker.add_job('process_event',$1::json,NULL,clock_timestamp(),5,$2,0::smallint)).id AS id", [payload, key])).rows[0].id;
		await db.query("INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,graphile_job_id,job_key,claim_deadline_at) VALUES($1,$2,1,$3,$4,clock_timestamp()+interval '30 seconds')", [legacy.id, legacy.endpoint_id, job, key]);
		let legacyEligible = false;
		for (let turn = 0; turn < 2; turn++) {
			const flags = await nextOrganizationFlags(pool, "critical");
			if (!flags.includes("critical") && !flags.includes("organization:" + b.organizationId)) legacyEligible = true;
		}

		assert.equal(legacyEligible, true, "legacy offers remain eligible after installing tenant scheduling");
	});
});

test("FT03h publications inherit only their organization middleware and reject foreign secret pins", async () => {
	await authFixture(async ({ pool, db }) => {
		const { a, b, projectA, projectB } = await customerPair(pool, db);
		const { createEndpoint } = await import("../../packages/domain/src/endpoints.ts");
		const { createMiddlewareBinding } = await import("../../packages/domain/src/middleware.ts");
		const { publish, saveDraft } = await import("../../packages/domain/src/publication.ts");
		const { createSecret } = await import("../../packages/domain/src/secrets.ts");
		const { compile } = await import("../../apps/executor/src/compiler.ts");
		const bindings = [];
		for (const [organization, userId] of [
			[a, "customer-a"],
			[b, "customer-b"],
		] as const) {
			bindings.push(
				await createMiddlewareBinding(
					pool,
					{ userId },
					{
						scope: { type: "organization", id: organization.organizationId },
						name: "Company middleware",
						stage: "processing",
						body: "return ctx.continue();",
						position: 0,
						failurePolicy: "required",
						overridePolicy: "allowed",
						compile,
					},
				),
			);
		}

		const endpointA = await createEndpoint(pool, { userId: "customer-a" }, { projectId: projectA.id, name: "A", slug: "a" });
		const endpointB = await createEndpoint(pool, { userId: "customer-b" }, { projectId: projectB.id, name: "B", slug: "b" });
		const published = await publish(
			pool,
			{ userId: "customer-a" },
			{
				endpointId: endpointA.id,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile,
			},
		);
		const snapshot = (await db.query("SELECT effective_bindings FROM payloadbay.publication WHERE id=$1", [published.id])).rows[0].effective_bindings;
		assert.deepEqual(
			snapshot.map((binding: { id: string }) => binding.id),
			[bindings[0].id],
		);
		await assert.rejects(
			publish(
				pool,
				{ userId: "customer-b" },
				{
					endpointId: endpointA.id,
					expectedVersion: 2,
					draftVersions: { ingress: 1, processing: 1 },
					compile,
				},
			),
			{ code: "forbidden" },
		);
		await assert.rejects(
			createMiddlewareBinding(
				pool,
				{ userId: "operator" },
				{
					scope: { type: "project", id: projectB.id },
					name: "Invalid copy",
					stage: "processing",
					body: "return ctx.continue();",
					position: 0,
					failurePolicy: "required",
					overridePolicy: "allowed",
					originBindingId: bindings[0].id,
					compile,
				},
			),
			{ code: "invalid_middleware_origin" },
		);
		const secret = await createSecret(pool, { userId: "customer-a" }, { scope: { type: "organization", id: a.organizationId }, name: "signingKey", value: "synthetic-value" }, "fixture-encryption-key-32-characters");
		await saveDraft(
			pool,
			{ userId: "operator" },
			{
				endpointId: endpointB.id,
				stage: "processing",
				body: "return ctx.complete();",
				expectedVersion: 1,
				secretBindings: { signingKey: secret.id },
			},
		);
		await assert.rejects(
			publish(
				pool,
				{ userId: "operator" },
				{
					endpointId: endpointB.id,
					expectedVersion: 1,
					draftVersions: { ingress: 1, processing: 2 },
					compile,
				},
			),
			{ code: "invalid_secret_binding" },
		);
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint WHERE id=$1", [endpointB.id])).rows[0].active_publication_id, null);
	});
});
