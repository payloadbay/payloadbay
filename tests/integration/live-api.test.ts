import test from "node:test";
import assert from "node:assert/strict";
import { requestContext, expectedVersion } from "../../packages/domain/src/request-context.ts";

const options = { origin: "https://payloadbay.example.test", authenticate: async () => ({ userId: "fixture-operator", active: true, transport: "cookie" as const }) };

test("U36 invalid browser command origin is rejected", async () => {
	await assert.rejects(requestContext(new Request(options.origin + "/api/v1/workspaces", { method: "POST", headers: { origin: "https://attacker.example.test", "x-payloadbay-csrf": "1" } }), options), { code: "invalid_origin", status: 403 });
});

test("U37 cookie command requires CSRF protection", async () => {
	await assert.rejects(requestContext(new Request(options.origin + "/api/v1/workspaces", { method: "POST", headers: { origin: options.origin } }), options), { code: "csrf_required", status: 403 });
});

test("U38 unauthenticated command returns no private detail", async () => {
	await assert.rejects(requestContext(new Request(options.origin + "/api/v1/events"), { ...options, authenticate: async () => null }), { code: "unauthenticated", status: 401, publicMessage: "Authentication required" });
});

test("U39 optimistic conflict cannot silently overwrite", () => {
	assert.throws(() => expectedVersion(2, 1), { code: "version_conflict", status: 409 });
});

import { handle } from "../../apps/web/src/app/lib/api/handler.ts";

test("U206 private HTTP command is unauthorized before invocation", async () => {
	let invoked = false;
	const response = await handle(new Request(options.origin + "/api/v1/events"), { ...options, authenticate: async () => null }, async () => {
		invoked = true;

		return { private: "fixture-event" };
	});
	assert.equal(response.status, 401);
	assert.equal(invoked, false);
	const body = await response.json();
	assert.equal(body.error.code, "unauthenticated");
	assert.match(body.error.correlationId, /^[0-9a-f-]{36}$/);
	assert.equal(body.private, undefined);
});

import { api } from "../../apps/web/src/app/lib/api-client.ts";

test("U207 browser commands send protected same origin JSON", async () => {
	const previous = globalThis.fetch;
	let actual: { url: string; init?: RequestInit } | undefined;
	globalThis.fetch = (async (url, init) => {
		actual = { url: String(url), init };

		return Response.json({ id: "fixture-created" });
	}) as typeof fetch;
	try {
		await api("/workspaces", { method: "POST", json: { name: "Fixture" }, version: 1 });
		assert.equal(actual?.url, "/api/v1/workspaces");
		assert.equal(actual?.init?.credentials, "same-origin");
		assert.equal(new Headers(actual?.init?.headers).get("x-payloadbay-csrf"), "1");
		assert.equal(actual?.init?.body, JSON.stringify({ name: "Fixture" }));
	} finally {
		globalThis.fetch = previous;
	}
});

import { readJson } from "../../apps/web/src/app/lib/api/handler.ts";
import { z } from "../../packages/contracts/node_modules/zod/index.js";

