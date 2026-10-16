import test from "node:test";
import assert from "node:assert/strict";
import { authFixture, identity, setupSecret } from "../helpers/auth-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";

test("FT09a self-hosted organizations default to local unlimited commercial policy", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { resolveOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		const policy = await resolveOrganizationPolicy(pool, setup.organizationId);
		assert.equal(policy.deploymentMode, "self_hosted");
		assert.equal(policy.limits.workspaces, null);
		assert.equal(policy.limits.projects, null);
		assert.equal(policy.limits.admission, null);
		assert.equal(policy.version, 0);
		assert.equal(policy.processingConcurrency, 4);
	});
});

test("FT09b hosted policy cannot silently become unlimited when missing or malformed", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { resolveOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		await db.query("UPDATE payloadbay.installation SET deployment_mode='hosted'");
		await assert.rejects(resolveOrganizationPolicy(pool, setup.organizationId), { code: "organization_policy_required" });
		await db.query("INSERT INTO payloadbay.organization_policy(organization_id,limits,updated_by) VALUES($1,'{}','operator')", [setup.organizationId]);
		await assert.rejects(resolveOrganizationPolicy(pool, setup.organizationId), { code: "organization_policy_invalid" });
	});
});

test("FT09c only an instance operator can write optimistic audited organization policy", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		await identity(db, "customer");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'customer')", [setup.installationId]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('customer','organization',$1,'owner',$2)", [setup.organizationId, rolePermissions.owner]);
		const { setOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		const input = {
			organizationId: setup.organizationId,
			expectedVersion: 0,
			limits: { workspaces: 1, projects: 2, admission: null },
			processingConcurrency: 2,
		};
		await assert.rejects(setOrganizationPolicy(pool, { userId: "customer" }, input), { code: "forbidden" });
		const saved = await setOrganizationPolicy(pool, { userId: "operator" }, input);
		assert.equal(saved.version, 1);
		await assert.rejects(setOrganizationPolicy(pool, { userId: "operator" }, input), { code: "version_conflict" });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.organization_policy_revision")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.audit WHERE operation='organization.policy.updated'")).rows[0].n, 1);
		await assert.rejects(db.query("UPDATE payloadbay.organization_policy_revision SET snapshot='{}'"), /immutable history/);
	});
});

test("FT09d concurrent resource creation cannot overspend the last organization slot", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { setOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		await setOrganizationPolicy(
			pool,
			{ userId: "operator" },
			{
				organizationId: setup.organizationId,
				expectedVersion: 0,
				limits: { workspaces: 2, projects: null, admission: null },
				processingConcurrency: 4,
			},
		);
		const results = await Promise.allSettled(
			["a", "b"].map((slug) =>
				createResource(
					pool,
					{ userId: "operator" },
					{
						type: "workspace",
						parentId: setup.organizationId,
						name: slug,
						slug,
					},
				),
			),
		);
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
		assert.equal((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.code, "organization_limit_reached");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.workspace WHERE organization_id=$1", [setup.organizationId])).rows[0].n, 2);
	});
});

test("FT09f project ceilings stay inside their organization", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { setOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		await setOrganizationPolicy(
			pool,
			{ userId: "operator" },
			{
				organizationId: setup.organizationId,
				expectedVersion: 0,
				limits: { workspaces: null, projects: 1, admission: null },
				processingConcurrency: 4,
			},
		);
		const results = await Promise.allSettled(
			["a", "b"].map((slug) =>
				createResource(
					pool,
					{ userId: "operator" },
					{
						type: "project",
						parentId: setup.workspaceId,
						name: slug,
						slug,
					},
				),
			),
		);
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
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
				name: "Team",
				slug: "team",
			},
		);
		assert.ok(
			await createResource(
				pool,
				{ userId: "operator" },
				{
					type: "project",
					parentId: workspace.id,
					name: "Project",
					slug: "project",
				},
			),
		);
	});
});

test("FT11a policy reads require organization visibility independently of operator writes", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		await identity(db, "outsider");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'outsider')", [setup.installationId]);
		const { readOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
		assert.equal((await readOrganizationPolicy(pool, { userId: "operator" }, setup.organizationId)).organizationId, setup.organizationId);
		await assert.rejects(readOrganizationPolicy(pool, { userId: "outsider" }, setup.organizationId), { code: "forbidden" });
	});
});

test("FT09g clearing and reapplying a quota window retains accepted usage and rollback releases its slot", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { setOrganizationPolicy, mayAcceptIngress } = await import("../../packages/domain/src/organization-policy.ts");
		const { recordUsage } = await import("../../packages/domain/src/usage.ts");
		const { transaction } = await import("../../packages/domain/src/db.ts");
		const admission = { limit: 2, from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 60000).toISOString() };
		const policy = {
			organizationId: setup.organizationId,
			expectedVersion: 0,
			limits: { workspaces: null, projects: null, admission },
			processingConcurrency: 4,
		};
		await setOrganizationPolicy(pool, { userId: "operator" }, policy);
		await assert.rejects(
			transaction(pool, async (client) => {
				assert.equal(await mayAcceptIngress(client, setup.organizationId), true);
				await recordUsage(client, { organizationId: setup.organizationId, metric: "ingress.accepted", sourceKey: "rolled-back" });
				throw Error("fixture_rollback");
			}),
			/fixture_rollback/,
		);
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.admission_window_counter")).rows[0].quantity, "0");
		await transaction(pool, (client) => recordUsage(client, { organizationId: setup.organizationId, metric: "ingress.accepted", sourceKey: "first" }));
		await setOrganizationPolicy(pool, { userId: "operator" }, { ...policy, expectedVersion: 1, limits: { ...policy.limits, admission: null } });
		await transaction(pool, (client) => recordUsage(client, { organizationId: setup.organizationId, metric: "ingress.accepted", sourceKey: "while-unlimited" }));
		await setOrganizationPolicy(pool, { userId: "operator" }, { ...policy, expectedVersion: 2 });
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.admission_window_counter")).rows[0].quantity, "2");
		assert.equal(await transaction(pool, (client) => mayAcceptIngress(client, setup.organizationId)), false);
		await setOrganizationPolicy(
			pool,
			{ userId: "operator" },
			{
				...policy,
				expectedVersion: 3,
				limits: {
					...policy.limits,
					admission: {
						...admission,
						limit: 100,
						from: "2020-01-01T00:00:00Z",
						to: "2020-02-01T00:00:00Z",
					},
				},
			},
		);
		assert.equal(await transaction(pool, (client) => mayAcceptIngress(client, setup.organizationId)), false);
	});
});
