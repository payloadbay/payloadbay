import test from "node:test";
import assert from "node:assert/strict";
import { setupSecret, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { nextFixture } from "../helpers/next-fixture.ts";
import { runOnce } from "../../apps/worker/node_modules/graphile-worker/dist/index.js";
import { platformJobTask } from "../../apps/worker/src/tasks/platform-job.ts";

test("U223 Next auth route mounts passwordless service", async () => {
	await nextFixture(async ({ url }) => {
		const response = await fetch(url + "/api/auth/get-session");
		assert.equal(response.status, 200);
		assert.equal(await response.json(), null);
	});
});

test("A1 real Next installation completes one verified owner", async () => {
	await nextFixture(
		async (f) => {
			const post = (path: string, body: unknown, cookie = "") =>
				fetch(f.url + path, {
					method: "POST",
					headers: {
						origin: f.url,
						"x-payloadbay-csrf": "1",
						"content-type": "application/json",
						cookie,
					},
					body: JSON.stringify(body),
				});

			const status = await fetch(f.url + "/api/v1/bootstrap");
			assert.equal(status.status, 200, "bootstrap route must exist");
			assert.deepEqual(await status.json(), { configured: false });
			const input = {
				action: "request-code",
				secret: setupSecret,
				email: "first@example.test",
				name: "First owner",
			};
			assert.equal((await post("/api/v1/bootstrap", { ...input, secret: "wrong" })).status, 403);
			assert.equal((await post("/api/v1/bootstrap", input)).status, 200);
			await runOnce({
				pgPool: f.pool,
				noHandleSignals: true,
				concurrency: 1,
				taskList: { platform_job: platformJobTask(f.pool, fixtureConfig(f)) },
			});
			const messages = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
			assert.equal(messages.total, 1);
			const message = await (await fetch(f.mailUrl + "/api/v1/message/" + messages.messages[0].ID)).json();
			const otp = message.Text.match(/\b\d{6}\b/)?.[0];
			assert.ok(otp);
			const signed = await post("/api/auth/sign-in/email-otp", { email: input.email, otp });
			assert.equal(signed.status, 200);
			const cookie = signed.headers
				.getSetCookie()
				.map((c) => c.split(";")[0])
				.join("; ");
			assert.ok(cookie);
			const results = await Promise.all([post("/api/v1/bootstrap", { action: "complete", secret: setupSecret }, cookie), post("/api/v1/bootstrap", { action: "complete", secret: setupSecret }, cookie)]);
			assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
			assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.grant_record WHERE role_preset='owner'")).rows[0].n, 1);
			assert.deepEqual(await (await fetch(f.url + "/api/v1/bootstrap")).json(), { configured: true });
			assert.equal((await post("/api/v1/bootstrap", input)).status, 409);
			const signup = await post("/api/auth/sign-up/email", { email: "outsider@example.test", name: "Outsider", password: "not-enabled" });
			assert.equal(signup.status, 404);
		},
		{ runtimePasswords: { app: "fixture-owner-app-database-password-32-characters", worker: "fixture-owner-worker-database-password-32-characters" } },
	);
});

test("A2 real API denies anonymous and inactive access", async () => {
	await nextFixture(async (f) => {
		const anonymous = await fetch(f.url + "/api/v1/me");
		assert.equal(anonymous.status, 401, "private API must authenticate");
		assert.equal((await anonymous.json()).error.code, "unauthenticated");
		const { identity } = await import("../helpers/auth-fixtures.ts");
		const { bootstrapOwner } = await import("../../packages/domain/src/bootstrap.ts");
		const { createAuth } = await import("../../packages/domain/src/auth-runtime.ts");
		const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
		await identity(f.db, "owner");
		await bootstrapOwner(f.pool, { userId: "owner", providedSecret: setupSecret, expectedSecret: setupSecret });
		const config = { ...fixtureConfig(f), publicUrl: f.url };
		const service = createAuth(f.pool, config);
		try {
			await service.api.sendVerificationOTP({ body: { email: "owner@example.test", type: "sign-in" } });
			const mail = decryptPrivate<{ otp: string }>((await f.db.query("SELECT encrypted_payload FROM payloadbay.platform_job")).rows[0].encrypted_payload, config.encryptionKey);
			const signed = await fetch(f.url + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: f.url, "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.test", otp: mail.otp }) });
			assert.equal(signed.status, 200);
			const cookie = signed.headers
				.getSetCookie()
				.map((c) => c.split(";")[0])
				.join("; ");
			const headers = {
				cookie,
				origin: f.url,
				"x-payloadbay-csrf": "1",
				"content-type": "application/json",
			};
			const me = await fetch(f.url + "/api/v1/me", { headers });
			assert.equal(me.status, 200);
			const profile = await me.json();
			assert.equal(profile.user.id, "owner");
			const workspaceResponse = await fetch(f.url + "/api/v1/workspaces", { method: "POST", headers, body: JSON.stringify({ parentId: (await (await fetch(f.url + "/api/v1/organizations", { headers })).json())[0].id, name: "Workspace", slug: "workspace" }) });
			assert.equal(workspaceResponse.status, 200);
			const workspace = await workspaceResponse.json();
			const projectResponse = await fetch(f.url + "/api/v1/projects", { method: "POST", headers, body: JSON.stringify({ parentId: workspace.id, name: "Project", slug: "project" }) });
			assert.equal(projectResponse.status, 200);
			const project = await projectResponse.json();
			const tokenResponse = await fetch(f.url + "/api/v1/tokens", {
				method: "POST",
				headers,
				body: JSON.stringify({
					scope: { type: "project", id: project.id },
					name: "Read only",
					permissions: ["metadata.read"],
					expiresAt: new Date(Date.now() + 60000).toISOString(),
				}),
			});
			assert.equal(tokenResponse.status, 200);
			const token = await tokenResponse.json();
			const listed = await fetch(f.url + "/api/v1/projects", { headers: { authorization: "Bearer " + token.secret } });
			assert.equal(listed.status, 200);
			assert.deepEqual(
				(await listed.json()).map((p: { id: string }) => p.id),
				[project.id],
			);
			const blocked = await fetch(f.url + "/api/v1/projects", { method: "POST", headers: { authorization: "Bearer " + token.secret, "content-type": "application/json" }, body: JSON.stringify({ parentId: workspace.id, name: "Nope", slug: "nope" }) });
			assert.equal(blocked.status, 401);
			await f.db.query("UPDATE payloadbay.admission SET active=false");
			for (const path of ["/api/v1/me", "/api/v1/workspaces", "/api/v1/projects"]) {
				const denied = await fetch(f.url + path, { headers });
				assert.equal(denied.status, 401);
				assert.equal((await denied.json()).user, undefined);
			}

			assert.equal((await fetch(f.url + "/api/v1/projects", { headers: { authorization: "Bearer " + token.secret } })).status, 401);
		} finally {
			await service.close();
		}
	});
});

