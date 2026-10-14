import test from "node:test";
import assert from "node:assert/strict";
import { authFixture } from "../helpers/auth-fixtures.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { compile } from "../../apps/executor/src/compiler.ts";
import { execute } from "../../apps/executor/src/supervisor.ts";
import { receiveIngress } from "../../packages/domain/src/ingress.ts";

async function ingressFixture(body: string, run: (f: Parameters<Parameters<typeof authFixture>[0]>[0] & { scope: Awaited<ReturnType<typeof seedScope>>; key: string }) => Promise<void>) {
	await authFixture(async (f) => {
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const compiled = await compile({ stage: "ingress", body });
		const revision = (await f.db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", ["ingress", compiled.body, compiled.bodyDigest, compiled.sdkVersion, compiled.bundle, compiled.bundleDigest, JSON.stringify(compiled.sourceMap)])).rows[0].id;
		const publication = (await f.db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) SELECT endpoint_id,$1,processing_revision_id,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [revision, scope.publication])).rows[0].id;
		await f.db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [publication, scope.endpoint]);
		scope.publication = publication;
		const key = (await f.db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
		await run({ ...f, scope, key });
	});
}

const accepting = 'return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"stored"}});';
const options = { encryptionKey: "fixture-key", run: execute };

test("U85 accepted binary bytes are durable before acknowledgement", async () => {
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		const body = new Uint8Array([0, 255, 42, 128]);
		const response = await receiveIngress(
			pool,
			{
				key,
				body,
				headers: { "content-type": "application/octet-stream" },
				method: "POST",
				url: "https://fixture.test/ingress/" + key,
			},
			options,
		);
		assert.equal(response.status, 202, "accepted response requires durable transaction");
		const event = (await db.query("SELECT * FROM payloadbay.event")).rows[0];
		assert.deepEqual(event.original_body, Buffer.from(body));
		assert.deepEqual(event.accepted_body, Buffer.from(body));
		assert.equal(event.publication_id, scope.publication);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.receipt")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.dispatch")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n, 1);
	});
});

test("U93 reject produces no stored event or queued work", async () => {
	await ingressFixture('return ctx.reject({status:403,body:"denied"});', async ({ pool, db, key }) => {
		const response = await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.status, 403);
		for (const table of ["event", "receipt", "execution", "dispatch"]) assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay." + table)).rows[0].n, 0, "rejected ingress must not create work");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n, 0);
	});
});

test("U94 queue failure rolls back accepted event and acknowledgement", async () => {
	await ingressFixture(accepting, async ({ pool, db, key }) => {
		await db.query("CREATE OR REPLACE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture queue unavailable'; END $$");
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: new Uint8Array([42]),
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				options,
			),
			/fixture queue unavailable/,
		);
		for (const table of ["event", "receipt", "execution", "dispatch"]) assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay." + table)).rows[0].n, 0, "acceptance transaction must roll back");
	});
});

test("U105 continuous worker handles accepted event and records completion", async () => {
	const { processEventTask } = await import("../../apps/worker/src/tasks/process-event.ts");
	const { createRequire } = await import("node:module");
	const { run } = createRequire(new URL("../../apps/worker/package.json", import.meta.url))("graphile-worker") as typeof import("../../apps/worker/node_modules/graphile-worker");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	await ingressFixture(accepting, async (f) => {
		const processing = await compile({ stage: "processing", body: 'ctx.log.info("processing event");return ctx.complete();' });
		const revision = (await f.db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", ["processing", processing.body, processing.bodyDigest, processing.sdkVersion, processing.bundle, processing.bundleDigest, JSON.stringify(processing.sourceMap)])).rows[0].id;
		const publication = (await f.db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,$1,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [revision, f.scope.publication])).rows[0].id;
		await f.db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [publication, f.scope.endpoint]);
		const response = await receiveIngress(
			f.pool,
			{
				key: f.key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.status, 202);
		const worker = await run({
			pgPool: f.pool,
			noHandleSignals: true,
			pollInterval: 100,
			concurrency: 1,
			taskList: { process_event: processEventTask(f.pool, fixtureConfig(f), execute) },
		});
		try {
			let state = "";
			for (let i = 0; i < 50; i++) {
				state = (await f.db.query("SELECT state FROM payloadbay.execution")).rows[0].state;
				if (state === "succeeded") break;
				await new Promise((r) => setTimeout(r, 50));
			}

			assert.equal(state, "succeeded", "continuous worker must complete accepted execution");
			const execution = (await f.db.query("SELECT * FROM payloadbay.execution")).rows[0];
			assert.equal(execution.attempt_number, 1);
			assert.deepEqual(execution.final_result, { kind: "complete" });
		} finally {
			await worker.stop();
		}
	});
});

