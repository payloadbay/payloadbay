import test from "node:test";
import assert from "node:assert/strict";

test("U285 pinned middleware executes hierarchy then scope order before handler", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	const seen: string[] = [];

	const binding = (id: string, scopeType: import("../../packages/domain/src/pipeline.ts").PinnedMiddleware["scopeType"], position: number) => ({
		id,
		scopeType,
		scopeId: "scope",
		stage: "processing" as const,
		position,
		revisionId: id,
		bundle: id,
		failurePolicy: "required" as const,
		version: 1,
	});

	const original = {
		event: {
			id: "event",
			body: new Uint8Array([42]),
			originalBody: new Uint8Array([42]),
			contentType: "text/plain",
			metadata: {},
		},
		executionId: "execution",
	};
	const result = await executePipeline({
		stage: "processing",
		bundle: "handler",
		input: original,
		bindings: [binding("project", "project", 0), binding("instance-second", "instance", 2), binding("endpoint", "endpoint", 0), binding("workspace", "workspace", 0), binding("instance-first", "instance", 1)],
		run: async (options: any) => {
			seen.push(options.bundle);
			if (options.stage === "processing_middleware") {
				return {
					decision: { kind: "continue" as const, patch: { event: { metadata: { order: seen.join(",") } } } },
					logs: [],
					peakRssBytes: 1,
					durationMs: 1,
				};
			}

			assert.equal(options.input.event.metadata.order, "workspace,project,endpoint", "middleware hierarchy must precede main handler");

			return {
				decision: { kind: "complete" as const },
				logs: [],
				peakRssBytes: 1,
				durationMs: 1,
			};
		},
	});
	assert.deepEqual(seen, ["workspace", "project", "endpoint", "handler"], "middleware hierarchy must precede main handler");
	assert.equal((result.decision as { kind: string }).kind, "complete");
	assert.deepEqual(original.event.metadata, {});
});

test("U122 optional invalid middleware patch preserves last valid context", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");

	const binding = (id: string, failurePolicy: "required" | "optional", position: number) => ({
		id,
		scopeType: "project" as const,
		scopeId: "project",
		stage: "processing" as const,
		position,
		revisionId: id,
		bundle: id,
		failurePolicy,
		version: 1,
	});

	const result = await executePipeline({
		stage: "processing",
		bundle: "handler",
		input: {
			event: {
				id: "event",
				body: new Uint8Array([42]),
				originalBody: new Uint8Array([42]),
				contentType: "text/plain",
				metadata: {},
			},
		},
		bindings: [binding("valid", "required", 0), binding("invalid", "optional", 1)],
		run: async (options) => {
			if (options.bundle === "valid")
				return {
					decision: { kind: "continue", patch: { event: { metadata: { tag: "valid" } } } },
					logs: [],
					peakRssBytes: 0,
					durationMs: 0,
				};
			if (options.bundle === "invalid") {
				const event = options.input.event as { metadata: Record<string, string> };
				event.metadata.tag = "mutated";

				return {
					decision: { kind: "continue", patch: { event: { originalBody: "changed" } } },
					logs: [],
					peakRssBytes: 0,
					durationMs: 0,
				};
			}

			assert.equal((options.input.event as { metadata: Record<string, string> }).metadata.tag, "valid", "invalid optional middleware must preserve previous context");

			return {
				decision: { kind: "complete" },
				logs: [],
				peakRssBytes: 0,
				durationMs: 0,
			};
		},
	});
	assert.equal((result.decision as { kind: string }).kind, "complete");
	assert.ok(result.logs.some((log) => log.data && typeof log.data === "object" && "bindingId" in log.data && log.data.bindingId === "invalid"));
});

test("U123 required ingress middleware failure returns rejection without main handler", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	let handlers = 0;
	const result = await executePipeline({
		stage: "ingress",
		bundle: "handler",
		input: { request: { body: new Uint8Array([42]), headers: {}, contentType: "text/plain" } },
		bindings: [
			{
				id: "required",
				scopeType: "organization",
				scopeId: "organization",
				stage: "ingress",
				position: 0,
				revisionId: "revision",
				bundle: "required",
				failurePolicy: "required",
				version: 1,
			},
		],
		run: async (options) => {
			if (options.stage === "ingress_middleware") throw Error("private script failure");
			handlers++;

			return {
				decision: { kind: "accept", event: { body: "bad", contentType: "text/plain" }, response: { status: 202, body: "bad" } },
				logs: [],
				peakRssBytes: 0,
				durationMs: 0,
			};
		},
	});
	assert.equal((result.decision as { kind: string }).kind, "reject", "required ingress failure must reject");
	assert.equal(handlers, 0);
	assert.equal(JSON.stringify(result).includes("private script failure"), false);
});

