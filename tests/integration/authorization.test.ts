import { test } from "node:test";
import assert from "node:assert/strict";
import { authFixture } from "../helpers/auth-fixtures.ts";
import { seedScope, seedEvent } from "../helpers/domain-fixtures.ts";
import * as policy from "../../packages/domain/src/membership.ts";

test("U51 admission grants no resource access", async () => {
	assert.equal(typeof policy.actorPermissions, "function", "actorPermissions must exist");
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		assert.deepEqual([...(await policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "project", id: scope.project }))], []);
	});
});

test("U52 instance grants apply to child resources", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['payload.read'])", [scope.installation]);
		assert.deepEqual([...(await policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "project", id: scope.project }))], ["payload.read"]);
	});
});

test("U53 workspace grants exclude other workspaces", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const other = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Other','other','fixture-owner') RETURNING id", [scope.installation, scope.organization])).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','workspace',$1,'custom',ARRAY['payload.read'])", [scope.workspace]);
		assert.deepEqual([...(await policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "project", id: scope.project }))], ["payload.read"]);
		assert.deepEqual([...(await policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "workspace", id: other }))], []);
	});
});

test("U58 tokens intersect current user and stored token rights", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['payload.read','metadata.read'])", [scope.project]);
		const token = (await db.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,name,permissions,hash,expires_at) VALUES('fixture-owner','project',$1,'test',ARRAY['payload.read'],'unique',clock_timestamp()+interval '1 hour') RETURNING id", [scope.project])).rows[0].id;
		const actor = { userId: "fixture-owner", token: { id: token, scope: { type: "instance" as const, id: scope.installation }, permissions: ["payload.read", "metadata.read"] as const } };
		assert.deepEqual([...(await policy.actorPermissions(db, actor, { type: "project", id: scope.project }))], ["payload.read"], "stored token rights must cap the actor");
		await db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY['metadata.read'] WHERE user_id='fixture-owner'");
		assert.deepEqual([...(await policy.actorPermissions(db, actor, { type: "project", id: scope.project }))], []);
		await assert.rejects(policy.actorPermissions(db, actor, { type: "workspace", id: scope.workspace }), { code: "unauthenticated" });
	});
});

test("U59 revoked token immediately loses access", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const token = (await db.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,name,permissions,hash,expires_at,revoked_at) VALUES('fixture-owner','project',$1,'test',ARRAY['payload.read'],'unique',clock_timestamp()+interval '1 hour',clock_timestamp()) RETURNING id", [scope.project])).rows[0].id;
		await assert.rejects(policy.actorPermissions(db, { userId: "fixture-owner", token: { id: token, scope: { type: "project", id: scope.project }, permissions: ["payload.read"] } }, { type: "project", id: scope.project }), { code: "unauthenticated" });
	});
});

test("U57 concurrent owner demotions cannot orphan scope", async () => {
	assert.equal(typeof policy.setGrant, "function", "setGrant must exist");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'second-owner')", [scope.installation]);
		for (const user of ["fixture-owner", "second-owner"]) await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'project',$2,'owner',$3)", [user, scope.project, permissions]);
		const results = await Promise.allSettled(
			["fixture-owner", "second-owner"].map((userId) =>
				policy.setGrant(
					pool,
					{ userId },
					{
						scope: { type: "project", id: scope.project },
						userId,
						role: "viewer",
						permissions: ["metadata.read"],
						expectedVersion: 1,
					},
				),
			),
		);
		assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
		const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
		assert.equal(failed.reason.code, "last_owner");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE role_preset='owner'")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.audit WHERE operation='membership.changed'")).rows[0].n, 1);
		const owner = (await db.query("SELECT owner_user_id FROM payloadbay.project WHERE id=$1", [scope.project])).rows[0].owner_user_id;
		assert.equal((await db.query("SELECT role_preset FROM payloadbay.grant_record WHERE user_id=$1", [owner])).rows[0].role_preset, "owner");
	});
});

test("U231 inactive admission rejects inherited grants", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("UPDATE payloadbay.admission SET active=false");
		await assert.rejects(policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "project", id: scope.project }), { code: "unauthenticated" });
	});
});

test("U232 membership rejects escalation and stale writes", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'target')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['members.manage','metadata.read'])", [scope.project]);
		const base = {
			scope: { type: "project" as const, id: scope.project },
			userId: "target",
			role: "custom" as const,
			expectedVersion: null,
		};
		await assert.rejects(policy.setGrant(pool, { userId: "fixture-owner" }, { ...base, permissions: ["code.publish"] }), { code: "grant_escalation" });
		const first = await policy.setGrant(pool, { userId: "fixture-owner" }, { ...base, permissions: ["metadata.read"] });
		assert.equal(first.version, 1);
		await assert.rejects(policy.setGrant(pool, { userId: "fixture-owner" }, { ...base, permissions: ["metadata.read"] }), { code: "version_conflict" });
	});
});

