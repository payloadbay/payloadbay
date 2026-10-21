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

test("U93 reject records the inbound request without queued work", async () => {
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
		const recorded = (await db.query("SELECT ingress_outcome,response_status,original_body FROM payloadbay.event")).rows;
		assert.equal(recorded.length, 1);
		assert.equal(recorded[0].ingress_outcome, "reject");
		assert.equal(recorded[0].response_status, 403);
		assert.deepEqual(recorded[0].original_body, Buffer.from([42]));
		for (const table of ["receipt", "execution", "dispatch"]) assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay." + table)).rows[0].n, 0, "rejected ingress must not create work");
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
		const { executorFixture } = await import("../helpers/executor-fixture.ts");
		const executor = await executorFixture();
		try {
			const worker = await run({
				pgPool: f.pool,
				noHandleSignals: true,
				pollInterval: 100,
				concurrency: 1,
				taskList: { process_event: processEventTask(f.pool, { ...fixtureConfig(f), executorUrl: executor.url }) },
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
		} finally {
			await executor.stop();
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
			const counts = (await db.query("SELECT (SELECT count(*) FROM payloadbay.event WHERE ingress_outcome='accept') AS events,(SELECT count(*) FROM payloadbay.receipt) AS receipts,(SELECT count(*) FROM payloadbay.execution) AS executions")).rows[0];
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

test("response-only requests remain inspectable without creating delivery work", async () => {
	const { listEvents, eventDetails } = await import("../../packages/domain/src/events.ts");
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	await ingressFixture('return ctx.respondOnly({status:200,body:"challenge"});', async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read','events.replay'])", [scope.project]);
		const response = await receiveIngress(
			pool,
			{
				key,
				body: Buffer.from("challenge request"),
				headers: {},
				method: "GET",
				url: "https://fixture.test",
			},
			options,
		);
		assert.equal(response.body, "challenge");
		const list = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, state: "respondOnly" });
		assert.equal(list.items.length, 1);
		assert.equal(list.items[0].state, "respondOnly");
		const details = await eventDetails(pool, { userId: "fixture-owner" }, list.items[0].id);
		assert.equal(details.method, "GET");
		assert.equal(details.responseStatus, 200);
		assert.equal(details.executions.length, 0);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.change_record WHERE kind='event.recorded'")).rows[0].n, 1);
		await assert.rejects(replayEvent(pool, { userId: "fixture-owner" }, { eventId: list.items[0].id, key: "fixture-replay" }), { code: "request_not_accepted" });
	});
});

test("overview aggregates exact traffic and keeps projects outside membership private", async () => {
	const { dashboardOverview } = await import("../../packages/domain/src/overview.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await receiveIngress(
			pool,
			{
				key,
				body: Buffer.from("visible"),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			options,
		);
		const hiddenProject = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Hidden','hidden','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		const hiddenEndpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Hidden','hidden',gen_random_uuid()::text) RETURNING id", [hiddenProject])).rows[0].id;
		const hiddenPublication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) SELECT $1,ingress_revision_id,processing_revision_id,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [hiddenEndpoint, scope.publication])).rows[0].id;
		const other = { endpoint: hiddenEndpoint, publication: hiddenPublication };
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await seedEvent(db, other);
		const summary = await dashboardOverview(pool, { userId: "fixture-owner" });
		assert.equal(summary.series.length, 24);
		assert.equal(summary.totals.ingress, 1);
		assert.equal(summary.totals.accepted, 1);
		assert.equal(summary.totals.executions, 1);
		assert.equal(summary.recent.length, 1);
		assert.equal(summary.recent[0].project_id, scope.project);
		const execution = summary.recent[0].id;
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'delivery','fixture','{}',1)", [execution]);
		await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,started_at,ended_at,status_code) VALUES($1,'delivery',1,1,now()-interval '2 seconds',now()-interval '1 second',500),($1,'delivery',2,1,now(),now(),204)", [execution]);
		const { listEvents } = await import("../../packages/domain/src/events.ts");
		const attempts = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, view: "attempts", limit: 1 });
		assert.equal(attempts.items.length, 1);
		assert.equal(attempts.items[0].state, "delivered");
		assert.ok(attempts.nextCursor);
		const older = await listEvents(
			pool,
			{ userId: "fixture-owner" },
			{
				projectId: scope.project,
				view: "attempts",
				limit: 1,
				cursor: attempts.nextCursor!,
			},
		);
		assert.equal(older.items[0].state, "delivery_failed");
		assert.notEqual(older.items[0].id, attempts.items[0].id);
		assert.equal(older.items[0].eventId, attempts.items[0].eventId);
		const failedOnly = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, view: "attempts", states: ["delivery_failed"] });
		assert.equal(failedOnly.items.length, 1);
		assert.equal(failedOnly.items[0].state, "delivery_failed");
		const both = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, view: "attempts", states: ["delivered", "delivery_failed"] });
		assert.equal(both.items.length, 2);
		const empty = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, states: ["reject", "error"] });
		assert.deepEqual(empty.items, []);
		const { deliveryAttemptDetails } = await import("../../packages/domain/src/events.ts");
		await db.query("UPDATE payloadbay.delivery_attempt SET response_body=$2 WHERE id=$1", [older.items[0].id, Buffer.from("Receiver unavailable")]);
		const metadataOnly = await deliveryAttemptDetails(pool, { userId: "fixture-owner" }, older.items[0].id);
		assert.equal(metadataOnly.status, 500);
		assert.equal("responseBody" in metadataOnly, false);
		await db.query("UPDATE payloadbay.grant_record SET permissions=array_append(permissions,'payload.read') WHERE user_id='fixture-owner' AND scope_id=$1", [scope.project]);
		const inspected = await deliveryAttemptDetails(pool, { userId: "fixture-owner" }, older.items[0].id);
		assert.equal(Buffer.from(inspected.responseBody!, "base64").toString(), "Receiver unavailable");

		const updated = await dashboardOverview(pool, { userId: "fixture-owner" });
		assert.equal(updated.totals.deliveries, 2);
		assert.equal(updated.totals.delivered, 1);
		assert.equal(updated.totals.failed, 1);
	});
});

