import test from "node:test";
import assert from "node:assert/strict";
import { authFixture } from "../helpers/auth-fixtures.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { permissions } from "../../packages/contracts/src/permissions.ts";

async function publicationFixture(run: (f: Parameters<Parameters<typeof authFixture>[0]>[0] & { scope: Awaited<ReturnType<typeof seedScope>> }) => Promise<void>) {
	await authFixture(async (f) => {
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await f.db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [scope.endpoint, 'return {kind:"respondOnly",response:{status:200,body:"version-one"}};', 'return {kind:"complete"};']);
		await run({ ...f, scope });
	});
}

test("U65 stale draft version cannot overwrite saved code", async () => {
	const { saveDraft } = await import("../../packages/domain/src/publication.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const input = {
			endpointId: scope.endpoint,
			stage: "ingress" as const,
			body: 'return {kind:"reject",response:{status:403,body:"denied"}};',
			expectedVersion: 1,
		};
		const saved = await saveDraft(pool, { userId: "fixture-owner" }, input);
		assert.equal(saved.version, 2);
		await assert.rejects(saveDraft(pool, { userId: "fixture-owner" }, { ...input, body: "overwrite" }), { code: "version_conflict" });
		assert.equal((await db.query("SELECT body FROM payloadbay.draft WHERE stage='ingress'")).rows[0].body, input.body);
	});
});

test("U66 compile failure preserves active code and revision history", async () => {
	const module = await import("../../packages/domain/src/publication.ts");
	assert.equal(typeof module.publish, "function", "publish must exist");
	const { compile, CompilationError } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		await db.query("UPDATE payloadbay.draft SET body='return ctx.respondOnly({status:200,body:;' WHERE stage='ingress'");
		const before = (await db.query("SELECT count(*)::int AS n FROM payloadbay.stage_revision")).rows[0].n;
		await assert.rejects(
			module.publish(
				pool,
				{ userId: "fixture-owner" },
				{
					endpointId: scope.endpoint,
					expectedVersion: 1,
					draftVersions: { ingress: 1, processing: 1 },
					compile,
				},
			),
			CompilationError,
		);
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint")).rows[0].active_publication_id, scope.publication);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.stage_revision")).rows[0].n, before);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.publication")).rows[0].n, 1);
	});
});

test("U67 publication activates both pinned stages atomically", async () => {
	const { publish } = await import("../../packages/domain/src/publication.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const result = await publish(
			pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile,
			},
		);
		assert.equal(result.version, 2);
		const row = (await db.query("SELECT p.*,i.stage AS ingress_stage,s.stage AS processing_stage FROM payloadbay.publication p JOIN payloadbay.stage_revision i ON i.id=p.ingress_revision_id JOIN payloadbay.stage_revision s ON s.id=p.processing_revision_id WHERE p.id=$1", [result.id])).rows[0];
		assert.equal(row.ingress_stage, "ingress");
		assert.equal(row.processing_stage, "processing");
		assert.equal(row.shared_versions.ingress.sdkVersion, "1");
		assert.equal(row.shared_versions.processing.compatibilityDate, "2026-07-01");
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].active_publication_id, result.id);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.publication")).rows[0].n, 2);
	});
});

test("U68 draft edit does not change pinned published code", async () => {
	const { publish, saveDraft } = await import("../../packages/domain/src/publication.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const published = await publish(
			pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile,
			},
		);
		await saveDraft(
			pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				stage: "ingress",
				body: 'return {kind:"respondOnly",response:{status:200,body:"version-two"}};',
				expectedVersion: 1,
			},
		);
		const row = (await db.query("SELECT r.bundle FROM payloadbay.publication p JOIN payloadbay.stage_revision r ON r.id=p.ingress_revision_id WHERE p.id=$1", [published.id])).rows[0];
		const result = await execute({ stage: "ingress", bundle: row.bundle, input: {} });
		assert.deepEqual(result.decision, { kind: "respondOnly", response: { status: 200, body: "version-one" } });
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint")).rows[0].active_publication_id, published.id);
	});
});

