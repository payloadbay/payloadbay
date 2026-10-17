import test from "node:test";
import { once } from "node:events";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authFixture, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { encryptPrivate } from "../../packages/domain/src/private-crypto.ts";
import { platformJobTask } from "../../apps/worker/src/tasks/platform-job.ts";

test("RT02 maintenance prunes only provably old completed events and preserves obligations and ledgers", async () => {
	await authFixture(async ({ db, pool, ...fixture }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");

		const event = async (outcome = "accept") => (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','application/octet-stream',$4) RETURNING id", [scope.endpoint, scope.publication, Buffer.from("synthetic retained bytes"), outcome])).rows[0].id as string;

		const execution = async (eventId: string, state: string, replayOf: string | null = null) => (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state,replay_of_id) VALUES($1,$2,$3,$4,$5) RETURNING id", [eventId, scope.endpoint, scope.publication, state, replayOf])).rows[0].id as string;

		const old = await event();
		const original = await execution(old, "succeeded");
		const replay = await execution(old, "succeeded", original);
		const queued = await event();
		const queuedExecution = await execution(queued, "queued");
		const justCompleted = await event();
		const recentExecution = await execution(justCompleted, "succeeded");
		const legacyUnproven = await event();
		await execution(legacyUnproven, "succeeded");
		const missingWork = await event();
		const rejected = await event("reject");
		for (const [id, oldCompletion] of [
			[original, true],
			[replay, true],
			[recentExecution, false],
		] as const)
			await db.query("INSERT INTO payloadbay.usage_fact(organization_id,workspace_id,project_id,metric,source_key,occurred_at) VALUES($1,$2,$3,'execution.succeeded',$4,statement_timestamp()-CASE WHEN $5 THEN interval '40 days' ELSE interval '0 days' END)", [scope.organization, scope.workspace, scope.project, id, oldCompletion]);
		await db.query("INSERT INTO payloadbay.usage_counter(organization_id,metric,quantity) VALUES($1,'execution.succeeded',3)", [scope.organization]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation) VALUES('fixture-owner','instance',$1,'fixture.retention-history')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.receipt(event_id,ack_response_digest,accepted_at) VALUES($1,'fixture',statement_timestamp()-interval '40 days')", [old]);
		await db.query("INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,job_key,claim_deadline_at) VALUES($1,$2,1,'fixture-retained',statement_timestamp()-interval '40 days')", [original, scope.endpoint]);
		await db.query("INSERT INTO payloadbay.replay_key(actor,event_id,key,input_digest,execution_id) VALUES('fixture-owner',$1,'retained-replay','fixture',$2)", [old, replay]);
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,state,generation) VALUES($1,'primary','fixture','{}','succeeded',1)", [original]);
		const attempt = (await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,started_at,ended_at,status_code,response_body) VALUES($1,'primary',1,1,statement_timestamp()-interval '40 days',statement_timestamp()-interval '40 days',200,$2) RETURNING id", [original, Buffer.from("synthetic historical response")])).rows[0].id;
		await db.query("UPDATE payloadbay.managed_operation SET successful_attempt_id=$1 WHERE execution_id=$2", [attempt, original]);
		const beforeFacts = (await db.query("SELECT id,metric,source_key,occurred_at FROM payloadbay.usage_fact ORDER BY id")).rows;
		const beforeRevisions = (await db.query("SELECT id FROM payloadbay.stage_revision ORDER BY id")).rows;
		const config = { ...fixtureConfig(fixture), eventRetentionDays: 30 };
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('event_retention',$1,$2) RETURNING id,generation", [encryptPrivate({}, config.encryptionKey), "retention-fixture:" + randomUUID()])).rows[0];
		await platformJobTask(pool, config)({ jobId: job.id, generation: job.generation });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event WHERE id=ANY($1::uuid[])", [[old, rejected]])).rows[0].count, 0, "Old completed and protocol-only records should expire");
		assert.deepEqual(
			(await db.query("SELECT id FROM payloadbay.event ORDER BY id")).rows.map((row) => row.id),
			[queued, justCompleted, legacyUnproven, missingWork].sort(),
		);
		assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [queuedExecution])).rows[0].state, "queued");
		assert.deepEqual((await db.query("SELECT id,metric,source_key,occurred_at FROM payloadbay.usage_fact ORDER BY id")).rows, beforeFacts);
		assert.equal((await db.query("SELECT quantity FROM payloadbay.usage_counter WHERE organization_id=$1", [scope.organization])).rows[0].quantity, "3");
		assert.deepEqual((await db.query("SELECT id FROM payloadbay.stage_revision ORDER BY id")).rows, beforeRevisions);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.publication WHERE id=$1", [scope.publication])).rows[0].count, 1);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.audit WHERE operation='fixture.retention-history'")).rows[0].count, 1);
		assert.equal((await db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].state, "succeeded");
	});
});