test("bounded handler failures remain visible without granting delivery authority", async () => {
	const { listEvents } = await import("../../packages/domain/src/events.ts");
	await ingressFixture('throw new Error("private runtime detail");', async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project]);
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: Buffer.from("retain me"),
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				options,
			),
		);
		const page = await listEvents(pool, { userId: "fixture-owner" }, { projectId: scope.project, state: "error" });
		assert.equal(page.items.length, 1);
		assert.equal(page.items[0].state, "error");
		assert.equal(JSON.stringify(page).includes("private runtime detail"), false);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 0);
		const stored = (await db.query("SELECT original_body FROM payloadbay.event")).rows[0];
		assert.equal(stored.original_body.toString(), "retain me");
	});
});

test("FT08a accepted ingress commits one logical execution and attributed usage facts", async () => {
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test/ingress",
			},
			options,
		);
		const facts = (await db.query("SELECT metric,organization_id,workspace_id,project_id,quantity::text FROM payloadbay.usage_fact ORDER BY metric")).rows;
		assert.deepEqual(
			facts.map((fact) => fact.metric),
			["execution.created", "ingress.accepted", "ingress.recorded"],
		);
		for (const fact of facts) {
			assert.equal(fact.organization_id, scope.organization);
			assert.equal(fact.workspace_id, scope.workspace);
			assert.equal(fact.project_id, scope.project);
			assert.equal(fact.quantity, "1");
		}
	});
});

