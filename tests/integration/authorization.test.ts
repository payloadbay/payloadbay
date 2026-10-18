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

test("U52 instance grants stop before customer resources", async () => {
	await authFixture(async ({ db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['payload.read'])", [scope.installation]);
		assert.deepEqual([...(await policy.actorPermissions(db, { userId: "fixture-owner" }, { type: "project", id: scope.project }))], []);
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
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
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

test("K03 organization keys enforce a persisted selected-workspace boundary", async () => {
	const { createToken, authenticateToken } = await import("../../packages/domain/src/tokens.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'custom',ARRAY['tokens.manage','metadata.read'])", [scope.organization]);
		const hidden = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Hidden','hidden','fixture-owner') RETURNING id", [scope.installation, scope.organization])).rows[0].id;
		const input = {
			scope: { type: "organization" as const, id: scope.organization },
			name: "Selected workspace",
			permissions: ["metadata.read"] as const,
			expiresAt: new Date(Date.now() + 3600000),
		};
		await assert.rejects(createToken(pool, { userId: "fixture-owner" }, { ...input, workspaceIds: [] }), { code: "invalid_input" });
		await assert.rejects(createToken(pool, { userId: "fixture-owner" }, { ...input, workspaceIds: [crypto.randomUUID()] }), { code: "invalid_input" });
		await assert.rejects(createToken(pool, { userId: "fixture-owner" }, { ...input, permissions: ["secrets.use"], workspaceIds: [scope.workspace] }), { code: "grant_escalation" });
		const credential = await createToken(pool, { userId: "fixture-owner" }, { ...input, workspaceIds: [scope.workspace] });
		const actor = await authenticateToken(pool, credential.secret);
		assert.ok(actor);
		assert.deepEqual([...(await policy.actorPermissions(pool, actor, { type: "workspace", id: scope.workspace }))], ["metadata.read"]);
		assert.deepEqual([...(await policy.actorPermissions(pool, actor, { type: "workspace", id: hidden }))], [], "An organization key restricted to one workspace must not read its sibling");
		assert.deepEqual([...(await policy.actorPermissions(pool, actor, { type: "organization", id: scope.organization }))], [], "Restricted keys cannot read all-organization aggregates");
		const unrestricted = await createToken(pool, { userId: "fixture-owner" }, { ...input, name: "Organization-wide" });
		const unrestrictedActor = await authenticateToken(pool, unrestricted.secret);
		assert.ok(unrestrictedActor);
		assert.deepEqual([...(await policy.actorPermissions(pool, unrestrictedActor, { type: "organization", id: scope.organization }))], ["metadata.read"]);
		const multiple = await createToken(pool, { userId: "fixture-owner" }, { ...input, name: "Two workspaces", workspaceIds: [scope.workspace, hidden] });
		const multipleActor = await authenticateToken(pool, multiple.secret);
		assert.ok(multipleActor);
		assert.deepEqual([...(await policy.actorPermissions(pool, multipleActor, { type: "workspace", id: hidden }))], ["metadata.read"]);
		const foreignOrganization = (await db.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,'Foreign','foreign','fixture-owner') RETURNING id", [scope.installation])).rows[0].id;
		const foreignWorkspace = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Foreign','foreign','fixture-owner') RETURNING id", [scope.installation, foreignOrganization])).rows[0].id;
		await assert.rejects(createToken(pool, { userId: "fixture-owner" }, { ...input, workspaceIds: [foreignWorkspace] }), { code: "invalid_input" });
		const delegating = await createToken(pool, { userId: "fixture-owner" }, { ...input, permissions: ["metadata.read", "tokens.manage"], workspaceIds: [scope.workspace] });
		const restrictedActor = await authenticateToken(pool, delegating.secret);
		assert.ok(restrictedActor);
		await assert.rejects(createToken(pool, restrictedActor, { ...input, name: "Cannot broaden" }), { code: "forbidden" });
		await db.query("UPDATE payloadbay.api_token SET workspace_ids=ARRAY[$1]::uuid[] WHERE id=$2", [hidden, credential.id]);
		assert.deepEqual([...(await policy.actorPermissions(pool, actor, { type: "workspace", id: scope.workspace }))], [], "Re-read stored scope instead of trusting an old in-memory actor");
	});
});

test("K03 workspace restrictions apply before collection limits", async () => {
	const { createToken, authenticateToken } = await import("../../packages/domain/src/tokens.ts");
	const { listResources } = await import("../../packages/domain/src/resources.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'custom',ARRAY['tokens.manage','metadata.read'])", [scope.organization]);
		const hidden = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Hidden','hidden','fixture-owner') RETURNING id", [scope.installation, scope.organization])).rows[0].id;
		await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) SELECT $1,'AAA '||n,'hidden-'||n,'fixture-owner' FROM generate_series(1,205) n", [hidden]);
		const credential = await createToken(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "organization", id: scope.organization },
				name: "Restricted collection",
				permissions: ["metadata.read"],
				expiresAt: new Date(Date.now() + 3600000),
				workspaceIds: [scope.workspace],
			},
		);
		const actor = await authenticateToken(pool, credential.secret);
		assert.ok(actor);
		assert.deepEqual(
			(await listResources(pool, actor, "project")).map((item) => item.id),
			[scope.project],
			"Excluded workspaces must not consume the authorized listing limit",
		);
	});
});

