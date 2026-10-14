import test from "node:test";
import assert from "node:assert/strict";
import { withFixtures } from "../../scripts/tests/fixtures.ts";
import { prepareDevelopmentDatabase as migrate } from "../../packages/domain/src/development.ts";
import { database } from "../../packages/domain/src/db.ts";
import { seedScope, seedEvent } from "../helpers/domain-fixtures.ts";
import { claimExecution, type Authority } from "../../packages/domain/src/execution-lease.ts";
import { managedSend } from "../../packages/domain/src/delivery.ts";
import type { Pool, PoolClient } from "pg";

type DeliveryFixtureData = {
	pool: Pool;
	db: PoolClient;
	authority: Authority;
	httpUrl: string;
};

async function deliveryFixture(run: (f: DeliveryFixtureData) => Promise<void>) {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			const scope = await seedScope(db);
			await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			const snapshot = {
				"fixture-target": {
					id: "fixture-target",
					name: "primary",
					httpConfig: { url: f.httpUrl + "/delivery", method: "POST" },
					secretRefs: [],
					concurrency: 4,
					version: 1,
				},
			};
			scope.publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,$1,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [JSON.stringify(snapshot), scope.publication])).rows[0].id;
			const event = await seedEvent(db, scope);
			const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
			await claimExecution(pool, execution, 1, "fixture-worker");
			await run({
				pool,
				db,
				httpUrl: f.httpUrl,
				authority: {
					executionId: execution,
					endpointId: scope.endpoint,
					generation: 1,
					owner: "fixture-worker",
				},
			});
		} finally {
			db.release();
			await pool.end();
		}
	});
}

test("U96 managed configured destination returns real HTTP success", async () => {
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const bytes = new Uint8Array([0, 255, 42]);
		const result = await managedSend(pool, authority, "primary", { operationId: "primary-send", body: bytes });
		assert.equal(result.ok, true, "managed result must reflect actual HTTP success");
		assert.equal(result.status, 200);
		const receipts = await (await fetch(httpUrl + "/receipts")).json();
		assert.equal(receipts.length, 1);
		assert.equal(receipts[0].body, Buffer.from(bytes).toString("base64"));
		const operation = (await db.query("SELECT * FROM payloadbay.managed_operation")).rows[0];
		assert.equal(operation.state, "succeeded");
		assert.equal(operation.successful_attempt_id, result.attemptId);
		const attempt = (await db.query("SELECT * FROM payloadbay.delivery_attempt")).rows[0];
		assert.equal(attempt.status_code, 200);
		assert.ok(attempt.ended_at);
	});
});

test("U99 operation ID cannot change its request content", async () => {
	await deliveryFixture(async ({ pool, authority, httpUrl }) => {
		await managedSend(pool, authority, "primary", { operationId: "stable", body: "first" });
		await assert.rejects(managedSend(pool, authority, "primary", { operationId: "stable", body: "changed" }), { code: "operation_input_changed" });
		assert.equal((await (await fetch(httpUrl + "/receipts")).json()).length, 1);
	});
});

test("U100 fresh recovery generation reuses committed HTTP success", async () => {
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const input = { operationId: "stable", body: "fixture" };
		const first = await managedSend(pool, authority, "primary", input);
		await db.query("UPDATE payloadbay.execution SET dispatch_generation=2,lease_owner='recovered-worker',attempt_number=2,lease_expiry=clock_timestamp()+interval '30 seconds' WHERE id=$1", [authority.executionId]);
		const second = await managedSend(pool, { ...authority, generation: 2, owner: "recovered-worker" }, "primary", input);
		assert.equal(second.reused, true, "recovery must reuse committed success");
		assert.equal(second.attemptId, first.attemptId);
		assert.equal((await (await fetch(httpUrl + "/receipts")).json()).length, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.delivery_attempt")).rows[0].n, 1);
	});
});