test("U69 rollback activates recorded code without changing history", async () => {
	const module = await import("../../packages/domain/src/publication.ts");
	assert.equal(typeof module.activatePublication, "function", "activatePublication must exist");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const first = await module.publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 1,
			draftVersions: { ingress: 1, processing: 1 },
			compile,
		});
		const before = (await db.query("SELECT row_to_json(p) AS snapshot FROM payloadbay.publication p WHERE id=$1", [first.id])).rows[0].snapshot;
		await module.saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: 'return {kind:"reject",response:{status:403,body:"version-two"}};',
			expectedVersion: 1,
		});
		const second = await module.publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 2,
			draftVersions: { ingress: 2, processing: 1 },
			compile,
		});
		assert.notEqual(second.id, first.id);
		const result = await module.activatePublication(pool, actor, { endpointId: scope.endpoint, publicationId: first.id, expectedVersion: 3 });
		assert.deepEqual(result, { id: first.id, version: 4 });
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint")).rows[0].active_publication_id, first.id);
		assert.deepEqual((await db.query("SELECT row_to_json(p) AS snapshot FROM payloadbay.publication p WHERE id=$1", [first.id])).rows[0].snapshot, before);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.publication")).rows[0].n, 3);
		await assert.rejects(module.activatePublication(pool, actor, { endpointId: scope.endpoint, publicationId: first.id, expectedVersion: 3 }), { code: "version_conflict" });
	});
});

test("U247 ingress route creation is scoped and unpublished", async () => {
	const endpoints = await import("../../packages/domain/src/endpoints.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const created = await endpoints.createEndpoint(pool, actor, { projectId: scope.project, name: "New route", slug: "new" });
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint WHERE id=$1", [created.id])).rows[0].active_publication_id, null);
		assert.match(created.ingress_key, /^[A-Za-z0-9_-]{32}$/);
		assert.match((await endpoints.getDraft(pool, actor, created.id, "ingress")).body, /reject/);
		await assert.rejects(endpoints.createEndpoint(pool, actor, { projectId: scope.project, name: "Duplicate", slug: "new" }), { code: "slug_conflict" });
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'viewer')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('viewer','project',$1,'viewer',ARRAY['metadata.read'])", [scope.project]);
		const listed = await endpoints.listEndpoints(pool, { userId: "viewer" }, scope.project);
		assert.equal(listed.length, 2);
		assert.equal(listed[0].body, undefined);
		assert.equal(listed[0].ingress_key, undefined);
		await assert.rejects(endpoints.getDraft(pool, { userId: "viewer" }, created.id, "ingress"), { code: "forbidden" });
	});
});

test("U70 secret use rights do not imply secret management", async () => {
	const { createSecret } = await import("../../packages/domain/src/secrets.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'secret-user')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('secret-user','project',$1,'custom',ARRAY['secrets.use'])", [scope.project]);
		await assert.rejects(createSecret(pool, { userId: "secret-user" }, { scope: { type: "project", id: scope.project }, name: "Signing key", value: "fixture-secret" }, "fixture-key"), { code: "forbidden" });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.secret_version")).rows[0].n, 0);
	});
});

test("U71 secret management does not grant value use", async () => {
	const { createSecret, resolveSecret } = await import("../../packages/domain/src/secrets.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'manager')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('manager','project',$1,'custom',ARRAY['secrets.manage'])", [scope.project]);
		const secret = await createSecret(pool, { userId: "manager" }, { scope: { type: "project", id: scope.project }, name: "Signing key", value: "fixture-private-value" }, "fixture-key");
		await assert.rejects(resolveSecret(pool, { userId: "manager" }, secret.id, "fixture-key"), { code: "forbidden" });
	});
});

test("U72 secret versions are encrypted and values never appear in audit", async () => {
	const { createSecret, resolveSecret } = await import("../../packages/domain/src/secrets.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const value = "fixture-private-secret-that-must-stay-encrypted";
		const actor = { userId: "fixture-owner" };
		const secret = await createSecret(pool, actor, { scope: { type: "project", id: scope.project }, name: "Signing key", value }, "fixture-key");
		assert.equal(JSON.stringify(secret).includes(value), false);
		const stored = (await db.query("SELECT encrypted_value FROM payloadbay.secret_version WHERE id=$1", [secret.id])).rows[0].encrypted_value;
		assert.equal(stored.includes(Buffer.from(value)), false, "stored secret must be encrypted");
		assert.equal(await resolveSecret(pool, actor, secret.id, "fixture-key"), value);
		const audits = (await db.query("SELECT redacted_diff FROM payloadbay.audit")).rows;
		assert.equal(JSON.stringify(audits).includes(value), false);
	});
});