test("RT03 retention is disabled by default and its database capability cannot bypass ordinary history guards", async () => {
	const { Client } = await import("pg");
	await authFixture(async ({ db, pool, ...fixture }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) SELECT $1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain','reject' FROM generate_series(1,2)", [scope.endpoint, scope.publication, Buffer.from("synthetic expired request")]);
		const config = fixtureConfig(fixture);
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('event_retention',$1,$2) RETURNING id,generation", [encryptPrivate({}, config.encryptionKey), "disabled-retention:" + randomUUID()])).rows[0];
		await platformJobTask(pool, config)({ jobId: job.id, generation: job.generation });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 2);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation) VALUES('fixture-owner','instance',$1,'fixture.guard-proof')", [scope.installation]);
		const role = "pab_retention_test_" + randomUUID().replaceAll("-", "");
		const password = randomUUID() + randomUUID();
		const connection = new URL(fixture.databaseUrl);
		const client = new Client({
			host: connection.hostname,
			port: Number(connection.port),
			database: connection.pathname.slice(1),
			user: role,
			password,
		});
		await db.query((await db.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L',$1::text,$2::text) AS sql", [role, password])).rows[0].sql);
		try {
			await db.query((await db.query("SELECT format('GRANT payloadbay_app,payloadbay_worker TO %I',$1::text) AS sql", [role])).rows[0].sql);
			await client.connect();
			await client.query("SET ROLE payloadbay_app");
			await assert.rejects(client.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-interval '30 days',1)"), { code: "42501" });
			await client.query("SET ROLE payloadbay_worker");
			await client.query("SET payloadbay.retention='true'");
			await assert.rejects(client.query("DELETE FROM payloadbay.event"), /immutable history/);
			await assert.rejects(client.query("SELECT payloadbay.prune_expired_events(statement_timestamp(),1)"), /invalid retention bounds/);
			await assert.rejects(client.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-interval '30 days',201)"), /invalid retention bounds/);
			await assert.rejects(client.query("SET ROLE payloadbay_retention"), { code: "42501" });
			await client.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-interval '30 days',1)");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 1, "The privileged capability remains batch bounded");
			await assert.rejects(client.query("DELETE FROM payloadbay.event"), /immutable history/);
			await assert.rejects(db.query("DELETE FROM payloadbay.stage_revision"), /immutable history/);
			await assert.rejects(db.query("DELETE FROM payloadbay.audit"), /immutable history/);
		} finally {
			await client.end();
			await db.query((await db.query("SELECT format('DROP ROLE %I',$1::text) AS sql", [role])).rows[0].sql);
		}
	});
});

test("RT04 a maintenance lease expiring during pruning rolls back both deletion and audit", async () => {
	const { runEventRetention } = await import("../../packages/domain/src/retention.ts");
	await authFixture(async ({ db, pool, ...fixture }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain','reject')", [scope.endpoint, scope.publication, Buffer.from("synthetic expired request")]);
		await db.query("CREATE FUNCTION payloadbay.retention_delay_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN OLD; END $$");
		await db.query("CREATE TRIGGER retention_delay_fixture BEFORE DELETE ON payloadbay.event FOR EACH ROW EXECUTE FUNCTION payloadbay.retention_delay_fixture()");
		const config = { ...fixtureConfig(fixture), eventRetentionDays: 30 };
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,state,lease_owner,lease_expiry,attempt_number,encrypted_payload,job_key) VALUES('event_retention','running','fixture-worker',clock_timestamp()+interval '1 second',1,$1,$2) RETURNING id,generation", [encryptPrivate({}, config.encryptionKey), "fenced-retention:" + randomUUID()])).rows[0];
		await assert.rejects(runEventRetention(pool, config, job), /Maintenance lease expired/);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 1);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.audit WHERE operation='events.retained-history.pruned'")).rows[0].count, 0);
		assert.equal((await db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].state, "running");
	});
});