test("U251 HTTP broker requires current signed execution authority", async () => {
	const { createBroker } = await import("../../apps/worker/src/broker.ts");
	const { mintBrokerToken } = await import("../../packages/domain/src/broker-auth.ts");
	const { packWire, unpackWire } = await import("../../packages/contracts/src/wire.ts");
	const { createRequire } = await import("node:module");
	const { once } = createRequire(import.meta.url)("node:events") as { once: (target: unknown, event: string) => Promise<unknown> };
	await deliveryFixture(async ({ pool, authority, httpUrl }) => {
		const config = { brokerSecret: "fixture-broker-key", httpTimeoutMs: 1000 };
		const server = createBroker(pool, config as Parameters<typeof createBroker>[1]);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const url = "http://127.0.0.1:" + (server.address() as { port: number }).port + "/broker";
		try {
			const body = new Uint8Array([0, 255, 42]);
			const token = mintBrokerToken(config.brokerSecret, authority, Date.now() + 10000);
			const response = await fetch(url, { method: "POST", headers: { authorization: "Bearer " + token }, body: JSON.stringify(packWire({ target: "primary", input: { operationId: "broker-send", body } })) });
			assert.equal(response.status, 200, "valid live broker capability must send");
			assert.equal((unpackWire(await response.json()) as { ok: boolean }).ok, true);
			const forged = await fetch(url, { method: "POST", headers: { authorization: "Bearer " + token + "tampered" }, body: "{}" });
			assert.equal(forged.status, 403);
			const stale = mintBrokerToken(config.brokerSecret, { ...authority, generation: 2 }, Date.now() + 10000);
			const rejected = await fetch(url, { method: "POST", headers: { authorization: "Bearer " + stale }, body: JSON.stringify(packWire({ target: "primary", input: { operationId: "forbidden-send", body } })) });
			assert.equal(rejected.status, 403);
			assert.equal((await (await fetch(httpUrl + "/receipts")).json()).length, 1);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((r) => server.close(() => r()));
		}
	});
});

test("U254 first destination is default and explicit switch is atomic", async () => {
	const { createDestination } = await import("../../packages/domain/src/destinations.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const project = (await db.query("SELECT project_id FROM payloadbay.endpoint WHERE id=$1", [authority.endpointId])).rows[0].project_id;
		const installation = (await db.query("SELECT id FROM payloadbay.installation")).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const first = await createDestination(pool, actor, { projectId: project, name: "App", url: httpUrl + "/delivery" });
		assert.equal(first.is_default, true, "first destination must become default");
		const second = await createDestination(pool, actor, { projectId: project, name: "Discord", url: "http://192.168.0.1/webhook" });
		assert.equal(second.is_default, false);
		const third = await createDestination(pool, actor, {
			projectId: project,
			name: "New app",
			url: "http://100.64.0.1/events",
			isDefault: true,
		});
		assert.equal(third.is_default, true);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.destination WHERE project_id=$1 AND is_default", [project])).rows[0].n, 1);
		assert.equal((await db.query("SELECT is_default FROM payloadbay.destination WHERE id=$1", [first.id])).rows[0].is_default, false);
	});
});

test("U255 pinned explicit default wins over legacy default name", async () => {
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const snapshot = {
			old: {
				id: "old",
				name: "default",
				isDefault: false,
				httpConfig: { url: httpUrl + "/old" },
			},
			selected: {
				id: "selected",
				name: "App",
				isDefault: true,
				httpConfig: { url: httpUrl + "/selected" },
			},
		};
		const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,$1,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=(SELECT publication_id FROM payloadbay.execution WHERE id=$2) RETURNING id", [JSON.stringify(snapshot), authority.executionId])).rows[0].id;
		await db.query("UPDATE payloadbay.execution SET publication_id=$1 WHERE id=$2", [publication, authority.executionId]);
		const result = await managedSend(pool, authority, "default", { operationId: "default-send", body: "fixture" });
		assert.equal(result.ok, true);
		const receipts = await (await fetch(httpUrl + "/receipts")).json();
		assert.equal(receipts[0].path, "/selected", "published default must determine routing");
	});
});

