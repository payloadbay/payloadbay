import test from "node:test";
import assert from "node:assert/strict";
import { authFixture, identity, setupSecret } from "../helpers/auth-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";
import { transaction } from "../../packages/domain/src/db.ts";

test("FT07a duplicate usage facts increment durable totals only once", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { recordUsage } = await import("../../packages/domain/src/usage.ts");
		const input = {
			organizationId: setup.organizationId,
			workspaceId: setup.workspaceId,
			metric: "ingress.recorded" as const,
			sourceKey: "fixture-event",
		};
		await Promise.all(Array.from({ length: 8 }, () => transaction(pool, (client) => recordUsage(client, input))));
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.usage_fact")).rows[0].n, 1);
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.usage_counter WHERE organization_id=$1 AND metric=$2", [setup.organizationId, input.metric])).rows[0].quantity, "1");
		await assert.rejects(db.query("UPDATE payloadbay.usage_fact SET quantity=2"), /immutable history/);
	});
});

test("FT07b an enclosing rollback removes facts and both durable rollups", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { recordUsage } = await import("../../packages/domain/src/usage.ts");
		await assert.rejects(
			transaction(pool, async (client) => {
				await recordUsage(client, { organizationId: setup.organizationId, metric: "ingress.recorded", sourceKey: "rolled-back-event" });
				throw Error("fixture_rollback");
			}),
			/fixture_rollback/,
		);
		for (const table of ["usage_fact", "usage_counter", "usage_hour"]) assert.equal((await db.query(`SELECT count(*)::int AS n FROM payloadbay.${table}`)).rows[0].n, 0);
	});
});

test("FT07c usage attribution cannot mix an organization with another organization's workspace", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { createResource } = await import("../../packages/domain/src/resources.ts");
		const { recordUsage } = await import("../../packages/domain/src/usage.ts");
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
		await assert.rejects(
			transaction(pool, (client) =>
				recordUsage(client, {
					organizationId: other.id,
					workspaceId: setup.workspaceId,
					metric: "ingress.recorded",
					sourceKey: "wrong-tenant",
				}),
			),
			{ code: "23503" },
		);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.usage_fact")).rows[0].n, 0);
	});
});

test("FT07d usage windows are UTC, half-open, authorized and reconcile with durable rollups", async () => {
	await authFixture(async ({ pool, db }) => {
		await identity(db, "operator");
		const setup = await bootstrapOwner(pool, { userId: "operator", providedSecret: setupSecret, expectedSecret: setupSecret });
		const { recordUsage, readOrganizationUsage } = await import("../../packages/domain/src/usage.ts");
		await transaction(pool, (client) => recordUsage(client, { organizationId: setup.organizationId, metric: "ingress.recorded", sourceKey: "retained-counter" }));
		const fact = (await db.query("SELECT occurred_at FROM payloadbay.usage_fact")).rows[0];
		const from = fact.occurred_at.toISOString();
		const to = new Date(fact.occurred_at.getTime() + 1000).toISOString();
		const report = await readOrganizationUsage(pool, { userId: "operator" }, setup.organizationId, { from, to });
		assert.equal(report.metrics["ingress.recorded"].window, "1");
		assert.equal(report.metrics["ingress.recorded"].lifetime, "1");
		assert.equal(report.metrics["execution.failed"].window, "0");
		const excluded = await readOrganizationUsage(pool, { userId: "operator" }, setup.organizationId, { from: new Date(fact.occurred_at.getTime() - 1000).toISOString(), to: from });
		assert.equal(excluded.metrics["ingress.recorded"].window, "0");
		await identity(db, "outsider");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'outsider')", [setup.installationId]);
		await assert.rejects(readOrganizationUsage(pool, { userId: "outsider" }, setup.organizationId, { from, to }), { code: "forbidden" });
		await assert.rejects(readOrganizationUsage(pool, { userId: "operator" }, setup.organizationId, { from: to, to: from }), { code: "invalid_usage_window" });
		await assert.rejects(readOrganizationUsage(pool, { userId: "operator" }, setup.organizationId, { from: "2026-01-01T01:00:00+01:00", to }), { code: "invalid_usage_window" });
		const reconciliation = await db.query("SELECT c.quantity::text AS total, (SELECT sum(quantity)::text FROM payloadbay.usage_fact f WHERE f.organization_id=c.organization_id AND f.metric=c.metric) AS facts, (SELECT sum(quantity)::text FROM payloadbay.usage_hour h WHERE h.organization_id=c.organization_id AND h.metric=c.metric) AS hours FROM payloadbay.usage_counter c");
		assert.deepEqual(reconciliation.rows, [{ total: "1", facts: "1", hours: "1" }]);
	});
});

test("FT07e removing event history cannot cascade into retained usage facts or totals", async () => {
	await authFixture(async ({ pool, db }) => {
		const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
		const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
		const { recordEndpointUsage, readOrganizationUsage, recordUsage } = await import("../../packages/domain/src/usage.ts");
		await identity(db, "fixture-owner");
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, rolePermissions.owner]);
		const eventId = await seedEvent(db, scope);
		await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3)", [eventId, scope.endpoint, scope.publication]);
		await transaction(pool, (client) => recordEndpointUsage(client, scope.endpoint, "ingress.recorded", eventId));
		const window = { from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 60000).toISOString() };
		const before = await readOrganizationUsage(pool, { userId: "fixture-owner" }, scope.organization, window);
		// Owner-only fixture maintenance removes the entire source graph. No runtime role receives TRUNCATE.
		await db.query("TRUNCATE payloadbay.event CASCADE");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 0);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 0);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.usage_fact")).rows[0].n, 1);
		assert.deepEqual(await readOrganizationUsage(pool, { userId: "fixture-owner" }, scope.organization, window), before);
		assert.equal(
			await transaction(pool, (client) =>
				recordUsage(client, {
					organizationId: scope.organization,
					workspaceId: scope.workspace,
					projectId: scope.project,
					metric: "ingress.recorded",
					sourceKey: eventId,
				}),
			),
			false,
		);
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.usage_counter WHERE metric='ingress.recorded'")).rows[0].quantity, "1");
	});
});