test("U124 required processing middleware failure follows retry or fail configuration", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	for (const requiredAction of ["retry", "fail"] as const) {
		const result = await executePipeline({
			stage: "processing",
			bundle: "handler",
			input: {
				event: {
					id: "event",
					body: new Uint8Array([42]),
					originalBody: new Uint8Array([42]),
					contentType: "text/plain",
					metadata: {},
				},
			},
			bindings: [
				{
					id: "required",
					scopeType: "project",
					scopeId: "project",
					stage: "processing",
					position: 0,
					revisionId: "revision",
					bundle: "required",
					failurePolicy: "required",
					requiredAction,
					version: 1,
				},
			],
			run: async () => {
				throw Error("private failure");
			},
		});
		assert.equal((result.decision as { kind: string }).kind, requiredAction, "configured required processing action must apply");
	}
});

test("U121 publication pins middleware in hierarchy order and executes it before handler", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const { createMiddlewareBinding } = await import("../../packages/domain/src/middleware.ts");
	const { publish } = await import("../../packages/domain/src/publication.ts");
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
		for (const [type, id] of [
			["endpoint", scope.endpoint],
			["workspace", scope.workspace],
			["organization", scope.organization],
			["instance", scope.installation],
			["project", scope.project],
		] as const)
			await createMiddlewareBinding(
				pool,
				{ userId: "fixture-owner" },
				{
					scope: { type, id },
					stage: "processing",
					name: type,
					body: 'ctx.log.info("' + type + '");return ctx.continue();',
					position: 0,
					failurePolicy: "required",
					overridePolicy: "allowed",
					compile,
				},
			);
		await db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [scope.endpoint, 'return ctx.respondOnly({status:200,body:"challenge"});', 'ctx.log.info("handler");return ctx.complete();']);
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
		const recorded = (await db.query("SELECT p.effective_bindings,r.bundle FROM payloadbay.publication p JOIN payloadbay.stage_revision r ON r.id=p.processing_revision_id WHERE p.id=$1", [published.id])).rows[0];
		assert.equal(recorded.effective_bindings.length, 4, "publication must include middleware snapshot");
		const event = await seedEvent(db, { endpoint: scope.endpoint, publication: published.id });
		await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3)", [event, scope.endpoint, published.id]);
		const result = await executePipeline({
			stage: "processing",
			bundle: recorded.bundle,
			input: {
				event: {
					id: event,
					body: new Uint8Array([42]),
					originalBody: new Uint8Array([42]),
					contentType: "text/plain",
					metadata: {},
				},
				executionId: "execution",
				generation: 1,
				attempt: 1,
				secrets: {},
			},
			bindings: recorded.effective_bindings,
			run: execute,
		});
		assert.deepEqual(
			result.logs.map((log) => log.message),
			["organization", "workspace", "project", "endpoint", "handler"],
		);
		assert.equal((result.decision as { kind: string }).kind, "complete");
	});
});

test("U125 a non-overridable parent binding blocks child replacement", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { createMiddlewareBinding } = await import("../../packages/domain/src/middleware.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
		const parent = await createMiddlewareBinding(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "organization", id: scope.organization },
				stage: "processing",
				name: "Required policy",
				body: "return ctx.continue();",
				position: 0,
				failurePolicy: "required",
				overridePolicy: "forbidden",
				compile,
			},
		);
		await assert.rejects(
			createMiddlewareBinding(
				pool,
				{ userId: "fixture-owner" },
				{
					scope: { type: "project", id: scope.project },
					stage: "processing",
					name: "Local override",
					body: "return ctx.continue({event:{metadata:{local:true}}});",
					position: 0,
					failurePolicy: "optional",
					overridePolicy: "allowed",
					originBindingId: parent.id,
					compile,
				},
			),
			{ code: "middleware_override_forbidden" },
		);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.middleware_binding")).rows[0].count, 1);
	});
});