test("U256 stale destination editor cannot overwrite saved target", async () => {
	const { createDestination, updateDestination, getDestination } = await import("../../packages/domain/src/destinations.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const projectId = (await db.query("SELECT project_id FROM payloadbay.endpoint WHERE id=$1", [authority.endpointId])).rows[0].project_id;
		const installation = (await db.query("SELECT id FROM payloadbay.installation")).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const created = await createDestination(pool, actor, { projectId, name: "App", url: httpUrl + "/original" });
		const input = {
			projectId,
			id: created.id,
			name: "App",
			url: httpUrl + "/new",
			expectedVersion: created.version,
		};
		const result = await updateDestination(pool, actor, input);
		assert.equal(result.version, 2);
		await assert.rejects(updateDestination(pool, actor, { ...input, url: httpUrl + "/lost-update" }), { code: "version_conflict" });
		assert.equal((await getDestination(pool, actor, created.id)).http.url, httpUrl + "/new");
	});
});

test("U97 non-success HTTP response remains a failed recorded attempt", async () => {
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const result = await managedSend(pool, authority, { url: httpUrl + "/status/503" }, { operationId: "outage", body: "fixture" });
		assert.equal(result.ok, false, "non-2xx must be a failed send");
		assert.equal(result.status, 503);
		assert.equal((await db.query("SELECT state FROM payloadbay.managed_operation")).rows[0].state, "failed");
		assert.equal((await db.query("SELECT status_code FROM payloadbay.delivery_attempt")).rows[0].status_code, 503);
	});
});

test("U103 managed destination redirect is recorded without following it", async () => {
	await deliveryFixture(async ({ pool, authority, httpUrl }) => {
		const result = await managedSend(pool, authority, { url: httpUrl + "/redirect" }, { operationId: "redirect", body: "fixture" });
		assert.equal(result.status, 302, "managed redirects must not be followed");
		assert.equal(result.ok, false);
		const receipts = await (await fetch(httpUrl + "/receipts")).json();
		assert.equal(receipts.length, 1);
		assert.equal(receipts[0].path, "/redirect");
	});
});

test("U101 retrying failed operation creates another retained attempt", async () => {
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const target = { url: httpUrl + "/status/503" };
		const input = { operationId: "retryable", body: "fixture" };
		const first = await managedSend(pool, authority, target, input);
		const before = (await db.query("SELECT row_to_json(a) AS row FROM payloadbay.delivery_attempt a WHERE id=$1", [first.attemptId])).rows[0].row;
		const second = await managedSend(pool, authority, target, input);
		assert.equal(second.ok, false);
		assert.notEqual(second.attemptId, first.attemptId, "failed operation needs a new attempt");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.delivery_attempt")).rows[0].n, 2);
		assert.deepEqual((await db.query("SELECT row_to_json(a) AS row FROM payloadbay.delivery_attempt a WHERE id=$1", [first.attemptId])).rows[0].row, before);
	});
});

test("A10 optional destination failure does not override authored success policy", async () => {
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const { finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const script = await compile({ stage: "processing", body: `const required=await ctx.destinations.send("primary",{operationId:"app",body:ctx.event.body});await ctx.destinations.send({url:${JSON.stringify(httpUrl + "/status/503")}},{operationId:"optional-discord",body:"purchase notification"});return required.ok?ctx.complete():ctx.retry({reason:"app unavailable"});` });
		const result = await execute({
			stage: "processing",
			bundle: script.bundle,
			input: { event: { body: new Uint8Array([42]) } },
			broker: (target, input) => managedSend(pool, authority, target as Parameters<typeof managedSend>[2], input as Parameters<typeof managedSend>[3]),
		});
		assert.deepEqual(result.decision, { kind: "complete" });
		await finishExecution(pool, authority, result.decision as { kind: "complete" });
		assert.equal((await db.query("SELECT state FROM payloadbay.execution")).rows[0].state, "succeeded", "optional failure must not override user policy");
		const operations = (await db.query("SELECT operation_id,state FROM payloadbay.managed_operation ORDER BY operation_id")).rows;
		assert.deepEqual(operations, [
			{ operation_id: "app", state: "succeeded" },
			{ operation_id: "optional-discord", state: "failed" },
		]);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.delivery_attempt")).rows[0].n, 2);
	});
});