test("RT05 replay racing completed retention returns not-found instead of a foreign-key failure", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	await authFixture(async ({ db, pool }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['events.replay'])", [scope.installation]);
		const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain') RETURNING id", [scope.endpoint, scope.publication, Buffer.from("synthetic retained request")])).rows[0].id;
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state) VALUES($1,$2,$3,'succeeded') RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.usage_fact(organization_id,workspace_id,project_id,metric,source_key,occurred_at) VALUES($1,$2,$3,'execution.succeeded',$4,statement_timestamp()-interval '40 days')", [scope.organization, scope.workspace, scope.project, execution]);
		const blocker = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
		await db.query("BEGIN");
		let open = true;
		try {
			await db.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-interval '30 days',100)");
			const attempt = replayEvent(pool, { userId: "fixture-owner" }, { eventId: event, key: "retention-race" }).then(
				() => ({ error: null }),
				(error: unknown) => ({ error }),
			);
			let blocked = false;
			for (let i = 0; i < 200 && !blocked; i++) {
				blocked = (await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked", [blocker])).rows[0].blocked;
				if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
			}

			assert.equal(blocked, true, "The replay must overlap the uncommitted deletion");
			await db.query("COMMIT");
			open = false;
			const outcome = await attempt;
			assert.equal((outcome.error as { code?: string } | null)?.code, "not_found");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.execution WHERE event_id=$1", [event])).rows[0].count, 0);
		} finally {
			if (open) await db.query("ROLLBACK");
		}
	});
});

test("RT06 retention rechecks a replay committed after its selection snapshot before deleting work", async () => {
	const { replayEvent } = await import("../../packages/domain/src/replay.ts");
	await authFixture(async ({ db, pool }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['events.replay'])", [scope.installation]);
		const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain') RETURNING id", [scope.endpoint, scope.publication, Buffer.from("synthetic snapshot request")])).rows[0].id;
		const old = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state) VALUES($1,$2,$3,'succeeded') RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.usage_fact(organization_id,workspace_id,project_id,metric,source_key,occurred_at) VALUES($1,$2,$3,'execution.succeeded',$4,statement_timestamp()-interval '40 days')", [scope.organization, scope.workspace, scope.project, old]);
		// Fixture-only RLS pauses the initial statement after its snapshot, before row locking.
		const key = Math.floor(Math.random() * 2147483647);
		await db.query(`CREATE FUNCTION payloadbay.retention_snapshot_pause_fixture() RETURNS boolean LANGUAGE plpgsql VOLATILE AS $$ BEGIN PERFORM pg_advisory_lock(${key}); PERFORM pg_advisory_unlock(${key}); RETURN true; END $$`);
		await db.query("ALTER TABLE payloadbay.event ENABLE ROW LEVEL SECURITY");
		await db.query("CREATE POLICY retention_snapshot_fixture ON payloadbay.event FOR ALL TO payloadbay_retention USING(payloadbay.retention_snapshot_pause_fixture()) WITH CHECK(true)");
		const blocker = (await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
		await db.query("SELECT pg_advisory_lock($1)", [key]);
		const pruning = pool.query("SELECT payloadbay.prune_expired_events(statement_timestamp()-interval '30 days',100)").then(
			() => null,
			(error: unknown) => error,
		);
		let released = false;
		try {
			let blocked = false;
			for (let i = 0; i < 200 && !blocked; i++) {
				blocked = (await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked", [blocker])).rows[0].blocked;
				if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
			}

			assert.equal(blocked, true, "Selection must have taken its snapshot before the replay commits");
			const replay = await replayEvent(pool, { userId: "fixture-owner" }, { eventId: event, key: "snapshot-race" });
			assert.equal((await pool.query("SELECT state FROM payloadbay.execution WHERE id=$1", [replay.id])).rows[0].state, "queued");
			await db.query("SELECT pg_advisory_unlock($1)", [key]);
			released = true;
			assert.equal(await pruning, null);
			assert.equal((await db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [replay.id])).rows[0]?.state, "queued", "Committed replay work must survive a stale retention selection snapshot");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event WHERE id=$1", [event])).rows[0].count, 1);
		} finally {
			if (!released) await db.query("SELECT pg_advisory_unlock($1)", [key]);
			await pruning;
		}
	});
});