test("U159 active platform jobs remain visible beyond completed history", async () => {
	const { readJobAdministration } = await import("../../packages/domain/src/overview.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['jobs.read'])", [scope.installation]);
		await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,state,due_at) SELECT 'email',''::bytea,'completed-history-'||n,'succeeded',clock_timestamp()-interval '1 day' FROM generate_series(1,100) n");
		const queued = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('email',''::bytea,'new-active-job') RETURNING id")).rows[0];
		const result = await readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation);
		assert.equal(result.items.length, 100);
		assert.equal(result.items[0].id, queued.id, "Active work must not be hidden behind completed history");
	});
});

test("AD02 audit history preserves microsecond pagination and scope boundaries", async () => {
	const { listAudit } = await import("../../packages/domain/src/audit.ts");
	await authFixture(async ({ db, pool }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['audit.read'])", [scope.project]);
		await assert.rejects(listAudit(pool, { userId: "fixture-owner" }, scope.installation, {}), { code: "forbidden" });
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['audit.read'])", [scope.installation]);
		const expected = [];
		for (const [type, id] of [
			["instance", scope.installation],
			["organization", scope.organization],
			["workspace", scope.workspace],
			["project", scope.project],
			["endpoint", scope.endpoint],
		]) {
			const auditId = (await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,redacted_diff,created_at) VALUES('fixture-owner',$1,$2,'fixture.audit',$3,'2026-10-17T01:02:03.123456Z') RETURNING id", [type, id, JSON.stringify({ private: "never return this diff" })])).rows[0].id;
			if (type === "instance") expected.push(auditId);
		}

		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation) VALUES('other','instance',gen_random_uuid(),'fixture.other')");
		const actual = [];
		let cursor: string | undefined;
		do {
			const page = await listAudit(pool, { userId: "fixture-owner" }, scope.installation, { limit: 1, cursor });
			assert.equal(page.items.length, 1);
			assert.equal(page.items[0].createdAt, "2026-10-17T01:02:03.123456Z");
			assert.equal(JSON.stringify(page).includes("never return this diff"), false);
			actual.push(page.items[0].id);
			cursor = page.nextCursor ?? undefined;
		} while (cursor);

		assert.deepEqual(actual, expected.sort().reverse());
		await db.query("UPDATE payloadbay.grant_record SET permissions='{}' WHERE scope_type='instance'");
		await assert.rejects(listAudit(pool, { userId: "fixture-owner" }, scope.installation, {}), { code: "forbidden" });
	});
});

test("HT01 hosted platform grants do not grant customer access or self-membership", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete',deployment_mode='hosted'");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		assert.equal((await policy.actorPermissions(db, actor, { type: "instance", id: scope.installation })).has("members.manage"), true);
		for (const resource of [
			{ type: "organization" as const, id: scope.organization },
			{ type: "workspace" as const, id: scope.workspace },
			{ type: "project" as const, id: scope.project },
		]) {
			assert.deepEqual([...(await policy.actorPermissions(db, actor, resource))], []);
			await assert.rejects(policy.requirePermission(db, actor, resource, "payload.read"), { code: "forbidden" });
		}

		await assert.rejects(
			policy.setGrant(pool, actor, {
				scope: { type: "project", id: scope.project },
				userId: actor.userId,
				role: "owner",
				permissions,
				expectedVersion: null,
			}),
			{ code: "forbidden" },
		);
		const { listResources } = await import("../../packages/domain/src/resources.ts");
		for (const type of ["organization", "workspace", "project"] as const) assert.deepEqual(await listResources(pool, actor, type), []);
		const token = (await db.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,name,permissions,hash,expires_at) VALUES('fixture-owner','instance',$1,'platform',ARRAY['payload.read'],'hosted-platform-token',clock_timestamp()+interval '1 hour') RETURNING id", [scope.installation])).rows[0].id;
		await assert.rejects(policy.actorPermissions(db, { ...actor, token: { id: token, scope: { type: "instance", id: scope.installation }, permissions: ["payload.read"] } }, { type: "project", id: scope.project }), { code: "unauthenticated" });
	});
});