test("U78 generic HMAC template rejects altered raw bytes", async () => {
	const { hmacTemplate } = await import("../../packages/script-sdk/src/templates/hmac.ts");
	const { createHmac } = await import("node:crypto");
	const body = new Uint8Array([0, 255, 42]);
	const secret = "fixture-signing-key";
	const signature = createHmac("sha256", secret).update(body).digest("hex");
	const compiled = await compile({ stage: "ingress", body: hmacTemplate.body });
	const valid = await execute({ stage: "ingress", bundle: compiled.bundle, input: { request: { body, contentType: "application/octet-stream", headers: { "x-payloadbay-signature": signature } }, secrets: { SIGNING_SECRET: secret } } });
	assert.equal((valid.decision as { kind: string }).kind, "accept", "valid HMAC must accept exact bytes");
	const invalid = await execute({ stage: "ingress", bundle: compiled.bundle, input: { request: { body: new Uint8Array([0, 255, 43]), contentType: "application/octet-stream", headers: { "x-payloadbay-signature": signature } }, secrets: { SIGNING_SECRET: secret } } });
	assert.deepEqual(invalid.decision, { kind: "reject", response: { status: 401, body: "Invalid signature" } });
	const missing = await execute({ stage: "ingress", bundle: compiled.bundle, input: { request: { body, headers: { "x-payloadbay-signature": signature } }, secrets: {} } });
	assert.deepEqual(missing.decision, { kind: "reject", response: { status: 503, body: "Signing secret is not configured" } });
});

test("U87 exactly one MiB raw event is accepted intact", async () => {
	await ingressFixture(accepting, async ({ pool, db, key }) => {
		const body = new Uint8Array(1048576);
		body.fill(255);
		body[0] = 0;
		const response = await receiveIngress(
			pool,
			{
				key,
				body,
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.status, 202);
		const row = (await db.query("SELECT original_body,accepted_body FROM payloadbay.event")).rows[0];
		assert.deepEqual(row.original_body, Buffer.from(body));
		assert.deepEqual(row.accepted_body, Buffer.from(body));
	});
});

test("U88 oversized raw event is rejected before accepted work", async () => {
	await ingressFixture(accepting, async ({ pool, db, key }) => {
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: new Uint8Array(1048577),
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				{
					...options,
					run: async () => {
						throw Error("oversized request reached executor");
					},
				},
			),
			{ code: "body_too_large", status: 413 },
		);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 0);
	});
});

test("U79 explicitly unverified template accepts raw event without provider rules", async () => {
	const { unverifiedTemplate } = await import("../../packages/script-sdk/src/templates/unverified.ts");
	const compiled = await compile({ stage: "ingress", body: unverifiedTemplate.body });
	const body = new Uint8Array([0, 255, 42]);
	const result = await execute({ stage: "ingress", bundle: compiled.bundle, input: { request: { body, headers: {}, contentType: "application/octet-stream" }, secrets: {} } });
	assert.deepEqual(result.decision, { kind: "accept", event: { body, contentType: "application/octet-stream" }, response: { status: 202, body: "Accepted" } }, "unverified template must explicitly accept raw event");
});

test("U266 ingress cannot read or persist platform session credentials", async () => {
	await ingressFixture('return ctx.accept({event:{body:ctx.request.body,contentType:"application/octet-stream",metadata:{visibleHeaders:ctx.request.headers}},response:{status:202,body:"stored"}});', async ({ pool, db, key }) => {
		const headers = { cookie: "provider-state=allowed; better-auth.session_token=fixture-private-session; __Secure-better-auth.session_token=fixture-secure-session", authorization: "Bearer pb_" + "a".repeat(43), "x-provider-signature": "provider-signature" };
		const response = await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers,
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.status, 202);
		const row = (await db.query("SELECT headers,metadata FROM payloadbay.event")).rows[0];
		assert.equal(row.metadata.visibleHeaders.cookie, "provider-state=allowed", "platform session cookies must not reach configured scripts");
		assert.equal(row.metadata.visibleHeaders.authorization, undefined);
		assert.equal(row.headers.authorization, undefined);
		assert.equal(row.headers["x-provider-signature"], "provider-signature");
		assert.equal(JSON.stringify(row).includes("fixture-private-session"), false);
		assert.equal(JSON.stringify(row).includes("fixture-secure-session"), false);
	});
});