test("RT07 a full cleanup batch queues exactly one durable continuation", async () => {
	await authFixture(async ({ db, pool, ...fixture }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) SELECT $1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain','reject' FROM generate_series(1,101)", [scope.endpoint, scope.publication, Buffer.from("synthetic expired request")]);
		const config = { ...fixtureConfig(fixture), eventRetentionDays: 30 };
		const original = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('event_retention',$1,$2) RETURNING id,generation", [encryptPrivate({}, config.encryptionKey), "retention-batches:" + randomUUID()])).rows[0];
		await platformJobTask(pool, config)({ jobId: original.id, generation: original.generation });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 1);
		const next = (await db.query("SELECT id,generation FROM payloadbay.platform_job WHERE kind='event_retention' AND state='queued'")).rows;
		assert.equal(next.length, 1, "A full batch must yield and preserve the next cleanup job durably");
		await platformJobTask(pool, config)({ jobId: original.id, generation: original.generation });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention'")).rows[0].count, 2, "A duplicate old reference cannot enqueue another continuation");
		await platformJobTask(pool, config)({ jobId: next[0].id, generation: next[0].generation });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event")).rows[0].count, 0);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention' AND state='queued'")).rows[0].count, 0);
	});
});

test("RT08 recovered maintenance keeps its low priority and dedicated queue flag", async () => {
	const { recoverPlatformJobs } = await import("../../packages/domain/src/platform-recovery.ts");
	await authFixture(async ({ db, pool, ...fixture }) => {
		const config = fixtureConfig(fixture);
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,claim_deadline_at) VALUES('event_retention',$1,$2,clock_timestamp()-interval '1 second') RETURNING id", [encryptPrivate({}, config.encryptionKey), "recover-retention:" + randomUUID()])).rows[0];
		assert.deepEqual(await recoverPlatformJobs(pool), [job.id]);
		const offer = (await db.query("SELECT priority,flags FROM graphile_worker.jobs WHERE key=$1", [`platform:${job.id}:2`])).rows[0];
		assert.equal(offer.priority, 1000, "Maintenance recovery must not become a normal email-priority offer");
		assert.deepEqual(offer.flags, { maintenance: true });
	});
});

test("RT10 enabled retention schedules one durable hourly job across concurrent producers", async () => {
	const { queueEventRetention } = await import("../../packages/domain/src/retention.ts");
	await authFixture(async ({ db, pool, ...fixture }) => {
		const config = fixtureConfig(fixture);
		await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await queueEventRetention(pool, { ...config, eventRetentionDays: 0 });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention'")).rows[0].count, 0);
		await Promise.all(Array.from({ length: 4 }, () => queueEventRetention(pool, { ...config, eventRetentionDays: 30 })));
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention'")).rows[0].count, 1);
		const offer = (await db.query("SELECT priority,flags FROM graphile_worker.jobs WHERE task_identifier='platform_job'")).rows[0];
		assert.equal(offer.priority, 1000);
		assert.deepEqual(offer.flags, { maintenance: true });
	});
});

test("RT11 retention producer starts immediately and stops without scheduling more work", async () => {
	const { startRetentionProducer } = await import("../../apps/worker/src/retention.ts");
	await authFixture(async ({ db, pool, ...fixture }) => {
		await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const config = { ...fixtureConfig(fixture), eventRetentionDays: 30 };
		const producer = startRetentionProducer(pool, config, { intervalMs: 20 });
		await producer.stop();
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention'")).rows[0].count, 1);
		await db.query("DELETE FROM payloadbay.platform_job WHERE kind='event_retention'");
		await new Promise((resolve) => setTimeout(resolve, 60));
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='event_retention'")).rows[0].count, 0);
	});
});