test("HT02 hosted platform audit excludes customer activity", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete',deployment_mode='hosted'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['audit.read'])", [scope.installation]);
		await db.query("INSERT INTO payloadbay.audit(actor,operation,scope_type,scope_id) VALUES('fixture-owner','platform.review','instance',$1),('fixture-owner','customer.review','project',$2)", [scope.installation, scope.project]);
		const { listAudit } = await import("../../packages/domain/src/audit.ts");
		const audit = await listAudit(pool, { userId: "fixture-owner" }, scope.installation, {});
		assert.deepEqual(
			audit.items.map((item) => item.operation),
			["platform.review"],
		);
	});
});

test("HT03 hosted staff gain only customer-invited rights after acceptance", async () => {
	const { identity, fixtureConfig, setupSecret } = await import("../helpers/auth-fixtures.ts");
	const { bootstrapOwner } = await import("../../packages/domain/src/bootstrap.ts");
	const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	const { createInvitation, acceptInvitation } = await import("../../packages/domain/src/invitations.ts");
	const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	await authFixture(async (f) => {
		await identity(f.db, "staff");
		await identity(f.db, "customer");
		const setup = await bootstrapOwner(f.pool, { userId: "staff", providedSecret: setupSecret, expectedSecret: setupSecret });
		await f.db.query("UPDATE payloadbay.installation SET deployment_mode='hosted'");
		await f.db.query("DELETE FROM payloadbay.grant_record WHERE user_id='staff' AND scope_type='organization'");
		await f.db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'customer')", [setup.installationId]);
		await f.db.query("UPDATE payloadbay.organization SET owner_user_id='customer' WHERE id=$1", [setup.organizationId]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('customer','organization',$1,'admin',$2)", [setup.organizationId, rolePermissions.admin]);
		const scope = { type: "organization" as const, id: setup.organizationId };
		const staff = { userId: "staff" };
		const config = fixtureConfig(f);
		const service = createAuth(f.pool, config);
		try {
			assert.deepEqual([...(await policy.actorPermissions(f.db, staff, scope))], []);
			await createInvitation(f.pool, { userId: "customer" }, { scope, email: "staff@example.test", grants: [{ scope, role: "viewer", permissions: rolePermissions.viewer }] }, service, config.encryptionKey, config.publicUrl);
			assert.deepEqual([...(await policy.actorPermissions(f.db, staff, scope))], []);
			const job = (await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE kind='invitation_mail'")).rows[0];
			const mail = decryptPrivate<{ url: string }>(job.encrypted_payload, config.encryptionKey);
			await acceptInvitation(f.pool, staff, new URL(mail.url).pathname.split("/").at(-1)!);
			assert.deepEqual([...(await policy.actorPermissions(f.db, staff, scope))].sort(), [...rolePermissions.viewer].sort());
			await assert.rejects(policy.requirePermission(f.db, staff, scope, "payload.read"), { code: "forbidden" });
			await f.db.query("DELETE FROM payloadbay.grant_record WHERE user_id='staff' AND scope_type='organization'");
			assert.deepEqual([...(await policy.actorPermissions(f.db, staff, scope))], []);
		} finally {
			await service.close();
		}
	});
});

test("CF01 self-hosted platform grants do not grant departmental access or self-membership", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete',deployment_mode='self_hosted'");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		assert.equal((await policy.actorPermissions(db, actor, { type: "instance", id: scope.installation })).has("members.manage"), true);
		for (const resource of [
			{ type: "organization" as const, id: scope.organization },
			{ type: "workspace" as const, id: scope.workspace },
			{ type: "project" as const, id: scope.project },
		]) {
			assert.deepEqual([...(await policy.actorPermissions(db, actor, resource))], []);
			await assert.rejects(policy.requirePermission(db, actor, resource, "payload.read"), { code: "forbidden" });
		}

		await assert.rejects(
			policy.setGrant(pool, actor, {
				scope: { type: "project", id: scope.project },
				userId: actor.userId,
				role: "owner",
				permissions,
				expectedVersion: null,
			}),
			{ code: "forbidden" },
		);
		const { listResources } = await import("../../packages/domain/src/resources.ts");
		for (const type of ["organization", "workspace", "project"] as const) assert.deepEqual(await listResources(pool, actor, type), []);
		const token = (await db.query("INSERT INTO payloadbay.api_token(user_id,scope_type,scope_id,name,permissions,hash,expires_at) VALUES('fixture-owner','instance',$1,'platform',ARRAY['payload.read'],'hosted-platform-token',clock_timestamp()+interval '1 hour') RETURNING id", [scope.installation])).rows[0].id;
		await assert.rejects(policy.actorPermissions(db, { ...actor, token: { id: token, scope: { type: "instance", id: scope.installation }, permissions: ["payload.read"] } }, { type: "project", id: scope.project }), { code: "unauthenticated" });
	});
});