test("U288 actual ingress and worker execute their pinned middleware stages", async () => {
	const { authFixture, fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const { createMiddlewareBinding } = await import("../../packages/domain/src/middleware.ts");
	const { publish } = await import("../../packages/domain/src/publication.ts");
	const { receiveIngress } = await import("../../packages/domain/src/ingress.ts");
	const { processEventTask } = await import("../../apps/worker/src/tasks/process-event.ts");
	await authFixture(async (f) => {
		const { pool, db } = f;
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
		const common = {
			scope: { type: "project" as const, id: scope.project },
			position: 0,
			failurePolicy: "required" as const,
			overridePolicy: "allowed" as const,
			compile,
		};
		await createMiddlewareBinding(
			pool,
			{ userId: "fixture-owner" },
			{
				...common,
				stage: "ingress",
				name: "Ingress marker",
				body: 'return ctx.continue({request:{headers:{"x-ingress-marker":"seen"}}});',
			},
		);
		await createMiddlewareBinding(
			pool,
			{ userId: "fixture-owner" },
			{
				...common,
				stage: "processing",
				name: "Processing marker",
				body: "return ctx.continue({event:{metadata:{processed:true}}});",
			},
		);
		await db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [scope.endpoint, 'return ctx.accept({event:{body:ctx.request.body,contentType:"application/octet-stream",metadata:{ingressMarker:ctx.request.headers["x-ingress-marker"]??"missing"}},response:{status:202,body:"accepted"}});', 'if(ctx.event.metadata.processed!==true)return ctx.fail({reason:"middleware_missing"});return ctx.complete();']);
		await publish(
			pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile,
			},
		);
		const key = (await db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([0, 255, 42]),
				headers: { "content-type": "application/octet-stream" },
				method: "POST",
				url: "https://fixture.test/ingress",
			},
			{ encryptionKey: "fixture-encryption-key-32-characters", run: execute },
		);
		const event = (await db.query("SELECT * FROM payloadbay.event")).rows[0];
		assert.equal(event.metadata.ingressMarker, "seen", "ingress must execute pinned middleware");
		assert.deepEqual(event.original_body, Buffer.from([0, 255, 42]));
		const queued = (await db.query("SELECT * FROM payloadbay.execution")).rows[0];
		await processEventTask(pool, fixtureConfig(f), execute)({ executionId: queued.id, endpointId: scope.endpoint, generation: 1 });
		assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [queued.id])).rows[0].state, "succeeded", "processing must execute pinned middleware");
		assert.equal(event.metadata.processed, undefined);
	});
});

test("U289 middleware edit conflicts preserve publication pinned revision", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { createMiddlewareBinding, updateMiddlewareBinding, getMiddlewareBinding } = await import("../../packages/domain/src/middleware.ts");
	const { publish } = await import("../../packages/domain/src/publication.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
		const binding = await createMiddlewareBinding(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "workspace", id: scope.workspace },
				stage: "processing",
				name: "Workspace middleware",
				body: 'return ctx.continue({event:{metadata:{marker:"old"}}});',
				position: 0,
				failurePolicy: "required",
				overridePolicy: "allowed",
				compile,
			},
		);
		await db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [scope.endpoint, 'return ctx.respondOnly({status:200,body:"challenge"});', "return ctx.complete();"]);
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
		const before = (await db.query("SELECT effective_bindings FROM payloadbay.publication WHERE id=$1", [published.id])).rows[0].effective_bindings;
		const updated = await updateMiddlewareBinding(
			pool,
			{ userId: "fixture-owner" },
			{
				id: binding.id,
				expectedVersion: 1,
				body: 'return ctx.continue({event:{metadata:{marker:"new"}}});',
				compile,
			},
		);
		assert.ok(updated, "middleware edit must create new revision");
		assert.equal(updated.version, 2);
		assert.notEqual(updated.revisionId, binding.revisionId);
		await assert.rejects(
			updateMiddlewareBinding(
				pool,
				{ userId: "fixture-owner" },
				{
					id: binding.id,
					expectedVersion: 1,
					body: "return ctx.continue();",
					compile,
				},
			),
			{ code: "version_conflict" },
		);
		const after = (await db.query("SELECT effective_bindings FROM payloadbay.publication WHERE id=$1", [published.id])).rows[0].effective_bindings;
		assert.deepEqual(after, before);
		assert.equal(after[0].revisionId, binding.revisionId);
		assert.match((await getMiddlewareBinding(pool, { userId: "fixture-owner" }, binding.id)).body, /new/);
	});
});