test("RT09 reserved platform capacity stays available while maintenance is blocked", async () => {
	const { run } = await import("../../apps/worker/node_modules/graphile-worker/dist/index.js");
	const { workerLanes } = await import("../../apps/worker/src/runner-lanes.ts");
	await authFixture(async ({ pool }) => {
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let started!: () => void;
		const maintenanceStarted = new Promise<void>((resolve) => {
			started = resolve;
		});
		let delivered!: () => void;
		const platformDelivered = new Promise<void>((resolve) => {
			delivered = resolve;
		});
		const runners = [];
		try {
			for (const lane of workerLanes(pool, {
				process_event: async () => {},
				platform_job: async (payload) => {
					if ((payload as { maintenance?: boolean }).maintenance) {
						started();
						await blocked;
					} else delivered();
				},
			}))
				runners.push(
					await run({
						pgPool: pool,
						noHandleSignals: true,
						pollInterval: 25,
						parsedCronItems: [],
						...lane,
					}),
				);
			await pool.query("SELECT payloadbay.enqueue('platform_job',$1::json,clock_timestamp(),$2,1000::smallint)", [JSON.stringify({ maintenance: true }), randomUUID()]);
			await Promise.race([maintenanceStarted, new Promise((_, reject) => setTimeout(() => reject(Error("Maintenance did not start")), 5000).unref())]);
			await pool.query("SELECT payloadbay.enqueue('platform_job','{}'::json,clock_timestamp(),$1,10::smallint)", [randomUUID()]);
			await Promise.race([platformDelivered, new Promise((_, reject) => setTimeout(() => reject(Error("Maintenance consumed reserved mail capacity")), 3000).unref())]);
		} finally {
			release();
			await Promise.all(runners.map((runner) => runner.stop()));
		}
	});
});

test("RT12 actual worker startup schedules and executes enabled retention without an operator command", async () => {
	const { createServer } = await import("node:http");
	const { spawn } = await import("node:child_process");
	const { fixtureEnvironment } = await import("../helpers/fixture-environment.ts");
	await authFixture(async ({ db, ...fixture }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,received_at,original_body,accepted_body,headers,content_type,ingress_outcome) VALUES($1,$2,statement_timestamp()-interval '40 days',$3,$3,'{}','text/plain','reject') RETURNING id", [scope.endpoint, scope.publication, Buffer.from("synthetic expired request")])).rows[0].id;
		// Startup readiness dependency only: no script is executed by this fixture.
		const executor = createServer((_request, response) => response.writeHead(200).end("{}"));
		executor.listen(0, "127.0.0.1");
		await once(executor, "listening");
		const address = executor.address();
		assert.ok(address && typeof address !== "string");
		const reservation = createServer();
		reservation.listen(0, "127.0.0.1");
		await once(reservation, "listening");
		const brokerAddress = reservation.address();
		assert.ok(brokerAddress && typeof brokerAddress !== "string");
		await new Promise<void>((resolve) => reservation.close(() => resolve()));
		const child = spawn(process.execPath, ["--import", "tsx", "apps/worker/src/main.ts"], {
			env: {
				...fixtureEnvironment(fixture, "http://localhost:3000"),
				EXECUTOR_URL: `http://127.0.0.1:${address.port}`,
				PORT: String(brokerAddress.port),
				PAYLOADBAY_EVENT_RETENTION_DAYS: "30",
			},
			stdio: "ignore",
		});
		const exited = once(child, "exit");
		try {
			let completed = false;
			for (let i = 0; i < 200 && !completed; i++) {
				assert.equal(child.exitCode, null, "Worker must stay running");
				completed = (await db.query("SELECT EXISTS(SELECT 1 FROM payloadbay.platform_job WHERE kind='event_retention' AND state='succeeded') AS done")).rows[0].done;
				if (!completed) await new Promise((resolve) => setTimeout(resolve, 50));
			}

			assert.equal(completed, true, "Actual entrypoint must produce and execute maintenance");
			assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.event WHERE id=$1", [event])).rows[0].count, 0);
		} finally {
			child.kill("SIGTERM");
			const killer = setTimeout(() => child.kill("SIGKILL"), 12000);
			await exited;
			clearTimeout(killer);
			await new Promise<void>((resolve) => executor.close(() => resolve()));
		}
	});
});