test("A5 API draft changes leave published runtime behavior unchanged", async () => {
	await nextFixture(async (f) => {
		const post = (path: string, data: unknown, cookie = "") =>
			fetch(f.url + path, {
				method: "POST",
				headers: {
					origin: f.url,
					"x-payloadbay-csrf": "1",
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify(data),
			});

		const email = "publisher@example.test";
		assert.equal(
			(
				await post("/api/v1/bootstrap", {
					action: "request-code",
					secret: setupSecret,
					email,
					name: "Publisher",
				})
			).status,
			200,
		);
		await runOnce({
			pgPool: f.pool,
			noHandleSignals: true,
			concurrency: 1,
			taskList: { platform_job: platformJobTask(f.pool, fixtureConfig(f)) },
		});
		const messages = await (await fetch(f.mailUrl + "/api/v1/messages")).json();
		const message = await (await fetch(f.mailUrl + "/api/v1/message/" + messages.messages[0].ID)).json();
		const otp = message.Text.match(/\b\d{6}\b/)?.[0];
		const signed = await post("/api/auth/sign-in/email-otp", { email, otp });
		assert.equal(signed.status, 200);
		const cookie = signed.headers
			.getSetCookie()
			.map((c) => c.split(";")[0])
			.join("; ");
		assert.equal((await post("/api/v1/bootstrap", { action: "complete", secret: setupSecret }, cookie)).status, 200);
		const headers = {
			cookie,
			origin: f.url,
			"x-payloadbay-csrf": "1",
			"content-type": "application/json",
		};
		const workspace = await (await post("/api/v1/workspaces", { parentId: (await (await fetch(f.url + "/api/v1/organizations", { headers })).json())[0].id, name: "Workspace", slug: "workspace" }, cookie)).json();
		const project = await (await post("/api/v1/projects", { parentId: workspace.id, name: "Project", slug: "project" }, cookie)).json();
		const created = await post("/api/v1/projects/" + project.id + "/endpoints", { name: "Route", slug: "route" }, cookie);
		assert.equal(created.status, 200, "endpoint API must be available");
		const endpoint = await created.json();

		const save = (stage: string, body: string, version: number) => fetch(f.url + "/api/v1/endpoints/" + endpoint.id + "/drafts/" + stage, { method: "PATCH", headers: { ...headers, "if-match": '"' + version + '"' }, body: JSON.stringify({ body }) });

		assert.equal((await save("ingress", 'return {kind:"respondOnly",response:{status:200,body:"first"}};', 1)).status, 200);
		const published = await post("/api/v1/endpoints/" + endpoint.id + "/publications", { expectedVersion: 1, draftVersions: { ingress: 2, processing: 1 } }, cookie);
		assert.equal(published.status, 200);
		const first = await published.json();
		assert.equal((await save("ingress", 'return {kind:"respondOnly",response:{status:200,body:"draft"}};', 2)).status, 200);
		const recorded = await (await fetch(f.url + "/api/v1/endpoints/" + endpoint.id + "/publications?id=" + first.id, { headers })).json();
		const executed = await fetch(f.executorUrl + "/execute", { method: "POST", headers: { authorization: "Bearer fixture-executor-token-32-characters", "content-type": "application/json" }, body: JSON.stringify({ stage: "ingress", bundle: recorded.ingress_bundle, input: {} }) });
		assert.equal(executed.status, 200);
		assert.deepEqual((await executed.json()).decision, { kind: "respondOnly", response: { status: 200, body: "first" } });
		assert.equal((await (await fetch(f.url + "/api/v1/endpoints/" + endpoint.id, { headers })).json()).activePublicationId, first.id);
		assert.equal((await save("ingress", "return ctx.respondOnly({status:200,body:;", 3)).status, 200);
		const invalid = await post("/api/v1/endpoints/" + endpoint.id + "/publications", { expectedVersion: 2, draftVersions: { ingress: 4, processing: 1 } }, cookie);
		assert.equal(invalid.status, 422);
		const error = await invalid.json();
		assert.equal(error.error.code, "compilation_failed");
		assert.equal(error.error.diagnostics[0].line, 1);
		assert.equal((await (await fetch(f.url + "/api/v1/endpoints/" + endpoint.id, { headers })).json()).activePublicationId, first.id);
	});
});

test("A7 public HTTP acknowledges only durable accepted work", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { publish } = await import("../../packages/domain/src/publication.ts");
		const { compileSource } = await import("../../packages/domain/src/executor-client.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await f.db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing',$3)", [scope.endpoint, 'return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,headers:{"content-type":"text/plain"},body:"durably accepted"}});', "return ctx.complete();"]);
		const config = { executorUrl: f.executorUrl, executorToken: "fixture-executor-token-32-characters" };
		await publish(
			f.pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile: (input) => compileSource(config, input),
			},
		);
		const key = (await f.db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
		const body = new Uint8Array([0, 255, 42]);
		const response = await fetch(f.url + "/ingress/" + key, { method: "POST", headers: { "content-type": "application/octet-stream" }, body });
		assert.equal(response.status, 202, "public ingress must acknowledge durable work");
		assert.equal(await response.text(), "durably accepted");
		assert.equal(response.headers.get("content-type"), "text/plain");
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.deepEqual((await f.db.query("SELECT original_body FROM payloadbay.event")).rows[0].original_body, Buffer.from(body));
		for (const table of ["receipt", "execution", "dispatch"]) assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay." + table)).rows[0].n, 1);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n, 1);
	});
});