test("U295 merged middleware patch obeys aggregate limits", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	for (const stage of ["ingress", "processing"] as const) {
		const original = stage === "ingress" ? { request: { headers: { first: "x".repeat(9000) }, contentType: "text/plain" } } : { event: { metadata: { first: "x".repeat(5000) } } };
		const patch = stage === "ingress" ? { request: { headers: { second: "y".repeat(9000) } } } : { event: { metadata: { second: "y".repeat(5000) } } };
		const result = await executePipeline({
			stage,
			bundle: "handler",
			input: original,
			bindings: [
				{
					id: "optional",
					scopeType: "project",
					scopeId: "scope",
					stage,
					position: 0,
					revisionId: "revision",
					bundle: "middleware",
					failurePolicy: "optional",
					version: 1,
				},
			],
			run: async (options) => {
				if (options.bundle === "middleware")
					return {
						decision: { kind: "continue", patch },
						logs: [],
						peakRssBytes: 0,
						durationMs: 0,
					};
				assert.deepEqual(options.input, original, "Oversized merged patch must leave the previous context intact");

				return {
					decision: stage === "ingress" ? { kind: "respondOnly", response: { status: 200, body: "ok" } } : { kind: "complete" },
					logs: [],
					peakRssBytes: 0,
					durationMs: 0,
				};
			},
		});
		assert.equal(result.logs[0].message, "Optional middleware failed");
	}
});

test("CF03 persisted instance middleware never receives customer context", async () => {
	const { executePipeline } = await import("../../packages/domain/src/pipeline.ts");
	const seen: string[] = [];
	const result = await executePipeline({
		stage: "processing",
		bundle: "customer-handler",
		input: { event: { body: "confidential" } },
		bindings: [
			{
				id: "legacy-global",
				scopeType: "instance",
				scopeId: "installation",
				stage: "processing",
				position: 0,
				revisionId: "legacy",
				bundle: "platform-script",
				failurePolicy: "required",
				version: 1,
			},
		],
		run: async (options) => {
			seen.push(options.bundle);

			return {
				decision: options.stage === "processing" ? { kind: "complete" } : { kind: "continue" },
				logs: [],
				peakRssBytes: 1,
				durationMs: 1,
			};
		},
	});
	assert.deepEqual(seen, ["customer-handler"]);
	assert.equal((result.decision as { kind: string }).kind, "complete");
});

test("CF07 old compiled helper pins are checked against the customer boundary", async () => {
	const { assertExecutionDependencies } = await import("../../packages/domain/src/execution-dependencies.ts");
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");

		const module = async (type: string, id: string) => (await db.query("INSERT INTO payloadbay.shared_module_revision(scope_type,scope_id,name,source,source_digest,bundle_digest) VALUES($1,$2,'Legacy','export const x = 1','source','bundle') RETURNING id", [type, id])).rows[0].id;

		const instance = await module("instance", scope.installation);
		const project = await module("project", scope.project);
		await assertExecutionDependencies(pool, scope.project, "ingress", {}, []);
		await assertExecutionDependencies(pool, scope.project, "ingress", { modules: { Local: project } }, []);
		await assert.rejects(assertExecutionDependencies(pool, scope.project, "ingress", { modules: { Legacy: instance } }, []), { code: "publication_scope_changed" });
		const binding = {
			id: "old",
			scopeType: "project" as const,
			scopeId: scope.project,
			stage: "processing" as const,
			position: 0,
			revisionId: "old",
			bundle: "old",
			failurePolicy: "required" as const,
			version: 1,
			manifest: { modules: { Legacy: instance } },
		};
		await assert.rejects(assertExecutionDependencies(pool, scope.project, "processing", {}, [binding]), { code: "publication_scope_changed" });
		await assertExecutionDependencies(pool, scope.project, "ingress", {}, [binding]);
		await assert.rejects(assertExecutionDependencies(pool, scope.project, "ingress", { modules: { Missing: crypto.randomUUID() } }, []), { code: "publication_scope_changed" });
	});
});