test("U209 oversized JSON body is rejected before parsing", async () => {
	const request = new Request(options.origin + "/api/v1/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "fixture" }) });
	await assert.rejects(readJson(request, z.object({ name: z.string() }), 4), { code: "body_too_large", status: 413 });
});

test("U210 JSON body at limit retains public value", async () => {
	const value = { name: "fixture" };
	const body = JSON.stringify(value);
	const request = new Request(options.origin + "/api/v1/command", { method: "POST", headers: { "content-type": "application/json" }, body });
	assert.deepEqual(await readJson(request, z.object({ name: z.string() }), Buffer.byteLength(body)), value);
});

test("U239 lookalike JSON media type is rejected before parsing", async () => {
	const { readJson } = await import("../../apps/web/src/app/lib/api/handler.ts");
	let parsed = false;
	const schema = {
		safeParse(value: unknown) {
			parsed = true;

			return { success: true as const, data: value };
		},
	};
	await assert.rejects(readJson(new Request(options.origin + "/api/v1/test", { method: "POST", headers: { "content-type": "application/jsonp" }, body: "{}" }), schema), { code: "unsupported_media_type", status: 415 });
	assert.equal(parsed, false);
	assert.deepEqual(await readJson(new Request(options.origin + "/api/v1/test", { method: "POST", headers: { "content-type": "Application/JSON; charset=utf-8" }, body: "{}" }), schema), {});
});

test("U262 API client keeps publication diagnostic source positions", async () => {
	const { api, ApiFailure } = await import("../../apps/web/src/app/lib/api-client.ts");
	const original = globalThis.fetch;
	const diagnostics = [
		{
			sourceId: "ingress",
			line: 3,
			column: 7,
			severity: "error" as const,
			code: "syntax",
			message: "Expected expression",
		},
	];
	globalThis.fetch = Object.assign(
		async () =>
			Response.json(
				{
					error: {
						code: "compilation_failed",
						message: "Compilation failed",
						correlationId: "fixture-correlation",
						diagnostics,
					},
				},
				{ status: 422 },
			),
		{ preconnect: original.preconnect },
	);
	try {
		await assert.rejects(api("/endpoints/fixture/publications", { method: "POST", json: {} }), (error: unknown) => {
			assert.ok(error instanceof ApiFailure);
			assert.deepEqual(error.diagnostics, diagnostics, "editor must receive source-position diagnostics");

			return true;
		});
	} finally {
		globalThis.fetch = original;
	}
});

test("U272 durable changes serialize cursor allocation until prior commit", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		const a = await pool.connect();
		const b = await pool.connect();
		try {
			await a.query("BEGIN");
			await b.query("BEGIN");
			const first = await appendChange(a, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "first" });
			assert.ok(first, "durable change cursor must be allocated");
			let allocated = false;
			const second = appendChange(b, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "second" }).then((value) => {
				allocated = true;

				return value;
			});
			await new Promise((r) => setTimeout(r, 100));
			assert.equal(allocated, false, "later transaction cannot allocate before earlier commit");
			await a.query("COMMIT");
			const next = await second;
			await b.query("COMMIT");
			assert.ok(BigInt(next) > BigInt(first));
			const visible = (await db.query("SELECT resource_id FROM payloadbay.change_record ORDER BY cursor")).rows;
			assert.deepEqual(
				visible.map((row) => row.resource_id),
				["first", "second"],
			);
		} finally {
			await a.query("ROLLBACK");
			await b.query("ROLLBACK");
			a.release();
			b.release();
		}
	});
});

test("U274 live backfill excludes unrelated scope and private data", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const { readChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const hidden = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Hidden','hidden','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		await db.query("BEGIN");
		await appendChange(db, { scope: { type: "project", id: hidden }, kind: "event.accepted", resourceId: "hidden-event" });
		await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "visible-event" });
		await db.query("COMMIT");
		const backfill = await readChanges(pool, { userId: "fixture-owner" }, { scope: { type: "project", id: scope.project }, after: "0" });
		assert.equal(backfill.items.length, 1, "authorized live backfill must be available");
		assert.equal(backfill.items[0].resourceId, "visible-event");
		assert.equal(JSON.stringify(backfill).includes("hidden-event"), false);
		assert.equal(Reflect.get(backfill.items[0], "metadata"), undefined);
	});
});

test("U149 authenticated SSE reconnect backfills then follows committed changes", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "before-connect" });
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, "0", abort.signal, { pollMs: 20 });
		assert.equal(response.headers.get("content-type"), "text/event-stream", "authorized SSE response must be available");
		const reader = response.body!.getReader();
		const decode = new TextDecoder();
		try {
			assert.match(decode.decode((await reader.read()).value), /connected/);
			const first = decode.decode((await reader.read()).value);
			assert.match(first, /before-connect/);
			const cursor = /id: (\d+)/.exec(first)![1];
			await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "after-connect" });
			const second = decode.decode((await reader.read()).value);
			assert.match(second, /after-connect/);
			assert.ok(BigInt(/id: (\d+)/.exec(second)![1]) > BigInt(cursor));
			assert.equal(second.includes("metadata"), false);
			abort.abort();
			assert.equal((await reader.read()).done, true);
			const nextAbort = new AbortController();
			const resumed = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, cursor, nextAbort.signal);
			const resumedReader = resumed.body!.getReader();
			await resumedReader.read();
			const replay = decode.decode((await resumedReader.read()).value);
			assert.match(replay, /after-connect/);
			assert.doesNotMatch(replay, /before-connect/);
			nextAbort.abort();
			await resumedReader.cancel();
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});