test("U260 configuration API exposes scoped destinations and secret metadata", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const token = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Configuration test",
				permissions: [...permissions],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		const headers = { authorization: "Bearer " + token.secret, "content-type": "application/json" };
		const destination = await fetch(f.url + "/api/v1/projects/" + scope.project + "/destinations", { method: "POST", headers, body: JSON.stringify({ name: "App", url: "http://192.168.0.1/events" }) });
		assert.equal(destination.status, 200, "destination configuration route must exist");
		const created = await destination.json();
		assert.equal(created.is_default, true);
		const listed = await (await fetch(f.url + "/api/v1/projects/" + scope.project + "/destinations", { headers })).json();
		assert.deepEqual(
			listed.map((row: { id: string }) => row.id),
			[created.id],
		);
		assert.equal(listed[0].http_config, undefined);
		const secret = await fetch(f.url + "/api/v1/secrets", { method: "POST", headers, body: JSON.stringify({ scope: { type: "project", id: scope.project }, name: "Signing key", value: "fixture-API-secret-not-returned" }) });
		assert.equal(secret.status, 200);
		const saved = await secret.json();
		assert.equal(JSON.stringify(saved).includes("fixture-API-secret"), false);
		const metadataResponse = await fetch(f.url + "/api/v1/secrets?scopeType=project&scopeId=" + scope.project, { headers });
		assert.equal(metadataResponse.status, 200);
		const metadata = await metadataResponse.json();
		assert.equal(metadata[0].id, saved.id);
		assert.equal(metadata[0].encrypted_value, undefined);
		assert.equal(metadata[0].value, undefined);
		const hidden = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Metadata only",
				permissions: ["metadata.read"],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		const denied = await fetch(f.url + "/api/v1/secrets?scopeType=project&scopeId=" + scope.project, { headers: { authorization: "Bearer " + hidden.secret } });
		assert.equal(denied.status, 403);
		const revoked = await fetch(f.url + "/api/v1/secrets/" + saved.id, { method: "DELETE", headers });
		assert.equal(revoked.status, 204);
		assert.ok((await f.db.query("SELECT revoked_at FROM payloadbay.secret_version WHERE id=$1", [saved.id])).rows[0].revoked_at);
	});
});