test("U117 inspection distinguishes delivery attempt failure from handler completion", async () => {
	const { eventDetails } = await import("../../packages/domain/src/events.ts");
	const { finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await deliveryFixture(async ({ pool, db, authority, httpUrl }) => {
		const scope = (await db.query("SELECT e.event_id,ep.project_id FROM payloadbay.execution e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [authority.executionId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['metadata.read'])", [scope.project_id]);
		await managedSend(pool, authority, { url: httpUrl + "/status/503" }, { operationId: "optional", body: "private event" });
		await finishExecution(pool, authority, { kind: "complete" });
		const detail = await eventDetails(pool, { userId: "fixture-owner" }, scope.event_id);
		assert.equal(detail.executions.length, 1, "inspection must include handler history");
		assert.equal(detail.executions[0].state, "succeeded");
		assert.equal(detail.attempts.length, 1);
		assert.equal(detail.attempts[0].status_code, 503);
		assert.equal(detail.attempts[0].response_body, undefined);
		assert.equal(Reflect.get(detail, "original_body"), undefined);
	});
});

test("U143 failed event replay creates separate durable execution history", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	const { finishExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await deliveryFixture(async ({ pool, db, authority }) => {
		await finishExecution(pool, authority, { kind: "fail", reason: "application unavailable" });
		const previous = (await db.query("SELECT row_to_json(x) AS row FROM payloadbay.execution x WHERE id=$1", [authority.executionId])).rows[0].row;
		const event = (await db.query("SELECT e.id,e.publication_id,ep.project_id FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id")).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['events.replay'])", [event.project_id]);
		const result = await replayEvent(pool, { userId: "fixture-owner" }, { eventId: event.id, key: "manual-replay" });
		assert.ok(result.id, "replay must create new execution identity");
		assert.notEqual(result.id, authority.executionId);
		const next = (await db.query("SELECT * FROM payloadbay.execution WHERE id=$1", [result.id])).rows[0];
		assert.equal(next.state, "queued");
		assert.equal(next.event_id, event.id);
		assert.equal(next.publication_id, event.publication_id);
		assert.equal(next.replay_of_id, authority.executionId);
		assert.deepEqual((await db.query("SELECT row_to_json(x) AS row FROM payloadbay.execution x WHERE id=$1", [authority.executionId])).rows[0].row, previous);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM graphile_worker.jobs")).rows[0].n, 1);
	});
});

test("U145 replay idempotency rejects changed policy under the same key", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	await deliveryFixture(async ({ pool, db, authority }) => {
		const event = (await db.query("SELECT e.event_id,ep.project_id FROM payloadbay.execution e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [authority.executionId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['events.replay'])", [event.project_id]);
		const actor = { userId: "fixture-owner" };
		const input = { eventId: event.event_id, key: "retry-request" };
		const first = await replayEvent(pool, actor, input);
		const again = await replayEvent(pool, actor, input);
		assert.equal(again.id, first.id);
		assert.equal(again.reused, true);
		await assert.rejects(replayEvent(pool, actor, { ...input, publicationPolicy: "current" }), { code: "replay_input_changed" });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.execution")).rows[0].n, 2);
	});
});

test("U146 replay keeps original publication after active version changes", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	await deliveryFixture(async ({ pool, db, authority }) => {
		const event = (await db.query("SELECT e.event_id,e.publication_id,ep.project_id FROM payloadbay.execution e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1", [authority.executionId])).rows[0];
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['events.replay'])", [event.project_id]);
		const current = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,'new-fixture','fixture-owner' FROM payloadbay.publication WHERE id=$1 RETURNING id", [event.publication_id])).rows[0].id;
		await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [current, authority.endpointId]);
		const replay = await replayEvent(pool, { userId: "fixture-owner" }, { eventId: event.event_id, key: "original-policy" });
		assert.equal((await db.query("SELECT publication_id FROM payloadbay.execution WHERE id=$1", [replay.id])).rows[0].publication_id, event.publication_id, "default replay must retain original publication");
	});
});