test("U269 paused delivery continues durable event acceptance without processing claim", async () => {
	const { setEndpointPaused } = await import("../../packages/domain/src/endpoints.ts");
	const { claimExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['endpoints.pause'])", [scope.project]);
		const paused = await setEndpointPaused(pool, { userId: "fixture-owner" }, { id: scope.endpoint, paused: true, expectedVersion: 1 });
		assert.equal(paused.paused, true, "delivery must be paused");
		const response = await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.status, 202);
		const execution = (await db.query("SELECT * FROM payloadbay.execution")).rows[0];
		assert.equal(await claimExecution(pool, execution.id, 1, "paused-worker"), null);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 1);
	});
});

test("U270 resume replaces unclaimed paused offer without waiting for deadline", async () => {
	const { setEndpointPaused } = await import("../../packages/domain/src/endpoints.ts");
	const { claimExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['endpoints.pause'])", [scope.project]);
		const actor = { userId: "fixture-owner" };
		await setEndpointPaused(pool, actor, { id: scope.endpoint, paused: true, expectedVersion: 1 });
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		const execution = (await db.query("SELECT * FROM payloadbay.execution")).rows[0];
		const before = (await db.query("SELECT claim_deadline_at>clock_timestamp() AS future FROM payloadbay.dispatch")).rows[0];
		assert.equal(before.future, true);
		await setEndpointPaused(pool, actor, { id: scope.endpoint, paused: false, expectedVersion: 2 });
		const fresh = (await db.query("SELECT dispatch_generation FROM payloadbay.execution")).rows[0];
		assert.equal(fresh.dispatch_generation, 2, "resume must replace queued offer promptly");
		assert.equal(await claimExecution(pool, execution.id, 1, "old-offer"), null);
		assert.ok(await claimExecution(pool, execution.id, 2, "resumed-worker"));
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.dispatch")).rows[0].n, 2);
	});
});

test("U115 raw event payload requires distinct payload permission", async () => {
	const { eventPayload } = await import("../../packages/domain/src/events.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([0, 255, 42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		const event = (await db.query("SELECT id FROM payloadbay.event")).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await assert.rejects(eventPayload(pool, { userId: "fixture-owner" }, event), { code: "forbidden" });
		await db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY['metadata.read','payload.read'] WHERE scope_id=$1", [scope.project]);
		const payload = await eventPayload(pool, { userId: "fixture-owner" }, event);
		assert.equal(payload.originalBody, Buffer.from([0, 255, 42]).toString("base64"));
		assert.equal(payload.encoding, "base64");
	});
});

test("U118 event inspection defaults to fifty records and preserves cursor precision", async () => {
	const { listEvents } = await import("../../packages/domain/src/events.ts");
	await ingressFixture(accepting, async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type,received_at) SELECT $1,$2,$3,$3,'{}','application/octet-stream','2026-10-14T01:00:00.123000Z'::timestamptz+n*interval '1 microsecond' FROM generate_series(1,51)n", [scope.endpoint, scope.publication, Buffer.from([42])]);
		const first = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project });
		assert.equal(first.items.length, 50, "event list must default to fifty");
		assert.ok(first.nextCursor);
		assert.equal(Reflect.get(first.items[0], "original_body"), undefined);
		const second = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, cursor: first.nextCursor! });
		assert.equal(second.items.length, 1, "cursor must retain database microsecond precision");
		assert.equal(second.nextCursor, null);
		assert.equal(new Set([...first.items, ...second.items].map((row: { id: string }) => row.id)).size, 51);
	});
});