test("U271 event API separates metadata payload and replay privileges", async () => {
	await nextFixture(async (f) => {
		const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const event = await seedEvent(f.db, scope);

		const mint = async (rights: Parameters<typeof createToken>[2]["permissions"]) =>
			createToken(
				f.pool,
				{ userId: "fixture-owner" },
				{
					scope: { type: "project", id: scope.project },
					name: "Event API test",
					permissions: rights,
					expiresAt: new Date(Date.now() + 60000),
				},
			);

		const metadata = await mint(["metadata.read"]);
		const listed = await fetch(f.url + "/api/v1/projects/" + scope.project + "/events", { headers: { authorization: "Bearer " + metadata.secret } });
		assert.equal(listed.status, 200, "event inspection API must exist");
		const page = await listed.json();
		assert.equal(page.items[0].id, event);
		assert.equal(page.items[0].originalBody, undefined);
		const blocked = await fetch(f.url + "/api/v1/events/" + event + "/payload", { headers: { authorization: "Bearer " + metadata.secret } });
		assert.equal(blocked.status, 403);
		const operator = await mint(["metadata.read", "payload.read", "events.replay"]);
		const headers = { authorization: "Bearer " + operator.secret, "content-type": "application/json", "idempotency-key": "api-manual-replay" };
		const body = await (await fetch(f.url + "/api/v1/events/" + event + "/payload", { headers })).json();
		assert.equal(body.originalBody, Buffer.from([0, 255, 42]).toString("base64"));
		const replay = await fetch(f.url + "/api/v1/events/" + event + "/replay", { method: "POST", headers, body: "{}" });
		assert.equal(replay.status, 200);
		const execution = await replay.json();
		assert.ok(execution.id);
		const again = await (await fetch(f.url + "/api/v1/events/" + event + "/replay", { method: "POST", headers, body: "{}" })).json();
		assert.equal(again.id, execution.id);
		assert.equal(again.reused, true);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 1);
		const detail = await (await fetch(f.url + "/api/v1/events/" + event, { headers: { authorization: "Bearer " + metadata.secret } })).json();
		assert.equal(detail.executions[0].id, execution.id);
		assert.equal(detail.originalBody, undefined);
	});
});