test("U74 revocation prevents old binding from silently using a new version", async () => {
	const { createSecret, revokeSecret, resolvePinnedSecrets } = await import("../../packages/domain/src/secrets.ts");
	await publicationFixture(async ({ pool, scope }) => {
		const actor = { userId: "fixture-owner" };
		const input = { scope: { type: "project" as const, id: scope.project }, name: "Signing key" };
		const first = await createSecret(pool, actor, { ...input, value: "old-value" }, "fixture-key");
		const second = await createSecret(pool, actor, { ...input, value: "new-value" }, "fixture-key");
		assert.equal(second.version, 2);
		assert.equal((await resolvePinnedSecrets(pool, scope.project, { SIGNING_SECRET: first.id }, "fixture-key")).SIGNING_SECRET, "old-value");
		await revokeSecret(pool, actor, first.id);
		await assert.rejects(resolvePinnedSecrets(pool, scope.project, { SIGNING_SECRET: first.id }, "fixture-key"), { code: "secret_revoked" });
		assert.equal((await resolvePinnedSecrets(pool, scope.project, { SIGNING_SECRET: second.id }, "fixture-key")).SIGNING_SECRET, "new-value");
	});
});

test("U248 body-only edit preserves configured shared bindings", async () => {
	const { saveDraft } = await import("../../packages/domain/src/publication.ts");
	await publicationFixture(async ({ pool, scope }) => {
		const actor = { userId: "fixture-owner" };
		const bindings = { "shared/example": "00000000-0000-0000-0000-000000000001" };
		await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: "first",
			sharedBindings: bindings,
			expectedVersion: 1,
		});
		const next = await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: "second",
			expectedVersion: 2,
		});
		assert.deepEqual(next.shared_bindings, bindings, "body-only edit must preserve bindings");
		const cleared = await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: "third",
			sharedBindings: {},
			expectedVersion: 3,
		});
		assert.deepEqual(cleared.shared_bindings, {});
	});
});

test("U73 published secret bindings never enter compiler or diagnostics", async () => {
	const { createSecret } = await import("../../packages/domain/src/secrets.ts");
	const { saveDraft, publish } = await import("../../packages/domain/src/publication.ts");
	const { compile, CompilationError } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const value = "fixture-value-never-compiler-visible";
		const secret = await createSecret(pool, actor, { scope: { type: "project", id: scope.project }, name: "Signing key", value }, "fixture-key");
		const draft = await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: 'return ctx.respondOnly({status:200,body:"ok"});',
			secretBindings: { SIGNING_KEY: secret.id },
			expectedVersion: 1,
		} as Parameters<typeof saveDraft>[2]);
		assert.deepEqual(draft.secret_bindings, { SIGNING_KEY: secret.id }, "secret bindings must be saved");
		const inputs: unknown[] = [];

		const compiler = async (input: unknown) => {
			inputs.push(input);

			return compile(input);
		};

		const result = await publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 1,
			draftVersions: { ingress: 2, processing: 1 },
			compile: compiler,
		});
		const publication = (await db.query("SELECT * FROM payloadbay.publication WHERE id=$1", [result.id])).rows[0];
		assert.deepEqual(publication.shared_versions.ingress.secrets, { SIGNING_KEY: secret.id });
		assert.equal(JSON.stringify(inputs).includes(value), false);
		assert.equal(JSON.stringify(publication).includes(value), false);
		const bundle = (await db.query("SELECT bundle FROM payloadbay.stage_revision WHERE id=$1", [publication.ingress_revision_id])).rows[0].bundle;
		assert.equal(bundle.includes(value), false);
		await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: "return ctx.respondOnly({status:200,body:;",
			expectedVersion: 2,
		});
		await assert.rejects(
			publish(pool, actor, {
				endpointId: scope.endpoint,
				expectedVersion: 2,
				draftVersions: { ingress: 3, processing: 1 },
				compile: compiler,
			}),
			(error: unknown) => error instanceof CompilationError && !JSON.stringify(error.diagnostics).includes(value),
		);
	});
});