test("U119 event inspection accepts a two-hundred record page", async () => {
	const { listEvents } = await import("../../packages/domain/src/events.ts");
	await ingressFixture(accepting, async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) SELECT $1,$2,$3,$3,'{}','application/octet-stream' FROM generate_series(1,201)", [scope.endpoint, scope.publication, Buffer.from([42])]);
		const list = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, limit: 200 });
		assert.equal(list.items.length, 200, "two-hundred limit must remain available");
		assert.ok(list.nextCursor);
	});
});

test("U120 event inspection refuses a limit above two hundred", async () => {
	const { listEvents } = await import("../../packages/domain/src/events.ts");
	await ingressFixture(accepting, async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await assert.rejects(listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, limit: 201 }), { code: "invalid_pagination", status: 400 });
	});
});

test("U273 acceptance includes durable change without private payload", async () => {
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		const body = Buffer.from("fixture-private-body");
		await receiveIngress(
			pool,
			{
				key,
				body,
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		const event = (await db.query("SELECT id FROM payloadbay.event")).rows[0].id;
		const changes = (await db.query("SELECT * FROM payloadbay.change_record")).rows;
		assert.equal(changes.length, 1, "accepted event must include durable live change");
		assert.equal(changes[0].scope_id, scope.project);
		assert.equal(changes[0].resource_id, event);
		assert.equal(changes[0].kind, "event.accepted");
		assert.equal(JSON.stringify(changes).includes("fixture-private-body"), false);
	});
});

test("U308 invalid native provider responses never commit accepted work", async () => {
	const { ingressHttp } = await import("../../packages/domain/src/ingress-http.ts");
	await ingressFixture(accepting, async ({ pool, db, key }) => {
		for (const response of [
			{ status: 204, body: "illegal body" },
			{ status: 200, body: "ok", headers: { "x-invalid": "漢" } },
			{ status: 200, body: "x".repeat(1048577) },
			{ status: 200, body: "ok", headers: { "x-overflow": "x".repeat(16385) } },
		]) {
			const result = await ingressHttp(pool, new Request("https://fixture.test/ingress/" + key, { method: "POST", body: "fixture" }), key, {
				encryptionKey: "fixture-key",
				run: async () => ({
					decision: { kind: "accept", event: { body: "would be stored", contentType: "text/plain" }, response },
					logs: [],
					durationMs: 1,
					peakRssBytes: 1,
				}),
			});
			assert.equal(result.status, 502);
			const counts = (await db.query("SELECT (SELECT count(*) FROM payloadbay.event) AS events,(SELECT count(*) FROM payloadbay.receipt) AS receipts,(SELECT count(*) FROM payloadbay.execution) AS executions")).rows[0];
			assert.deepEqual(counts, { events: "0", receipts: "0", executions: "0" }, "Invalid provider response must be rejected before durable acceptance");
		}
	});
});

test("U142 large resume batches remain bounded and recovery picks up the rest", async () => {
	const { setEndpointPaused } = await import("../../packages/domain/src/endpoints.ts");
	const { scheduleDispatch, recoverExpired } = await import("../../packages/domain/src/execution-lease.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await ingressFixture(accepting, async ({ pool, db, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['endpoints.pause'])", [scope.project]);
		const actor = { userId: "fixture-owner" };
		await setEndpointPaused(pool, actor, { id: scope.endpoint, paused: true, expectedVersion: 1 });
		const event = await seedEvent(db, scope);
		const executions = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,due_at) SELECT $1,$2,$3,clock_timestamp()-interval '1 hour' FROM generate_series(1,101) RETURNING *", [event, scope.endpoint, scope.publication])).rows;
		for (const execution of executions) await scheduleDispatch(db, execution, 0);
		await setEndpointPaused(pool, actor, { id: scope.endpoint, paused: false, expectedVersion: 2 });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution WHERE dispatch_generation=2")).rows[0].n, 100, "Resume must enqueue a bounded batch");
		const recovered = await recoverExpired(pool);
		assert.equal(recovered.length, 1, "The remaining old offer must be eligible immediately");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution WHERE dispatch_generation=2")).rows[0].n, 101);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.dispatch d JOIN payloadbay.execution e ON e.id=d.execution_id AND e.dispatch_generation=d.generation WHERE d.claim_deadline_at>clock_timestamp()")).rows[0].n, 101);
	});
});