test("FT08b recovery and duplicate claims count attempts without recreating logical executions", async () => {
	const { claimExecution, heartbeat, recoverExpired, finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test/ingress",
			},
			options,
		);
		const execution = (await db.query("SELECT id FROM payloadbay.execution")).rows[0];
		const claims = await Promise.all([claimExecution(pool, execution.id, 1, "worker-a"), claimExecution(pool, execution.id, 1, "worker-b")]);
		assert.equal(claims.filter(Boolean).length, 1);
		const winner = claims.find(Boolean)!;
		assert.equal(
			await heartbeat(pool, {
				executionId: execution.id,
				endpointId: scope.endpoint,
				generation: 1,
				owner: winner.lease_owner,
			}),
			true,
		);
		await db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()-interval '1 second' WHERE id=$1", [execution.id]);
		await recoverExpired(pool);
		const next = await claimExecution(pool, execution.id, 2, "worker-c");
		assert.equal(next.attempt_number, 2);
		const authority = {
			executionId: execution.id,
			endpointId: scope.endpoint,
			generation: 2,
			owner: "worker-c",
		};
		await finishExecution(pool, authority, { kind: "complete" });
		await assert.rejects(finishExecution(pool, authority, { kind: "complete" }), { code: "stale_execution" });
		const totals = Object.fromEntries((await db.query("SELECT metric,quantity::text FROM payloadbay.usage_counter")).rows.map((row) => [row.metric, row.quantity]));
		assert.equal(totals["execution.created"], "1");
		assert.equal(totals["processing.attempt.started"], "2");
		assert.equal(totals["execution.succeeded"], "1");
	});
});

test("FT08d an idempotent replay creates one additional logical execution", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, rolePermissions.owner]);
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test/ingress",
			},
			options,
		);
		const event = (await db.query("SELECT id FROM payloadbay.event")).rows[0];
		const input = { eventId: event.id, key: "fixture-replay" };
		const first = await replayEvent(pool, { userId: "fixture-owner" }, input);
		const second = await replayEvent(pool, { userId: "fixture-owner" }, input);
		assert.equal(first.id, second.id);
		assert.equal(second.reused, true);
		const totals = Object.fromEntries((await db.query("SELECT metric,quantity::text FROM payloadbay.usage_counter")).rows.map((row) => [row.metric, row.quantity]));
		assert.equal(totals["execution.created"], "2");
		assert.equal(totals["execution.replayed"], "1");
		assert.equal(totals["ingress.accepted"], "1");
	});
});

test("FT08c an exhausted recovered execution records one terminal failure", async () => {
	const { claimExecution, recoverExpired } = await import("../../packages/domain/src/execution-lease.ts");
	await ingressFixture(accepting, async ({ pool, db, key }) => {
		await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: {},
				method: "POST",
				url: "https://fixture.test/ingress",
			},
			{ ...options, maxAttempts: 1 },
		);
		const execution = (await db.query("SELECT id FROM payloadbay.execution")).rows[0];
		assert.ok(await claimExecution(pool, execution.id, 1, "worker-a"));
		await db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()-interval '1 second' WHERE id=$1", [execution.id]);
		await recoverExpired(pool);
		await recoverExpired(pool);
		assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [execution.id])).rows[0].state, "failed_terminal");
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.usage_counter WHERE metric='execution.failed'")).rows[0].quantity, "1");
	});
});

test("FT03d archived organizations cannot continue receiving new ingress", async () => {
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("UPDATE payloadbay.organization SET archived_at=clock_timestamp() WHERE id=$1", [scope.organization]);
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: new Uint8Array([42]),
					headers: {},
					method: "POST",
					url: "https://fixture.test/ingress",
				},
				options,
			),
			{ code: "ingress_unavailable" },
		);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 0);
	});
});

test("FT09e admission quota is atomic and a downgrade retains accepted recovery work", async () => {
	const { setOrganizationPolicy } = await import("../../packages/domain/src/organization-policy.ts");
	const { rolePermissions } = await import("../../packages/domain/src/authorization.ts");
	const { claimExecution, finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await ingressFixture(accepting, async ({ pool, db, key, scope }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, rolePermissions.owner]);
		const admission = { limit: 1, from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 3600000).toISOString() };
		const input = {
			organizationId: scope.organization,
			expectedVersion: 0,
			limits: { workspaces: null, projects: null, admission },
			processingConcurrency: 4,
		};
		await setOrganizationPolicy(pool, { userId: "fixture-owner" }, input);
		const responses = await Promise.all(
			Array.from({ length: 3 }, () =>
				receiveIngress(
					pool,
					{
						key,
						body: new Uint8Array([42]),
						headers: {},
						method: "POST",
						url: "https://fixture.test/ingress",
					},
					options,
				),
			),
		);
		assert.deepEqual(
			responses.map((response) => response.status).sort((a, b) => a - b),
			[202, 429, 429],
		);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 3);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.receipt")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n, 1);
		const totals = Object.fromEntries((await db.query("SELECT metric,quantity::text FROM payloadbay.usage_counter")).rows.map((row) => [row.metric, row.quantity]));
		assert.equal(totals["ingress.recorded"], "3");
		assert.equal(totals["ingress.accepted"], "1");
		await setOrganizationPolicy(pool, { userId: "fixture-owner" }, { ...input, expectedVersion: 1, limits: { ...input.limits, admission: { ...admission, limit: 0 } } });
		const execution = (await db.query("SELECT id FROM payloadbay.execution")).rows[0];
		assert.ok(await claimExecution(pool, execution.id, 1, "worker-after-downgrade"));
		await finishExecution(
			pool,
			{
				executionId: execution.id,
				endpointId: scope.endpoint,
				generation: 1,
				owner: "worker-after-downgrade",
			},
			{ kind: "complete" },
		);
		assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [execution.id])).rows[0].state, "succeeded");
	});
});