test("U259 secret selector only returns authorized metadata", async () => {
	const { createSecret, listSecrets } = await import("../../packages/domain/src/secrets.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const owner = { userId: "fixture-owner" };
		const local = await createSecret(pool, owner, { scope: { type: "project", id: scope.project }, name: "Local key", value: "fixture-private-local" }, "fixture-key");
		await createSecret(pool, owner, { scope: { type: "workspace", id: scope.workspace }, name: "Parent private key", value: "fixture-private-parent" }, "fixture-key");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'selector')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('selector','project',$1,'custom',ARRAY['secrets.use'])", [scope.project]);
		const listed = await listSecrets(pool, { userId: "selector" }, { type: "project", id: scope.project });
		assert.deepEqual(
			listed.map((row) => row.id),
			[local.id],
			"selector must expose only authorized versions",
		);
		assert.equal(listed[0].encrypted_value, undefined);
		assert.equal(listed[0].value, undefined);
		assert.equal(JSON.stringify(listed).includes("fixture-private"), false);
	});
});

test("U263 default processing template retries unsuccessful managed send", async () => {
	const { deliveryTemplate } = await import("../../packages/script-sdk/src/templates/delivery.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const compiled = await compile({ stage: "processing", body: deliveryTemplate.body });
	let sends = 0;
	const input = { event: { body: new Uint8Array([42]), contentType: "application/octet-stream" } };
	const failure = await execute({
		stage: "processing",
		bundle: compiled.bundle,
		input,
		broker: async () => {
			sends++;

			return { ok: false, status: 503, attemptId: "failed" };
		},
	});
	assert.deepEqual(failure.decision, { kind: "retry", reason: "Destination delivery did not succeed" }, "default processing must request retry on failed send");
	assert.equal(sends, 1);
	const success = await execute({
		stage: "processing",
		bundle: compiled.bundle,
		input,
		broker: async () => ({ ok: true, status: 200, attemptId: "success" }),
	});
	assert.deepEqual(success.decision, { kind: "complete" });
});

test("U267 new route processing retries failed default delivery", async () => {
	const { createEndpoint, getDraft } = await import("../../packages/domain/src/endpoints.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	await publicationFixture(async ({ pool, scope }) => {
		const route = await createEndpoint(pool, { userId: "fixture-owner" }, { projectId: scope.project, name: "Delivery route", slug: "delivery-route" });
		const draft = await getDraft(pool, { userId: "fixture-owner" }, route.id, "processing");
		const compiled = await compile({ stage: "processing", body: draft.body });
		const result = await execute({
			stage: "processing",
			bundle: compiled.bundle,
			input: { event: { body: new Uint8Array([42]), contentType: "application/octet-stream" } },
			broker: async () => ({ ok: false, status: 503, attemptId: "fixture-failure" }),
		});
		assert.deepEqual(result.decision, { kind: "retry", reason: "Destination delivery did not succeed" }, "new routes must not mark failed delivery complete");
	});
});

test("U127 shared code copy preserves origin and edits create local immutable version", async () => {
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { createSharedVersion, copySharedVersion, getSharedVersion } = await import("../../packages/domain/src/shared-code.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const original = await createSharedVersion(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "workspace", id: scope.workspace },
				name: "Messages",
				source: 'export function message(){return "parent";}',
				compile,
			},
		);
		assert.ok(original?.id, "shared module version must be created");
		const copy = await copySharedVersion(pool, { userId: "fixture-owner" }, { id: original.id, scope: { type: "project", id: scope.project }, compile });
		assert.notEqual(copy.id, original.id);
		assert.equal(copy.originRevisionId, original.id);
		assert.equal(copy.source, original.source);
		const edited = await createSharedVersion(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: copy.scope,
				name: copy.name,
				source: 'export function message(){return "local";}',
				originRevisionId: copy.id,
				compile,
			},
		);
		assert.equal(edited.originRevisionId, copy.id);
		assert.equal((await getSharedVersion(pool, { userId: "fixture-owner" }, original.id)).source, original.source);
		assert.equal((await getSharedVersion(pool, { userId: "fixture-owner" }, copy.id)).source, original.source);
		assert.notEqual(edited.source, copy.source);
		await assert.rejects(db.query("UPDATE payloadbay.shared_module_revision SET source=$2 WHERE id=$1", [copy.id, "changed"]), /immutable history/);
	});
});