test("U151 revoked permissions close existing stream", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, "0", abort.signal, { pollMs: 20 });
		const reader = response.body!.getReader();
		await reader.read();
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner'");
		try {
			const closed = await Promise.race([reader.read(), new Promise<{ done: boolean }>((resolve) => setTimeout(() => resolve({ done: false }), 500))]);
			assert.equal(closed.done, true, "revoked stream must close promptly");
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});

test("U153 live stream emits fifteen second heartbeat", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, "0", abort.signal);
		const reader = response.body!.getReader();
		await reader.read();
		const start = Date.now();
		try {
			const value = await Promise.race([reader.read(), new Promise<{ value: Uint8Array }>((resolve) => setTimeout(() => resolve({ value: new Uint8Array() }), 16500))]);
			assert.match(new TextDecoder().decode(value.value), /heartbeat/, "fifteen second heartbeat must be emitted");
			assert.ok(Date.now() - start >= 14500);
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});

test("U150 expired cursor requests authorized HTTP resync", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const old = await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "old-event" });
		await db.query("UPDATE payloadbay.change_record SET created_at=clock_timestamp()-interval '2 days'");
		await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: "new-event" });
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, old, abort.signal);
		const reader = response.body!.getReader();
		await reader.read();
		try {
			const frame = new TextDecoder().decode((await reader.read()).value);
			assert.match(frame, /event: resync-required/, "expired cursor must request resync");
			assert.doesNotMatch(frame, /old-event|new-event/);
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});

test("U152 slow SSE consumer is disconnected at bounded output", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, "0", abort.signal, { pollMs: 10 });
		const reader = response.body!.getReader();
		await reader.read();
		await db.query("SELECT payloadbay.append_change('project',$1,'event.accepted',repeat('x',120)||n::text,'{}'::jsonb) FROM generate_series(1,1800)n", [scope.project]);
		await new Promise((resolve) => setTimeout(resolve, 1500));
		let total = 0;
		try {
			const drained = (async () => {
				while (true) {
					const next = await reader.read();
					if (next.done) return true;
					total += next.value.byteLength;
				}
			})();
			const done = await Promise.race([drained, new Promise((resolve) => setTimeout(() => resolve(false), 500))]);
			assert.equal(done, true, "slow consumer must be disconnected");
			assert.ok(total < 340000, "queued output must stay bounded");
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});

test("accessible event lists and live changes include project grants without granting workspace access", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope, seedEvent } = await import("../helpers/domain-fixtures.ts");
	const { listEvents } = await import("../../packages/domain/src/events.ts");
	const { appendChange } = await import("../../packages/domain/src/changes.ts");
	const { readChanges } = await import("../../packages/domain/src/live.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'viewer',ARRAY['metadata.read'])", [scope.project]);
		const id = await seedEvent(db, scope);
		await appendChange(db, { scope: { type: "project", id: scope.project }, kind: "event.accepted", resourceId: id });
		const actor = { userId: "fixture-owner" };
		const events = await listEvents(pool, actor, {});
		assert.equal(events.items.length, 1);
		assert.equal(events.items[0].projectId, scope.project);
		assert.equal((await listEvents(pool, actor, { workspaceId: scope.workspace })).items.length, 1);
		const changes = await readChanges(pool, actor, { scope: { type: "accessible", id: scope.installation }, after: "0" });
		assert.equal(changes.items.length, 1);
		assert.equal(changes.items[0].resourceId, id);
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner'");
		assert.equal((await listEvents(pool, actor, {})).items.length, 0);
		assert.equal((await readChanges(pool, actor, { scope: { type: "accessible", id: scope.installation }, after: "0" })).items.length, 0);
		await db.query("UPDATE payloadbay.admission SET active=false");
		await assert.rejects(readChanges(pool, actor, { scope: { type: "accessible", id: scope.installation }, after: "0" }), { code: "forbidden" });
	});
});