test("FT08f oversized transformed events retain the bounded raw request as a recorded handler error", async () => {
	await ingressFixture('return ctx.accept({event:{body:new Uint8Array(9),contentType:"text/plain"},response:{status:202,body:"ok"}});', async ({ pool, db, key }) => {
		const raw = new Uint8Array([0, 255, 42]);
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: raw,
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				{ ...options, bodyLimit: 8 },
			),
			{ code: "body_too_large", status: 413 },
		);
		const recorded = (await db.query("SELECT original_body,ingress_outcome FROM payloadbay.event")).rows[0];
		assert.equal(recorded?.ingress_outcome, "error");
		assert.deepEqual(recorded.original_body, Buffer.from(raw));
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.usage_counter WHERE metric='ingress.recorded'")).rows[0].quantity, "1");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.receipt")).rows[0].n, 0);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 0);
	});
});

test("CF09 historical platform helper bundles are blocked before ingress and processing execute", async () => {
	const { processEventTask } = await import("../../apps/worker/src/tasks/process-event.ts");
	const { fixtureConfig } = await import("../helpers/auth-fixtures.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await authFixture(async (fixture) => {
		const { pool, db } = fixture;
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const helper = (await db.query("INSERT INTO payloadbay.shared_module_revision(scope_type,scope_id,name,source,source_digest,bundle_digest) VALUES('instance',$1,'Legacy','export const x = 1','source','bundle') RETURNING id", [scope.installation])).rows[0].id;
		const manifests = { ingress: { modules: { Legacy: helper } }, processing: { modules: { Legacy: helper } } };
		const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,shared_versions,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,$1,'old-global-helper','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [JSON.stringify(manifests), scope.publication])).rows[0].id;
		await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [publication, scope.endpoint]);
		const key = (await db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
		let called = false;

		const run = async () => {
			called = true;
			throw Error("Private input reached platform code");
		};

		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					url: "https://fixture.test/ingress",
					body: new Uint8Array([42]),
					headers: {},
					method: "POST",
				},
				{ ...options, run },
			),
			{ code: "publication_scope_changed" },
		);
		assert.equal(called, false);
		assert.equal((await db.query("SELECT ingress_outcome FROM payloadbay.event")).rows[0].ingress_outcome, "error");
		const event = await seedEvent(db, { endpoint: scope.endpoint, publication });
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, publication])).rows[0].id;
		await processEventTask(pool, fixtureConfig(fixture), run)({ executionId: execution, endpointId: scope.endpoint, generation: 1 });
		assert.equal(called, false);
		assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [execution])).rows[0].state, "retry_wait");
	});
});