test("U128 project shared code editor cannot create a parent scope revision", async () => {
	const { createSharedVersion } = await import("../../packages/domain/src/shared-code.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['code.read','code.edit'])", [scope.project]);
		let compilations = 0;

		const compiler = async (input: unknown) => {
			compilations++;

			return compile(input);
		};

		await assert.rejects(
			createSharedVersion(
				pool,
				{ userId: "fixture-owner" },
				{
					scope: { type: "workspace", id: scope.workspace },
					name: "Denied",
					source: "export const value=1;",
					compile: compiler,
				},
			),
			{ code: "forbidden" },
		);
		assert.equal(compilations, 0);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.shared_module_revision")).rows[0].count, 0);
		const local = await createSharedVersion(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Allowed",
				source: "export const value=1;",
				compile: compiler,
			},
		);
		assert.equal(local.scope.id, scope.project);
		assert.equal(compilations, 1);
	});
});

test("U76 synthetic draft test performs no external effects", async () => {
	const module = await import("../../packages/domain/src/script-testing.ts").catch(() => ({ testDraftDry: undefined }));
	assert.equal(typeof module.testDraftDry, "function", "Synthetic test service must exist");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const before = await db.query("SELECT (SELECT count(*) FROM payloadbay.event) AS events,(SELECT count(*) FROM payloadbay.execution) AS executions,(SELECT count(*) FROM payloadbay.delivery_attempt) AS attempts");
		const result = await module.testDraftDry!(
			pool,
			{ userId: "fixture-owner" },
			scope.endpoint,
			{ stage: "processing", body: 'const sent=await ctx.destinations.send({url:"http://127.0.0.1:1/unreachable"},{operationId:"fixture",body:"synthetic"});try{await fetch("http://127.0.0.1:1/unreachable");return ctx.fail({reason:"Unexpected fetch"});}catch{}ctx.log.info("fixture",{value:ctx.secrets.VALUE});return sent.ok?ctx.complete():ctx.fail({reason:"simulation failed"});', fixture: { body: "fixture", secrets: { VALUE: "synthetic-secret" } } },
			{ compile, run: execute },
		);
		assert.equal(result.mode, "dry");
		assert.equal((result.decision as { kind: string }).kind, "complete");
		assert.equal(result.simulatedManagedStatus, 204);
		assert.ok(!JSON.stringify(result.logs).includes("synthetic-secret"));
		assert.deepEqual((await db.query("SELECT (SELECT count(*) FROM payloadbay.event) AS events,(SELECT count(*) FROM payloadbay.execution) AS executions,(SELECT count(*) FROM payloadbay.delivery_attempt) AS attempts")).rows, before.rows);
		assert.equal((await db.query("SELECT redacted_diff FROM payloadbay.audit WHERE operation='code.tested'")).rows[0].redacted_diff.mode, "dry");
	});
});

test("U303 publication enforces shared dependency limits before activation", async () => {
	const { createSharedVersion } = await import("../../packages/domain/src/shared-code.ts");
	const { publish } = await import("../../packages/domain/src/publication.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const helper = await createSharedVersion(pool, actor, {
			scope: { type: "project", id: scope.project },
			name: "Helpers",
			source: "export const value=1;",
			compile,
		});
		await db.query("UPDATE payloadbay.draft SET shared_bindings=$1 WHERE endpoint_id=$2 AND stage='ingress'", [JSON.stringify(Object.fromEntries(Array.from({ length: 33 }, (_, i) => ["Helper" + i, helper.id]))), scope.endpoint]);
		await assert.rejects(
			publish(pool, actor, {
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile,
			}),
			{ code: "shared_code_limit" },
			"Publication must enforce the shared dependency cap",
		);
		assert.equal((await db.query("SELECT active_publication_id FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].active_publication_id, scope.publication);
	});
});