test("U155a installation OpenAPI publishes the actual project request schema and local token security", async () => {
	const { nextFixture } = await import("../helpers/next-fixture.ts");
	const { resourceInput } = await import("../../packages/contracts/src/resources.ts");
	await nextFixture(async ({ url }) => {
		const response = await fetch(url + "/api/openapi.json");
		assert.equal(response.status, 200, "installation must serve its machine-readable API contract");
		const document = await response.json();
		assert.equal(document.openapi, "3.1.0");
		assert.deepEqual(document.servers, [{ url: "/" }]);
		assert.deepEqual(document.components.securitySchemes.apiToken, { type: "http", scheme: "bearer", description: "A scoped Payload Bay API token. Permissions are intersected with the current user grants." });
		assert.deepEqual(document.paths["/api/v1/projects"].post.requestBody.content["application/json"].schema, z.toJSONSchema(resourceInput, { target: "draft-2020-12", io: "input" }));
		assert.deepEqual(document.paths["/api/v1/projects"].post.security, [{ apiToken: [] }, { session: [] }]);
		assert.equal(response.headers.get("cache-control"), "no-store");
	});
});

test("U155b OpenAPI covers exactly the versioned HTTP operations and their required path parameters", async () => {
	const { openApiDocument } = await import("../../packages/contracts/src/openapi.ts");
	const { execFileSync } = await import("node:child_process");
	const { readFileSync } = await import("node:fs");
	const files = execFileSync("rg", ["--files", "apps/web/src/app/api/v1"], { encoding: "utf8" }).trim().split("\n");
	const expected: string[] = [];
	const document = openApiDocument() as { paths: Record<string, Record<string, { parameters?: { in: string; name: string; required: boolean }[] }>> };
	for (const file of files.filter((file) => file.endsWith("/route.ts"))) {
		const path = file
			.replace("apps/web/src/app", "")
			.replace(/\/route\.ts$/, "")
			.replace(/\[([^\]]+)\]/g, "{$1}");
		const source = readFileSync(file, "utf8");
		for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) expected.push(`${match[1].toLowerCase()} ${path}`);
	}

	const actual = Object.entries(document.paths).flatMap(([path, operations]) => Object.keys(operations).map((method) => `${method} ${path}`));
	assert.deepEqual(actual.sort(), expected.sort(), "Every implemented API operation must be documented, with no invented routes");
	for (const [path, operations] of Object.entries(document.paths)) {
		const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
		for (const operation of Object.values(operations))
			assert.deepEqual(
				(operation.parameters ?? [])
					.filter((parameter) => parameter.in === "path" && parameter.required)
					.map((parameter) => parameter.name)
					.sort(),
				names,
				path,
			);
	}
});

test("U155c documented commands expose every JSON body and required concurrency or replay header", async () => {
	const { openApiDocument } = await import("../../packages/contracts/src/openapi.ts");
	const { execFileSync } = await import("node:child_process");
	const { readFileSync } = await import("node:fs");
	const ts = await import("typescript");
	const document = openApiDocument() as { paths: Record<string, Record<string, { requestBody?: { required: boolean; content: Record<string, { schema: unknown }> }; parameters: { in: string; name: string; required: boolean }[] }>> };
	const files = execFileSync("rg", ["--files", "apps/web/src/app/api/v1"], { encoding: "utf8" }).trim().split("\n");
	for (const file of files.filter((file) => file.endsWith("/route.ts"))) {
		const path = file
			.replace("apps/web/src/app", "")
			.replace(/\/route\.ts$/, "")
			.replace(/\[([^\]]+)\]/g, "{$1}");
		const tree = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
		for (const statement of tree.statements) {
			if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue;
			const operation = document.paths[path]?.[statement.name.text.toLowerCase()];
			if (!operation) continue;
			const body = statement.body.getText(tree);
			if (body.includes("readJson(request,")) {
				assert.equal(operation.requestBody?.required, true, `${statement.name.text} ${path} requires its JSON body in the console`);
				assert.ok(operation.requestBody?.content["application/json"].schema, path);
			}

			for (const [source, header] of [
				["version(request)", "if-match"],
				['get("idempotency-key")', "idempotency-key"],
			]) {
				if (body.includes(source))
					assert.ok(
						operation.parameters.some((parameter) => parameter.in === "header" && parameter.name === header && parameter.required),
						`${path} requires ${header}`,
					);
			}
		}

		if (path.endsWith("/replay")) {
			const parameter = document.paths[path].post.parameters.find((parameter) => parameter.name === "idempotency-key") as { schema: { pattern: string } } | undefined;
			if (parameter) {
				assert.equal(new RegExp(parameter.schema.pattern).test("review-key-123"), true);
				assert.equal(new RegExp(parameter.schema.pattern).test("invalid\nkey"), false);
			}
		}
	}
});