test("U290 real API manages scoped shared code and versioned middleware", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,true,now(),now())', ["fixture-owner", "fixture-owner@example.test"]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const token = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Code API",
				permissions: ["metadata.read", "code.read", "code.edit", "code.publish"],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		const headers = { authorization: "Bearer " + token.secret, "content-type": "application/json" };
		const create = await fetch(f.url + "/api/v1/shared-code", { method: "POST", headers, body: JSON.stringify({ scope: { type: "project", id: scope.project }, name: "Messages", source: 'export function message(){return "shared";}' }) });
		assert.equal(create.status, 200, "shared code API must be available");
		const shared = await create.json();
		const copy = await fetch(f.url + "/api/v1/shared-code/" + shared.id + "/copy", { method: "POST", headers, body: JSON.stringify({ scope: { type: "project", id: scope.project }, name: "Copied" }) });
		assert.equal(copy.status, 200);
		assert.equal((await copy.json()).originRevisionId, shared.id);
		const bindingResponse = await fetch(f.url + "/api/v1/middleware", {
			method: "POST",
			headers,
			body: JSON.stringify({
				scope: { type: "endpoint", id: scope.endpoint },
				stage: "processing",
				name: "Route middleware",
				body: "return ctx.continue();",
				position: 0,
				failurePolicy: "optional",
				overridePolicy: "allowed",
			}),
		});
		assert.equal(bindingResponse.status, 200);
		const binding = await bindingResponse.json();
		const edited = await fetch(f.url + "/api/v1/middleware/" + binding.id, { method: "PATCH", headers: { ...headers, "if-match": '"1"' }, body: JSON.stringify({ body: "return ctx.continue({event:{metadata:{custom:true}}});" }) });
		assert.equal(edited.status, 200);
		assert.equal((await edited.json()).version, 2);
		assert.equal((await fetch(f.url + "/api/v1/middleware/" + binding.id, { method: "PATCH", headers: { ...headers, "if-match": '"1"' }, body: JSON.stringify({ enabled: false }) })).status, 409);
		assert.equal((await fetch(f.url + "/api/v1/shared-code", { method: "POST", headers, body: JSON.stringify({ scope: { type: "workspace", id: scope.workspace }, name: "Denied", source: "export const value=1;" }) })).status, 401);
	});
});

test("U298 real API executes synthetic draft and denies missing test permission", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const { unpackWire } = await import("../../packages/contracts/src/wire.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,true,now(),now())', ["fixture-owner", "fixture-owner@example.test"]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);

		const mint = (rights: string[]) =>
			createToken(
				f.pool,
				{ userId: "fixture-owner" },
				{
					scope: { type: "project", id: scope.project },
					name: "Test API",
					permissions: rights as any,
					expiresAt: new Date(Date.now() + 60000),
				},
			);

		const token = await mint(["code.read", "code.test"]);
		const body = JSON.stringify({ stage: "processing", body: 'const sent=await ctx.destinations.send({url:"http://127.0.0.1:1/unreachable"},{operationId:"test",body:ctx.event.body});return sent.ok?ctx.complete():ctx.fail({reason:"failed"});', fixture: { body: "synthetic" } });
		const response = await fetch(f.url + "/api/v1/endpoints/" + scope.endpoint + "/test", { method: "POST", headers: { authorization: "Bearer " + token.secret, "content-type": "application/json" }, body });
		assert.equal(response.status, 200, "Synthetic test API must be available");
		const result = unpackWire(await response.json()) as { mode: string; decision: { kind: string } };
		assert.equal(result.mode, "dry");
		assert.equal(result.decision.kind, "complete");
		const denied = await mint(["code.read"]);
		assert.equal((await fetch(f.url + "/api/v1/endpoints/" + scope.endpoint + "/test", { method: "POST", headers: { authorization: "Bearer " + denied.secret, "content-type": "application/json" }, body })).status, 403);
		assert.equal((await f.db.query("SELECT count(*)::int AS n FROM payloadbay.delivery_attempt")).rows[0].n, 0);
	});
});

test("U304 real API manages opt-in rules with scoped permission and versions", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,true,now(),now())', ["fixture-owner", "fixture-owner@example.test"]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);

		const mint = (rights: string[]) =>
			createToken(
				f.pool,
				{ userId: "fixture-owner" },
				{
					scope: { type: "project", id: scope.project },
					name: "Rules API",
					permissions: rights as any,
					expiresAt: new Date(Date.now() + 60000),
				},
			);

		const token = await mint(["notifications.rules.manage"]);
		const headers = { authorization: "Bearer " + token.secret, "content-type": "application/json" };
		const url = f.url + "/api/v1/projects/" + scope.project + "/notification-rules";
		const empty = await fetch(url, { headers });
		assert.equal(empty.status, 200, "Notification rule API must exist");
		assert.deepEqual(await empty.json(), []);
		const created = await fetch(url, { method: "POST", headers, body: JSON.stringify({ count: 1, windowSeconds: 60 }) });
		assert.equal(created.status, 200);
		const rule = await created.json();
		assert.equal(rule.enabled, false, "Creating a rule must not silently opt in");
		const activate = await fetch(f.url + "/api/v1/notification-rules/" + rule.id, { method: "PATCH", headers: { ...headers, "if-match": '"1"' }, body: JSON.stringify({ enabled: true }) });
		assert.equal(activate.status, 200);
		assert.equal((await activate.json()).version, 2);
		assert.equal((await fetch(f.url + "/api/v1/notification-rules/" + rule.id, { method: "PATCH", headers: { ...headers, "if-match": '"1"' }, body: '{"count":2}' })).status, 409);
		const reader = await mint(["notifications.read"]);
		assert.equal((await fetch(url, { method: "POST", headers: { ...headers, authorization: "Bearer " + reader.secret }, body: '{"count":1,"windowSeconds":60}' })).status, 403);
	});
});