test("request protection stores encrypted rules and blocks before scripts without losing event history", async () => {
	const { getIngressPolicy, saveIngressPolicy } = await import("../../packages/domain/src/ingress-policy.ts");
	const { ingressPolicy, browserBlockingRules } = await import("../../packages/contracts/src/ingress-policy.ts");
	await ingressFixture(accepting, async ({ pool, db, scope, key }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['endpoints.configure'])", [scope.project]);
		const actor = { userId: "fixture-owner" };
		assert.equal((await getIngressPolicy(pool, actor, scope.endpoint, options.encryptionKey)).version, 0);
		const policy = ingressPolicy.parse({ enabled: true, rules: browserBlockingRules() });
		await saveIngressPolicy(pool, actor, scope.endpoint, { expectedVersion: 0, policy }, options.encryptionKey);
		const stored = (await db.query("SELECT encrypted_policy FROM payloadbay.ingress_policy WHERE endpoint_id=$1", [scope.endpoint])).rows[0].encrypted_policy;
		assert.equal(stored.includes(Buffer.from("Mozilla/")), false);
		assert.equal(JSON.stringify((await db.query("SELECT redacted_diff FROM payloadbay.audit WHERE operation='endpoint.protection_changed'")).rows).includes("Mozilla/"), false);
		assert.deepEqual((await getIngressPolicy(pool, actor, scope.endpoint, options.encryptionKey)).policy, policy);
		await assert.rejects(saveIngressPolicy(pool, actor, scope.endpoint, { expectedVersion: 0, policy }, options.encryptionKey), { code: "version_conflict" });
		let executed = false;
		const response = await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array([42]),
				headers: { "User-Agent": "Mozilla/5.0" },
				method: "POST",
				url: "https://fixture.test",
			},
			{
				...options,
				run: async () => {
					executed = true;
					throw Error("must not run");
				},
			},
		);
		assert.equal(response.status, 403);
		assert.equal(executed, false);
		assert.deepEqual((await db.query("SELECT ingress_outcome,response_status FROM payloadbay.event")).rows, [{ ingress_outcome: "reject", response_status: 403 }]);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 0);
		await db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY['metadata.read'] WHERE scope_id=$1", [scope.project]);
		await assert.rejects(getIngressPolicy(pool, actor, scope.endpoint, options.encryptionKey), { code: "forbidden" });
		await assert.rejects(saveIngressPolicy(pool, actor, scope.endpoint, { expectedVersion: 1, policy }, options.encryptionKey), { code: "forbidden" });
		await db.query("UPDATE payloadbay.ingress_policy SET encrypted_policy=$1 WHERE endpoint_id=$2", [Buffer.from([0]), scope.endpoint]);
		await assert.rejects(
			receiveIngress(
				pool,
				{
					key,
					body: new Uint8Array(),
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				options,
			),
		);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event WHERE ingress_outcome='error'")).rows[0].n, 1);
	});
});

test("route quota is atomic across concurrent requests and resets using database time", async () => {
	const { saveIngressPolicy, checkIngressPolicy } = await import("../../packages/domain/src/ingress-policy.ts");
	const { ingressPolicy } = await import("../../packages/contracts/src/ingress-policy.ts");
	await ingressFixture(accepting, async ({ pool, db, scope, key }) => {
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['endpoints.configure'])", [scope.project]);
		const actor = { userId: "fixture-owner" };
		const policy = ingressPolicy.parse({ rateLimit: { enabled: true, requests: 2, windowSeconds: 60 } });
		await saveIngressPolicy(pool, actor, scope.endpoint, { expectedVersion: 0, policy }, options.encryptionKey);
		const results = await Promise.all(Array.from({ length: 10 }, () => checkIngressPolicy(pool, scope.endpoint, {}, options.encryptionKey)));
		assert.equal(results.filter((result) => result === null).length, 2);
		assert.equal(results.filter((result) => result?.status === 429).length, 8);
		const response = await receiveIngress(
			pool,
			{
				key,
				body: new Uint8Array(),
				headers: {},
				method: "POST",
				url: "https://fixture.test",
			},
			{
				...options,
				run: async () => {
					throw Error("must not run");
				},
			},
		);
		assert.equal(response.status, 429);
		assert.ok(Number(response.headers?.["retry-after"]) > 0);
		await db.query("UPDATE payloadbay.ingress_rate_bucket SET window_start=clock_timestamp()-interval '61 seconds' WHERE endpoint_id=$1", [scope.endpoint]);
		assert.equal(await checkIngressPolicy(pool, scope.endpoint, {}, options.encryptionKey), null);
		await saveIngressPolicy(pool, actor, scope.endpoint, { expectedVersion: 1, policy: { ...policy, rateLimit: { ...policy.rateLimit, enabled: false } } }, options.encryptionKey);
		assert.equal(await checkIngressPolicy(pool, scope.endpoint, {}, options.encryptionKey), null);
	});
});