test("U155d OpenAPI exposes actual GET filters including repeated statuses and required UTC windows", async () => {
	const { openApiDocument } = await import("../../packages/contracts/src/openapi.ts");
	const { execFileSync } = await import("node:child_process");
	const { readFileSync } = await import("node:fs");
	const ts = await import("typescript");
	const document = openApiDocument();
	const files = execFileSync("rg", ["--files", "apps/web/src/app/api/v1"], { encoding: "utf8" }).trim().split("\n");
	for (const file of files.filter((file) => file.endsWith("/route.ts"))) {
		const path = file
			.replace("apps/web/src/app", "")
			.replace(/\/route\.ts$/, "")
			.replace(/\[([^\]]+)\]/g, "{$1}");
		const tree = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
		for (const statement of tree.statements) {
			if (!ts.isFunctionDeclaration(statement) || statement.name?.text !== "GET" || !statement.body) continue;
			const names = [...new Set([...statement.body.getText(tree).matchAll(/(?:\b(?:query|q)|\.searchParams)\.(?:get|getAll|has)\("([^\"]+)"\)/g)].map((match) => match[1]))];
			const actual = document.paths[path].get.parameters.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name);
			assert.deepEqual(actual.sort(), names.sort(), path + " query contract");
		}
	}

	const window = document.paths["/api/v1/organizations/{organizationId}/usage"].get.parameters.filter((parameter) => parameter.in === "query");
	assert.deepEqual(
		window
			.filter((parameter) => parameter.required)
			.map((parameter) => parameter.name)
			.sort(),
		["from", "to"],
	);
	const status = document.paths["/api/v1/events"].get.parameters.find((parameter) => parameter.name === "state") as unknown as { explode: boolean; schema: { type: string } };
	assert.equal(status.schema.type, "array");
	assert.equal(status.explode, true, "Multiple filters use state=failed_terminal&state=succeeded");
});

test("U154 metadata-only SSE sends references even when persisted changes contain private event data", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { streamChanges } = await import("../../packages/domain/src/live.ts");
	const { eventPayload } = await import("../../packages/domain/src/events.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		const privateBody = "synthetic-private-event-content";
		const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,$3,$3,'{}','text/plain') RETURNING id", [scope.endpoint, scope.publication, Buffer.from(privateBody)])).rows[0].id;
		await db.query("SELECT payloadbay.append_change('project',$1,'event.recorded',$2,$3::jsonb)", [scope.project, event, JSON.stringify({ capability: "metadata.read", payload: privateBody })]);
		await assert.rejects(eventPayload(pool, { userId: "fixture-owner" }, event), { code: "forbidden" });
		const abort = new AbortController();
		const response = await streamChanges(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }, "0", abort.signal, { pollMs: 20 });
		const reader = response.body!.getReader();
		try {
			await reader.read();
			const frame = new TextDecoder().decode((await reader.read()).value);
			assert.ok(frame.includes(event), "The authorized event reference must still arrive");
			assert.equal(frame.includes(privateBody), false, "Persisted private content must never be broadcast to metadata readers");
			const data = JSON.parse(
				frame
					.split("\n")
					.find((line) => line.startsWith("data: "))!
					.slice(6),
			);
			assert.deepEqual(Object.keys(data).sort(), ["cursor", "kind", "resourceId", "scope"]);
		} finally {
			abort.abort();
			await reader.cancel();
		}
	});
});