test("CF02 self-hosted platform audit excludes departmental activity", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete',deployment_mode='self_hosted'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['audit.read'])", [scope.installation]);
		await db.query("INSERT INTO payloadbay.audit(actor,operation,scope_type,scope_id) VALUES('fixture-owner','platform.review','instance',$1),('fixture-owner','customer.review','project',$2)", [scope.installation, scope.project]);
		const { listAudit } = await import("../../packages/domain/src/audit.ts");
		const audit = await listAudit(pool, { userId: "fixture-owner" }, scope.installation, {});
		assert.deepEqual(
			audit.items.map((item) => item.operation),
			["platform.review"],
		);
	});
});

test("CF05 scoped audit excludes parents siblings private diffs and revoked access", async () => {
	const { listAudit } = await import("../../packages/domain/src/audit.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','workspace',$1,'custom',ARRAY['audit.read'])", [scope.workspace]);
		const sibling = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Private department','private','fixture-owner') RETURNING id", [scope.installation, scope.organization])).rows[0].id;
		for (const [type, id] of [
			["instance", scope.installation],
			["organization", scope.organization],
			["workspace", scope.workspace],
			["workspace", sibling],
			["project", scope.project],
			["endpoint", scope.endpoint],
		])
			await db.query("INSERT INTO payloadbay.audit(actor,operation,scope_type,scope_id,redacted_diff) VALUES('customer','review',$1,$2,jsonb_build_object('secret','never return'))", [type, id]);
		const result = await listAudit(pool, { userId: "fixture-owner" }, { type: "workspace", id: scope.workspace }, {});
		assert.deepEqual(new Set(result.items.map((item) => item.scope.type)), new Set(["workspace", "project", "endpoint"]));
		assert.equal(JSON.stringify(result).includes("never return"), false);
		await assert.rejects(listAudit(pool, { userId: "fixture-owner" }, { type: "workspace", id: sibling }, {}), { code: "forbidden" });
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner'");
		await assert.rejects(listAudit(pool, { userId: "fixture-owner" }, { type: "workspace", id: scope.workspace }, {}), { code: "forbidden" });
	});
});

test("CF06 instance invitation lists do not disclose departmental invitations", async () => {
	const { listInvitations } = await import("../../packages/domain/src/invitations.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['members.manage'])", [scope.installation]);
		for (const [type, id, email] of [
			["instance", scope.installation, "platform@example.test"],
			["project", scope.project, "department@example.test"],
		])
			await db.query("INSERT INTO payloadbay.invitation(installation_id,scope_type,scope_id,email,token_digest,grants,created_by) VALUES($1,$2,$3,$4,$4,'[]','customer')", [scope.installation, type, id, email]);
		const result = await listInvitations(pool, { userId: "fixture-owner" }, { type: "instance", id: scope.installation });
		assert.deepEqual(
			result.map((row) => row.email),
			["platform@example.test"],
		);
	});
});

test("CF08 instance operations expose aggregate traffic without customer content", async () => {
	const { readJobAdministration } = await import("../../packages/domain/src/overview.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['jobs.read'])", [scope.installation]);
		const eventId = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [eventId, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'private-operation','fixture','{}',1)", [execution]);
		await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,status_code,ended_at) VALUES($1,'private-operation',1,1,503,clock_timestamp())", [execution]);
		const result = await readJobAdministration(pool, { userId: "fixture-owner" }, scope.installation);
		assert.equal(result.series.length, 24);
		assert.equal(
			result.series.reduce((sum, point) => sum + point.failed, 0),
			1,
		);
		assert.equal(
			result.series.reduce((sum, point) => sum + point.succeeded, 0),
			0,
		);
		assert.equal(JSON.stringify(result).includes("private-operation"), false);
		assert.equal(JSON.stringify(result.series).includes(scope.project), false);
	});
});