test("U233 token creation stores only hash and revocation is immediate", async () => {
	const tokens = await import("../../packages/domain/src/tokens.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['tokens.manage','payload.read'])", [scope.project]);
		const target = { type: "project" as const, id: scope.project };
		const actor = { userId: "fixture-owner" };
		const token = await tokens.createToken(pool, actor, {
			scope: target,
			name: "test",
			permissions: ["payload.read"],
			expiresAt: new Date(Date.now() + 60000),
		});
		const stored = (await db.query("SELECT * FROM payloadbay.api_token")).rows[0];
		assert.equal(JSON.stringify(stored).includes(token.secret), false);
		assert.match(stored.hash, /^[0-9a-f]{64}$/);
		const principal = await tokens.authenticateToken(pool, token.secret);
		assert.equal(principal?.userId, actor.userId);
		assert.deepEqual([...(await policy.actorPermissions(db, principal!, target))], ["payload.read"]);
		assert.equal((await tokens.listTokens(pool, actor, target))[0].hash, undefined);
		await tokens.revokeToken(pool, actor, target, token.id);
		assert.equal(await tokens.authenticateToken(pool, token.secret), null);
		assert.equal(await tokens.authenticateToken(pool, "pb_invalid"), null);
	});
});

test("U236 resource creation scopes owner and preserves unique slugs", async () => {
	const resource = await import("../../packages/domain/src/resources.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const input = {
			type: "workspace" as const,
			parentId: scope.organization,
			name: "New Workspace",
			slug: "new",
		};
		const workspace = await resource.createResource(pool, actor, input);
		await assert.rejects(resource.createResource(pool, actor, input), { code: "slug_conflict" });
		const project = await resource.createResource(pool, actor, {
			type: "project",
			parentId: workspace.id,
			name: "New Project",
			slug: "new",
		});
		assert.equal((await db.query("SELECT owner_user_id FROM payloadbay.project WHERE id=$1", [project.id])).rows[0].owner_user_id, actor.userId);
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'project-viewer')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('project-viewer','project',$1,'viewer',ARRAY['metadata.read'])", [project.id]);
		const projects = await resource.listResources(pool, { userId: "project-viewer" }, "project");
		assert.deepEqual(
			projects.map((p) => p.id),
			[project.id],
		);
		await assert.rejects(
			resource.createResource(
				pool,
				{ userId: "project-viewer" },
				{
					type: "project",
					parentId: workspace.id,
					name: "Illegal",
					slug: "illegal",
				},
			),
			{ code: "forbidden" },
		);
	});
});

test("U237 inaccessible projects do not consume listing limit", async () => {
	const { listResources } = await import("../../packages/domain/src/resources.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'viewer')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) SELECT $1,'A hidden '||n,'hidden-'||n,'fixture-owner' FROM generate_series(1,201) AS n", [scope.workspace]);
		const visible = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Z visible','visible','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('viewer','project',$1,'viewer',ARRAY['metadata.read'])", [visible]);
		assert.deepEqual(
			(await listResources(pool, { userId: "viewer" }, "project")).map((p) => p.id),
			[visible],
			"accessible projects must not be forced off the page",
		);
	});
});

test("U159 project job rights cannot expose installation job administration", async () => {
	const overview = await import("../../packages/domain/src/overview.ts");
	assert.equal(typeof overview.readJobAdministration, "function", "Installation job administration must expose an authorized metadata service");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['jobs.read'])", [scope.project]);
		await assert.rejects(overview.readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation), { code: "forbidden", status: 403 });
		await db.query("UPDATE payloadbay.grant_record SET scope_type='instance',scope_id=$1", [scope.installation]);
		await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,last_error) VALUES('email',$1,'admin-inspection','private raw upstream response')", [Buffer.from("synthetic-private-otp")]);
		const result = await overview.readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation);
		assert.equal(result.items.length, 1);
		assert.equal(result.items[0].kind, "email");
		assert.equal(result.items[0].state, "queued");
		assert.equal(JSON.stringify(result).includes("synthetic-private-otp"), false);
		assert.equal(JSON.stringify(result).includes("private raw upstream response"), false);
		assert.deepEqual(Object.keys(result.items[0]).sort(), ["attemptNumber", "createdAt", "dueAt", "id", "kind", "maxAttempts", "state"].sort());
	});
});

test("U160 job inspection measures due backlog by priority independently from acknowledgment", async () => {
	const { readJobAdministration } = await import("../../packages/domain/src/overview.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['jobs.read'])", [scope.installation]);
		await db.query("UPDATE payloadbay.endpoint SET priority=-10 WHERE id=$1", [scope.endpoint]);
		const eventId = await seedEvent(db, scope);
		await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,created_at,due_at) VALUES($1,$2,$3,clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '2 minutes'),($1,$2,$3,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour')", [eventId, scope.endpoint, scope.publication]);
		const result = await readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation);
		assert.equal(result.backlog.length, 1);
		const lane = result.backlog[0];
		assert.equal(lane.priority, -10);
		assert.equal(lane.dueCount, 1, "Future scheduled work is not due backlog");
		assert.ok(lane.oldestQueuedSeconds >= 600 && lane.oldestQueuedSeconds < 620);
		assert.ok(lane.oldestDueSeconds >= 120 && lane.oldestDueSeconds < 140);
		assert.equal(result.acknowledgmentLatency, null, "Do not substitute queue age for unmeasured acknowledgment latency");
		await db.query("UPDATE payloadbay.endpoint SET paused=true WHERE id=$1", [scope.endpoint]);
		const paused = await readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation);
		assert.deepEqual(paused.backlog, [], "Intentionally paused routes are not a dispatch backlog");
	});
});