test("U130 queued events retain helper code after parent version changes", async () => {
	const { createSharedVersion } = await import("../../packages/domain/src/shared-code.ts");
	const { publish, saveDraft } = await import("../../packages/domain/src/publication.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const { processEventTask } = await import("../../apps/worker/src/tasks/process-event.ts");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await publicationFixture(async (f) => {
		const { pool, db, scope } = f;
		const actor = { userId: "fixture-owner" };
		const old = await createSharedVersion(pool, actor, {
			scope: { type: "workspace", id: scope.workspace },
			name: "Messages",
			source: 'export function message(){return "old helper";}',
			compile,
		});
		await db.query("UPDATE payloadbay.draft SET body='ctx.log.info(Helpers.message());return ctx.complete();',shared_bindings=$1 WHERE endpoint_id=$2 AND stage='processing'", [JSON.stringify({ Helpers: old.id }), scope.endpoint]);
		const first = await publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 1,
			draftVersions: { ingress: 1, processing: 1 },
			compile,
		});
		const event = await seedEvent(db, { endpoint: scope.endpoint, publication: first.id });
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, first.id])).rows[0].id;
		const next = await createSharedVersion(pool, actor, {
			scope: { type: "workspace", id: scope.workspace },
			name: "Messages",
			source: 'export function message(){return "new helper";}',
			originRevisionId: old.id,
			compile,
		});
		await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "processing",
			expectedVersion: 1,
			body: "ctx.log.info(Helpers.message());return ctx.complete();",
			sharedBindings: { Helpers: next.id },
		});
		const second = await publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 2,
			draftVersions: { ingress: 1, processing: 2 },
			compile,
		});
		assert.notEqual(second.id, first.id);
		const observed: string[] = [];
		await processEventTask(pool, fixtureConfig(f), async (options) => {
			const result = await execute(options);
			observed.push(...result.logs.map((log) => log.message));

			return result;
		})({ executionId: execution, endpointId: scope.endpoint, generation: 1 });
		assert.deepEqual(observed, ["old helper"], "Parent module edits must not change queued execution behavior");
		const retained = (await db.query("SELECT state,publication_id FROM payloadbay.execution WHERE id=$1", [execution])).rows[0];
		assert.equal(retained.state, "succeeded");
		assert.equal(retained.publication_id, first.id);
	});
});

test("native source imports resolve real exports and preserve immutable revision pins", async () => {
	const { createSharedVersion } = await import("../../packages/domain/src/shared-code.ts");
	const { saveDraft, publish } = await import("../../packages/domain/src/publication.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const helper = await createSharedVersion(pool, actor, {
			scope: { type: "project", id: scope.project },
			name: "Messages",
			source: 'export function message(){return "pinned";} export default function greeting(){return "hello";}',
			compile,
		});
		const source = 'import greeting, { message } from "@shared/Messages";\nexport async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:greeting()+" "+message()}); }';
		const saved = await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: source,
			expectedVersion: 1,
		});
		assert.equal(saved.shared_bindings.Messages, helper.id);
		const otherProject = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Other','other','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		const outside = await createSharedVersion(pool, actor, {
			scope: { type: "project", id: otherProject },
			name: "Outside",
			source: 'export const value = "outside";',
			compile,
		});
		await assert.rejects(
			saveDraft(pool, actor, {
				endpointId: scope.endpoint,
				stage: "ingress",
				body: source.replace("@shared/Messages", "@shared/Outside"),
				sharedBindings: { Outside: outside.id },
				expectedVersion: saved.version,
			}),
			{ code: "invalid_shared_binding" },
		);

		await createSharedVersion(pool, actor, {
			scope: { type: "project", id: scope.project },
			name: "Messages",
			source: 'export function message(){return "changed";} export default function greeting(){return "changed";}',
			compile,
		});
		const again = await saveDraft(pool, actor, {
			endpointId: scope.endpoint,
			stage: "ingress",
			body: source,
			expectedVersion: saved.version,
		});
		assert.equal(again.shared_bindings.Messages, helper.id);
		const published = await publish(pool, actor, {
			endpointId: scope.endpoint,
			expectedVersion: 1,
			draftVersions: { ingress: again.version, processing: 1 },
			compile,
		});
		const revision = (await db.query("SELECT r.bundle FROM payloadbay.publication p JOIN payloadbay.stage_revision r ON r.id=p.ingress_revision_id WHERE p.id=$1", [published.id])).rows[0];
		const result = await execute({ stage: "ingress", bundle: revision.bundle, input: { request: { method: "POST" } } });
		assert.equal((result.decision as { response: { body: string } }).response.body, "hello pinned");
		await assert.rejects(
			saveDraft(pool, actor, {
				endpointId: scope.endpoint,
				stage: "ingress",
				body: source.replace("@shared/Messages", "@shared/Missing"),
				expectedVersion: again.version,
			}),
			{ code: "invalid_shared_binding" },
		);
		await assert.rejects(
			saveDraft(pool, actor, {
				endpointId: scope.endpoint,
				stage: "ingress",
				body: source.replace("@shared/Messages", "https://example.com/script"),
				expectedVersion: again.version,
			}),
			{ code: "invalid_shared_binding" },
		);
	});
});