test("U306 real pause and resume APIs preserve scoped versions", async () => {
	await nextFixture(async (f) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$1,$2,true,now(),now())', ["fixture-owner", "fixture-owner@example.test"]);
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const token = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Pause API",
				permissions: ["metadata.read", "endpoints.pause"],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		const headers = { authorization: "Bearer " + token.secret, "content-type": "application/json", "if-match": '"1"' };
		const url = f.url + "/api/v1/endpoints/" + scope.endpoint;
		const paused = await fetch(url + "/pause", { method: "POST", headers, body: "{}" });
		assert.equal(paused.status, 200, "Pause API must be available");
		const result = await paused.json();
		assert.equal(result.paused, true);
		assert.equal(result.version, 2);
		assert.equal((await fetch(url + "/resume", { method: "POST", headers, body: "{}" })).status, 409);
		const resumed = await fetch(url + "/resume", { method: "POST", headers: { ...headers, "if-match": '"2"' }, body: "{}" });
		assert.equal(resumed.status, 200);
		assert.equal((await resumed.json()).paused, false);
		const stored = (await f.db.query("SELECT paused,config_version,active_publication_id FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0];
		assert.equal(stored.config_version, 3);
		assert.equal(stored.active_publication_id, scope.publication);
	});
});

test("U317 scoped readers manage only their own SMTP preferences through API", async () => {
	await nextFixture(async (fixture) => {
		const { seedScope } = await import("../helpers/domain-fixtures.ts");
		const { identity } = await import("../helpers/auth-fixtures.ts");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		const { createToken } = await import("../../packages/domain/src/tokens.ts");
		const { createNotificationRule } = await import("../../packages/domain/src/notification-rules.ts");
		const scope = await seedScope(fixture.db);
		await identity(fixture.db, "fixture-owner");
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const owner = { userId: "fixture-owner" };
		const rule = await createNotificationRule(fixture.pool, owner, scope.project, { count: 1, windowSeconds: 60 });
		const token = await createToken(fixture.pool, owner, {
			scope: { type: "project", id: scope.project },
			name: "Notification reader",
			permissions: ["notifications.read"],
			expiresAt: new Date(Date.now() + 120000),
		});
		const headers = { authorization: "Bearer " + token.secret, "content-type": "application/json" };
		const endpoint = fixture.url + "/api/v1/notification-rules/" + rule.id + "/subscription";
		const before = await fetch(fixture.url + "/api/v1/projects/" + scope.project + "/notification-subscriptions", { headers });
		assert.equal(before.status, 200, "Scoped readers must be able to inspect their own notification preferences");
		assert.equal((await before.json())[0].smtpEnabled, false);
		assert.equal((await fetch(endpoint, { method: "PUT", headers: { "content-type": "application/json" }, body: '{"enabled":true}' })).status, 401);
		const changed = await fetch(endpoint, { method: "PUT", headers, body: '{"enabled":true}' });
		assert.equal(changed.status, 200);
		assert.deepEqual(await changed.json(), { ruleId: rule.id, channel: "smtp", enabled: true });
		assert.equal((await fetch(endpoint, { method: "PUT", headers, body: '{"enabled":true,"userId":"other-user"}' })).status, 400);
		assert.equal((await fetch(fixture.url + "/api/v1/projects/" + scope.project + "/notification-rules", { headers })).status, 403, "Reading preferences cannot grant threshold-management permission");
		const preferences = await (await fetch(fixture.url + "/api/v1/projects/" + scope.project + "/notification-subscriptions", { headers })).json();
		assert.equal(preferences[0].smtpEnabled, true);
		assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0].count, 0);
		assert.equal((await fetch(endpoint, { method: "PUT", headers, body: '{"enabled":false}' })).status, 200);
	});
});