test("personal keys follow current resource grants without inheriting customer access from instance roles", async () => {
	const { createPersonalToken, authenticateToken, revokePersonalToken, listPersonalTokens } = await import("../../packages/domain/src/tokens.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['metadata.read'])", [scope.installation]);
		const owner = { userId: "fixture-owner" };
		const key = await createPersonalToken(pool, owner, { name: "Account read key", permissions: ["metadata.read"], expiresAt: new Date(Date.now() + 3600000) });
		const authenticated = await authenticateToken(pool, key.secret);
		assert.ok(authenticated?.token?.personal);
		assert.deepEqual([...(await policy.actorPermissions(db, authenticated, { type: "project", id: scope.project }))], []);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read','payload.read'])", [scope.project]);
		assert.deepEqual([...(await policy.actorPermissions(db, authenticated, { type: "project", id: scope.project }))], ["metadata.read"]);
		await assert.rejects(createPersonalToken(pool, authenticated, { name: "Nested key", permissions: ["metadata.read"], expiresAt: new Date(Date.now() + 3600000) }), { status: 403 });
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner' AND scope_type='project'");
		assert.deepEqual([...(await policy.actorPermissions(db, authenticated, { type: "project", id: scope.project }))], []);
		assert.equal((await listPersonalTokens(pool, owner)).length, 1);
		await revokePersonalToken(pool, owner, key.id);
		assert.equal(await authenticateToken(pool, key.secret), null);
	});
});

test("environment secret imports are scoped, encrypted and atomic without changing process variables", async () => {
	const { importSecrets } = await import("../../packages/domain/src/secrets.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['secrets.manage','secrets.use'])", [scope.project]);
		const actor = { userId: "fixture-owner" };
		const target = { type: "project" as const, id: scope.project };
		const key = "fixture-encryption-key-32-characters";
		const before = process.env.PAB_IMPORT_SENTINEL;
		const imported = await importSecrets(pool, actor, { scope: target, source: '# Synthetic values only\nPAB_IMPORT_SENTINEL="synthetic value"\nOTHER_KEY=fixture-value\n' }, key);
		assert.equal(imported.length, 2);
		assert.equal(process.env.PAB_IMPORT_SENTINEL, before);
		assert.equal(JSON.stringify(imported).includes("fixture-value"), false);
		await assert.rejects(importSecrets(pool, actor, { scope: { type: "workspace", id: scope.workspace }, source: "KEY=value" }, key), { status: 403 });
		await assert.rejects(importSecrets(pool, actor, { scope: target, source: "NEW_KEY=value\nLONG_VALUE=" + "x".repeat(8193) }, key), { status: 400 });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.secret_version")).rows[0].n, 2);
		await db.query("CREATE FUNCTION payloadbay.reject_synthetic_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='Z_FAIL' THEN RAISE EXCEPTION 'Synthetic import failure'; END IF; RETURN NEW; END $$");
		await db.query("CREATE TRIGGER synthetic_import_failure BEFORE INSERT ON payloadbay.secret_version FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_synthetic_import()");
		await assert.rejects(importSecrets(pool, actor, { scope: target, source: "A_OK=value\nZ_FAIL=value" }, key));
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.secret_version")).rows[0].n, 2);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.audit WHERE operation='secret.version_created'")).rows[0].n, 2);
	});
});

test("audit labels resolve authorized resources without following foreign resource identifiers", async () => {
	const { listAudit } = await import("../../packages/domain/src/audit.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,clock_timestamp(),clock_timestamp()) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name', ["fixture-owner", "Audit actor", "audit-actor@example.test"]);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['audit.read'])", [scope.project]);
		const foreignProject = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Private other project','other-project','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		const foreignEndpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Private other route','other-route',gen_random_uuid()::text) RETURNING id", [foreignProject])).rows[0].id;
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES('fixture-owner','project',$1,'fixture.named',$2),('fixture-owner','project',$1,'fixture.foreign-reference',$3)", [scope.project, scope.endpoint, foreignEndpoint]);
		const page = await listAudit(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, {});
		assert.equal(page.items.find((item) => item.operation === "fixture.named")?.resourceName, "Fixture");
		assert.equal(page.items.find((item) => item.operation === "fixture.named")?.scopeName, "Fixture");
		assert.equal(page.items.find((item) => item.operation === "fixture.named")?.actorName, "Audit actor");
		assert.equal(page.items.find((item) => item.operation === "fixture.foreign-reference")?.resourceName, null);
		assert.equal(JSON.stringify(page).includes("Private other"), false);
	});
});