test("helper import picker inserts real exports above code, preserves aliases and checks scope", async () => {
	const { createSharedVersion, prepareHelperImport } = await import("../../packages/domain/src/shared-code.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const selectedScope = { type: "project" as const, id: scope.project };
		const helper = await createSharedVersion(pool, actor, {
			scope: selectedScope,
			name: "Messages",
			source: 'export const message = "hello"; export default function greeting() { return message; }',
			compile,
		});
		const prepared = await prepareHelperImport(pool, actor, {
			scope: selectedScope,
			revisionId: helper.id,
			body: 'const message = "local";\nexport async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,body:message}); }',
			exports: ["default", "message"],
		});
		assert.match(prepared.body, /^import Messages, \{ message as Messages_message \} from "@shared\/Messages";/);
		assert.ok(prepared.body.indexOf("import ") < prepared.body.indexOf("const message"));
		const again = await prepareHelperImport(pool, actor, {
			scope: selectedScope,
			revisionId: helper.id,
			body: prepared.body,
			exports: ["default", "message"],
		});
		assert.equal(again.body, prepared.body);
		await assert.rejects(
			prepareHelperImport(pool, actor, {
				scope: selectedScope,
				revisionId: helper.id,
				body: "export async function POST( {",
				exports: ["message"],
			}),
			{ code: "invalid_script" },
		);
		await assert.rejects(
			prepareHelperImport(pool, actor, {
				scope: selectedScope,
				revisionId: helper.id,
				body: prepared.body,
				exports: ["missing"],
			}),
			{ code: "invalid_import" },
		);
		const other = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Other','picker-other','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		await assert.rejects(
			prepareHelperImport(pool, actor, {
				scope: { type: "project", id: other },
				revisionId: helper.id,
				body: prepared.body,
				exports: ["message"],
			}),
			{ code: "invalid_shared_binding" },
		);
	});
});

test("middleware reorder is atomic, version checked and restricted to one scope and stage", async () => {
	const { createMiddlewareBinding, reorderMiddlewareBindings } = await import("../../packages/domain/src/middleware.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	await publicationFixture(async ({ pool, db, scope }) => {
		const actor = { userId: "fixture-owner" };
		const selectedScope = { type: "project" as const, id: scope.project };

		const create = (name: string, position: number) =>
			createMiddlewareBinding(pool, actor, {
				scope: selectedScope,
				stage: "processing",
				name,
				position,
				body: "return ctx.continue();",
				failurePolicy: "required",
				overridePolicy: "allowed",
				compile,
			});

		const first = await create("First", 0);
		const second = await create("Second", 1);
		const input = {
			scope: selectedScope,
			stage: "processing" as const,
			items: [
				{ id: second.id, version: second.version },
				{ id: first.id, version: first.version },
			],
		};
		await reorderMiddlewareBindings(pool, actor, input);
		assert.deepEqual(
			(await db.query("SELECT name FROM payloadbay.middleware_binding ORDER BY position")).rows.map((item) => item.name),
			["Second", "First"],
		);
		await assert.rejects(reorderMiddlewareBindings(pool, actor, input), { code: "version_conflict" });
		await assert.rejects(reorderMiddlewareBindings(pool, actor, { ...input, stage: "ingress" }), { code: "version_conflict" });
		assert.deepEqual(
			(await db.query("SELECT name FROM payloadbay.middleware_binding ORDER BY position")).rows.map((item) => item.name),
			["Second", "First"],
		);
	});
});