test("A6 A8 A9 A11 public HMAC ingress preserves challenge bytes and never acknowledges failed durable acceptance", async () => {
	const { createHmac, randomUUID } = await import("node:crypto");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	const { publish } = await import("../../packages/domain/src/publication.ts");
	const { createSecret } = await import("../../packages/domain/src/secrets.ts");
	const { compileSource } = await import("../../packages/domain/src/executor-client.ts");
	const { hmacHttpTemplate } = await import("../../packages/script-sdk/src/templates/hmac.ts");
	await nextFixture(async (f) => {
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const config = { ...fixtureConfig(f), executorUrl: f.executorUrl };
		const signingValue = randomUUID();
		const secret = await createSecret(f.pool, { userId: "fixture-owner" }, { scope: { type: "project", id: scope.project }, name: "Synthetic signing fixture", value: signingValue }, config.encryptionKey);
		const challenge = "challenge <literal>&\n";
		const source = hmacHttpTemplate.source + '\nexport async function GET(ctx: IngressContext): Promise<IngressDecision> { return ctx.respondOnly({status:200,headers:{"content-type":"text/plain"},body:' + JSON.stringify(challenge) + "}); }";
		await f.db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body,secret_bindings) VALUES($1,'ingress',$2,$3),($1,'processing','return ctx.complete();','{}')", [scope.endpoint, source, JSON.stringify({ SIGNING_SECRET: secret.id })]);
		await publish(
			f.pool,
			{ userId: "fixture-owner" },
			{
				endpointId: scope.endpoint,
				expectedVersion: 1,
				draftVersions: { ingress: 1, processing: 1 },
				compile: (input) => compileSource(config, input),
			},
		);
		const key = (await f.db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
		const url = f.url + "/ingress/" + key;

		const counts = async () => {
			const values: Record<string, number> = {};
			for (const table of ["event", "receipt", "execution", "dispatch"]) values[table] = (await f.db.query("SELECT count(*)::int AS n FROM payloadbay." + table)).rows[0].n;
			values.jobs = (await f.db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n;

			return values;
		};

		const challenged = await fetch(url);
		assert.equal(challenged.status, 200);
		assert.equal(challenged.headers.get("content-type"), "text/plain");
		assert.deepEqual(Buffer.from(await challenged.arrayBuffer()), Buffer.from(challenge));
		assert.deepEqual(await counts(), {
			event: 1,
			receipt: 0,
			execution: 0,
			dispatch: 0,
			jobs: 0,
		});
		const body = Buffer.from([0, 255, 42, 10]);
		const rejected = await fetch(url, { method: "POST", headers: { "content-type": "application/octet-stream", "x-payloadbay-signature": "0".repeat(64) }, body: new Uint8Array(body) });
		assert.equal(rejected.status, 401);
		assert.equal(await rejected.text(), "Invalid signature");
		assert.deepEqual(await counts(), {
			event: 2,
			receipt: 0,
			execution: 0,
			dispatch: 0,
			jobs: 0,
		});

		const signedRequest = (value: Buffer) => fetch(url, { method: "POST", headers: { "content-type": "application/octet-stream", "x-payloadbay-signature": createHmac("sha256", signingValue).update(value).digest("hex") }, body: new Uint8Array(value) });

		const accepted = await signedRequest(body);
		assert.equal(accepted.status, 202);
		assert.equal(await accepted.text(), "Accepted");
		assert.deepEqual(await counts(), {
			event: 3,
			receipt: 1,
			execution: 1,
			dispatch: 1,
			jobs: 1,
		});
		const stored = (await f.db.query("SELECT original_body,accepted_body FROM payloadbay.event WHERE ingress_outcome='accept'")).rows[0];
		assert.deepEqual(stored.original_body, body);
		assert.deepEqual(stored.accepted_body, body);
		await f.db.query("CREATE OR REPLACE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic scheduling outage'; END $$");
		const failed = await signedRequest(Buffer.from("distinct rollback fixture"));
		assert.equal(failed.status, 500);
		const failure = await failed.text();
		assert.equal(failure.includes(signingValue), false);
		assert.equal(failure.includes("synthetic scheduling outage"), false);
		assert.deepEqual(await counts(), {
			event: 3,
			receipt: 1,
			execution: 1,
			dispatch: 1,
			jobs: 1,
		});
	});
});
