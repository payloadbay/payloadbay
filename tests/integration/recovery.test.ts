import test from "node:test";
import assert from "node:assert/strict";
import { prepareDevelopmentDatabase as migrate } from "../../packages/domain/src/development.ts";
import { database } from "../../packages/domain/src/db.ts";
import { withFixtures } from "../../scripts/tests/fixtures.ts";
import { seedScope, seedEvent } from "../helpers/domain-fixtures.ts";
import { recoverExpired } from "../../packages/domain/src/execution-lease.ts";
import type { Pool, PoolClient } from "pg";

type RecoveryFixtureData = {
	pool: Pool;
	db: PoolClient;
	executionId: string;
	endpointId: string;
};

async function recoveryFixture(run: (f: RecoveryFixtureData) => Promise<void>) {
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			const scope = await seedScope(db);
			const event = await seedEvent(db, scope);
			const executionId = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id,state,lease_owner,lease_expiry) VALUES($1,$2,$3,'running','fixture-worker',clock_timestamp()+interval '30 seconds') RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
			await db.query("INSERT INTO payloadbay.dispatch(execution_id,endpoint_id,generation,job_key,claim_deadline_at) VALUES($1,$2,1,$3,clock_timestamp()+interval '30 seconds')", [executionId, scope.endpoint, "fixture:" + executionId + ":1"]);
			await run({
				pool,
				db,
				executionId,
				endpointId: scope.endpoint,
			});
		} finally {
			db.release();
			await pool.end();
		}
	});
}

test("U27 live unexpired lease cannot be reclaimed", async () => {
	await recoveryFixture(async (f) => {
		assert.deepEqual(await recoverExpired(f.pool), []);
		assert.equal((await f.db.query("SELECT dispatch_generation FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].dispatch_generation, 1);
	});
});

test("U28 expired lease becomes recoverable using database time", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp() WHERE id=$1", [f.executionId]);
		assert.deepEqual(await recoverExpired(f.pool), [f.executionId]);
		const execution = (await f.db.query("SELECT state,dispatch_generation,lease_owner FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0];
		assert.deepEqual(execution, { state: "queued", dispatch_generation: 2, lease_owner: null });
		assert.equal((await f.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count, 1);
	});
});

test("U29 unclaimed offer before deadline is not recovered", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET state='queued',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [f.executionId]);
		assert.deepEqual(await recoverExpired(f.pool), []);
	});
});

test("U30 overdue unclaimed offer gets fresh generation", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET state='queued',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [f.executionId]);
		await f.db.query("UPDATE payloadbay.dispatch SET claim_deadline_at=clock_timestamp() WHERE execution_id=$1", [f.executionId]);
		assert.deepEqual(await recoverExpired(f.pool), [f.executionId]);
		const dispatch = (await f.db.query("SELECT generation,job_key FROM payloadbay.dispatch WHERE execution_id=$1 ORDER BY generation", [f.executionId])).rows;
		assert.equal(dispatch.length, 2);
		assert.equal(dispatch[1].generation, 2);
		assert.notEqual(dispatch[0].job_key, dispatch[1].job_key);
	});
});

test("U31 concurrent sweepers create one replacement generation", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp() WHERE id=$1", [f.executionId]);
		await f.db.query("CREATE FUNCTION payloadbay.fixture_slow_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.05);RETURN NEW;END $$");
		await f.db.query("CREATE TRIGGER fixture_slow BEFORE UPDATE OF dispatch_generation ON payloadbay.execution FOR EACH ROW EXECUTE FUNCTION payloadbay.fixture_slow_update()");
		const a = await f.pool.connect();
		const b = await f.pool.connect();
		a.release();
		b.release();
		const results = await Promise.all([recoverExpired(f.pool), recoverExpired(f.pool)]);
		assert.deepEqual(results.flat(), [f.executionId]);
		assert.equal((await f.db.query("SELECT dispatch_generation FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].dispatch_generation, 2);
	});
});

import { finishExecution } from "../../packages/domain/src/execution-lease.ts";

test("U32 stale generation cannot overwrite newer result", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET dispatch_generation=2,final_result=$2::jsonb WHERE id=$1", [f.executionId, JSON.stringify({ source: "newer" })]);
		await assert.rejects(
			finishExecution(
				f.pool,
				{
					executionId: f.executionId,
					endpointId: f.endpointId,
					owner: "fixture-worker",
					generation: 1,
				},
				{ kind: "complete" },
			),
			{ code: "stale_execution" },
		);
		assert.deepEqual((await f.db.query("SELECT final_result FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].final_result, { source: "newer" });
	});
});

test("U194 live current owner commits completion", async () => {
	await recoveryFixture(async (f) => {
		const result = await finishExecution(
			f.pool,
			{
				executionId: f.executionId,
				endpointId: f.endpointId,
				owner: "fixture-worker",
				generation: 1,
			},
			{ kind: "complete" },
		);
		assert.equal(result.state, "succeeded");
		assert.equal((await f.db.query("SELECT state FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].state, "succeeded");
	});
});

import { mintBrokerToken, verifyBrokerToken } from "../../packages/domain/src/broker-auth.ts";
import { createHmac, randomUUID } from "node:crypto";

test("U33 forged broker capability cannot acquire authority", async () => {
	await recoveryFixture(async (f) => {
		const payload = Buffer.from(
			JSON.stringify({
				executionId: f.executionId,
				endpointId: f.endpointId,
				owner: "fixture-worker",
				generation: 1,
				expiresAt: 2000,
				nonce: "fixture",
			}),
		).toString("base64url");
		const token = payload + "." + createHmac("sha256", "wrong-fixture-secret").update(payload).digest("base64url");
		assert.throws(() => verifyBrokerToken("correct-fixture-secret-32-characters", token, 1000), /Invalid broker capability/);
	});
});

test("U195 valid capability preserves pinned execution authority", async () => {
	await recoveryFixture(async (f) => {
		const authority = {
			executionId: f.executionId,
			endpointId: f.endpointId,
			owner: "fixture-worker",
			generation: 1,
		};
		const secret = "correct-fixture-secret-32-characters";
		const token = mintBrokerToken(secret, authority, 2000);
		assert.deepEqual(verifyBrokerToken(secret, token, 1000), authority);
		assert.throws(() => verifyBrokerToken(secret, token, 2000), /Expired broker capability/);
	});
});

test("U34 cross-route broker authority is rejected", async () => {
	await recoveryFixture(async (f) => {
		await assert.rejects(
			finishExecution(
				f.pool,
				{
					executionId: f.executionId,
					endpointId: randomUUID(),
					owner: "fixture-worker",
					generation: 1,
				},
				{ kind: "complete" },
			),
			{ code: "stale_execution" },
		);
	});
});

import { unlockObservedChild } from "../../apps/worker/src/recovery.ts";

test("U35 suspected live Graphile worker is never unlocked", async () => {
	const calls: string[][] = [];
	const result = await unlockObservedChild(
		{
			forceUnlockWorkers: async (ids) => {
				calls.push(ids);
			},
		},
		{ exitCode: null, signalCode: null },
		["fixture-live-worker"],
	);
	assert.equal(result, false);
	assert.deepEqual(calls, []);
});

test("U196 observed dead child unlocks only exact worker IDs", async () => {
	const calls: string[][] = [];
	assert.equal(
		await unlockObservedChild(
			{
				forceUnlockWorkers: async (ids) => {
					calls.push(ids);
				},
			},
			{ exitCode: 0, signalCode: null },
			["fixture-dead-worker"],
		),
		true,
	);
	assert.deepEqual(calls, [["fixture-dead-worker"]]);
});

import { claimExecution, heartbeat } from "../../packages/domain/src/execution-lease.ts";

test("U197 queued generation is claimed once", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET state='queued',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [f.executionId]);
		const results = await Promise.all([claimExecution(f.pool, f.executionId, 1, "worker-a"), claimExecution(f.pool, f.executionId, 1, "worker-b")]);
		assert.equal(results.filter(Boolean).length, 1);
		assert.equal((await f.db.query("SELECT attempt_number FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].attempt_number, 1);
	});
});

test("U198 only live current owner extends database lease", async () => {
	await recoveryFixture(async (f) => {
		const authority = {
			executionId: f.executionId,
			endpointId: f.endpointId,
			owner: "fixture-worker",
			generation: 1,
		};
		assert.equal(await heartbeat(f.pool, { ...authority, generation: 2 }), false);
		await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()+interval '1 second' WHERE id=$1", [f.executionId]);
		assert.equal(await heartbeat(f.pool, authority), true);
		assert.ok((await f.db.query("SELECT lease_expiry-clock_timestamp() AS remaining FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].remaining.seconds >= 29);
	});
});

import { startRecovery } from "../../apps/worker/src/recovery.ts";

test("U199 healthy supervisor sweeps expired work automatically", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp() WHERE id=$1", [f.executionId]);
		const started = performance.now();
		const recovery = startRecovery(f.pool);
		try {
			let generation = 1;
			while (performance.now() - started < 6500) {
				generation = (await f.db.query("SELECT dispatch_generation FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].dispatch_generation;
				if (generation === 2) break;
				await new Promise((r) => setTimeout(r, 50));
			}

			assert.equal(generation, 2, "automatic recovery must offer expired work");
		} finally {
			await recovery.stop();
		}
	});
});

test("U200 result authority rechecks expiry after row lock", async () => {
	await recoveryFixture(async (f) => {
		const blocker = await f.pool.connect();
		try {
			await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()+interval '0.2 seconds' WHERE id=$1", [f.executionId]);
			await blocker.query("BEGIN");
			await blocker.query("SELECT id FROM payloadbay.execution WHERE id=$1 FOR UPDATE", [f.executionId]);
			const rejected = assert.rejects(
				finishExecution(
					f.pool,
					{
						executionId: f.executionId,
						endpointId: f.endpointId,
						owner: "fixture-worker",
						generation: 1,
					},
					{ kind: "complete" },
				),
				{ code: "stale_execution" },
			);
			await new Promise((r) => setTimeout(r, 300));
			await blocker.query("COMMIT");
			await rejected;
		} finally {
			await blocker.query("ROLLBACK");
			blocker.release();
		}
	});
});

test("U201 heartbeat cannot revive lease after blocked expiry", async () => {
	await recoveryFixture(async (f) => {
		const blocker = await f.pool.connect();
		try {
			await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()+interval '0.2 seconds' WHERE id=$1", [f.executionId]);
			await blocker.query("BEGIN");
			await blocker.query("SELECT id FROM payloadbay.execution WHERE id=$1 FOR UPDATE", [f.executionId]);
			const result = heartbeat(f.pool, {
				executionId: f.executionId,
				endpointId: f.endpointId,
				owner: "fixture-worker",
				generation: 1,
			});
			await new Promise((r) => setTimeout(r, 300));
			await blocker.query("COMMIT");
			assert.equal(await result, false);
		} finally {
			await blocker.query("ROLLBACK");
			blocker.release();
		}
	});
});

test("U202 abandoned transaction releases locks within timeout", async () => {
	await recoveryFixture(async (f) => {
		let connectionError: { code?: string } | undefined;

		const onError = (error: Error) => {
			connectionError ??= error as Error & { code?: string };
		};

		f.db.on("error", onError);
		try {
			await f.db.query("BEGIN");
			await f.db.query("SELECT id FROM payloadbay.execution WHERE id=$1 FOR UPDATE", [f.executionId]);
			const started = performance.now();
			while (!connectionError && performance.now() - started < 11500) await new Promise((r) => setTimeout(r, 50));
			assert.equal(connectionError?.code, "25P03", "idle transaction must be terminated by PostgreSQL");
		} finally {
			await f.db.query("ROLLBACK").catch(() => {});
			f.db.removeListener("error", onError);
		}
	});
});

import { startHeartbeat } from "../../apps/worker/src/recovery.ts";

test("U203 active worker renews lease on five second cadence", async () => {
	await recoveryFixture(async (f) => {
		await f.db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()+interval '6 seconds' WHERE id=$1", [f.executionId]);
		let lost = false;
		const control = startHeartbeat(
			f.pool,
			{
				executionId: f.executionId,
				endpointId: f.endpointId,
				owner: "fixture-worker",
				generation: 1,
			},
			() => {
				lost = true;
			},
		);
		const started = performance.now();
		let remaining = 0;
		try {
			while (performance.now() - started < 6500) {
				remaining = (await f.db.query("SELECT extract(epoch from lease_expiry-clock_timestamp()) AS remaining FROM payloadbay.execution WHERE id=$1", [f.executionId])).rows[0].remaining;
				if (Number(remaining) > 20) break;
				await new Promise((r) => setTimeout(r, 50));
			}

			assert.ok(Number(remaining) > 20, "heartbeat must renew before lease expiry");
			assert.equal(lost, false);
		} finally {
			await control.stop();
		}
	});
});

test("U106 retry schedules a delayed fresh fenced generation", async () => {
	await recoveryFixture(async ({ pool, db, executionId, endpointId }) => {
		await db.query("UPDATE payloadbay.execution SET attempt_number=1 WHERE id=$1", [executionId]);
		const before = Date.now();
		const result = await finishExecution(
			pool,
			{
				executionId,
				endpointId,
				generation: 1,
				owner: "fixture-worker",
			},
			{ kind: "retry", reason: "destination unavailable", delayMs: 1500 },
		);
		assert.equal(result.state, "retry_wait");
		assert.equal(result.dispatch_generation, 2);
		assert.equal(result.lease_owner, null);
		assert.ok(new Date(result.due_at).getTime() >= before + 1500);
		const job = (await db.query("SELECT payload FROM graphile_worker._private_jobs")).rows[0];
		assert.equal(job.payload.generation, 2);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.dispatch")).rows[0].n, 2);
		await assert.rejects(
			finishExecution(
				pool,
				{
					executionId,
					endpointId,
					generation: 1,
					owner: "fixture-worker",
				},
				{ kind: "complete" },
			),
			{ code: "stale_execution" },
		);
	});
});

test("U257 sixth default execution attempt cannot be claimed", async () => {
	const { claimExecution } = await import("../../packages/domain/src/execution-lease.ts");
	await recoveryFixture(async ({ pool, db, executionId }) => {
		await db.query("UPDATE payloadbay.execution SET state='queued',attempt_number=5,lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [executionId]);
		const claimed = await claimExecution(pool, executionId, 1, "sixth-worker");
		assert.equal(claimed, null, "exhausted execution must not acquire sixth attempt");
		assert.equal((await db.query("SELECT attempt_number FROM payloadbay.execution WHERE id=$1", [executionId])).rows[0].attempt_number, 5);
	});
});

test("U264 crashed final attempt becomes terminal without another dispatch", async () => {
	await recoveryFixture(async ({ pool, db, executionId }) => {
		await db.query("UPDATE payloadbay.execution SET attempt_number=5,lease_expiry=clock_timestamp() WHERE id=$1", [executionId]);
		assert.deepEqual(await recoverExpired(pool), [executionId]);
		const row = (await db.query("SELECT state,attempt_number,final_result FROM payloadbay.execution WHERE id=$1", [executionId])).rows[0];
		assert.equal(row.state, "failed_terminal", "exhausted crashed execution must become terminal");
		assert.equal(row.attempt_number, 5);
		assert.deepEqual(row.final_result, { kind: "fail", reason: "processing_attempts_exhausted" });
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.dispatch")).rows[0].n, 1);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.event")).rows[0].n, 1);
		assert.deepEqual(await recoverExpired(pool), []);
	});
});

test("U311 a resumed old job gets a fresh claim window", async () => {
	await recoveryFixture(async ({ db, executionId }) => {
		const { scheduleDispatch } = await import("../../packages/domain/src/execution-lease.ts");
		await db.query("UPDATE payloadbay.execution SET state='queued',dispatch_generation=2,due_at=clock_timestamp()-interval '1 hour',lease_owner=NULL,lease_expiry=NULL WHERE id=$1", [executionId]);
		const execution = (await db.query("SELECT * FROM payloadbay.execution WHERE id=$1", [executionId])).rows[0];
		await scheduleDispatch(db, execution, 0);
		const dispatch = (await db.query("SELECT claim_deadline_at>=clock_timestamp()+interval '29 seconds' AS fresh FROM payloadbay.dispatch WHERE execution_id=$1 AND generation=2", [executionId])).rows[0];
		assert.equal(dispatch.fresh, true, "Fresh offers must get a new claim window even when their due time is old");
	});
});

test("FT10a organization capacity defers claims without consuming attempts and recovers expired capacity", async () => {
	await recoveryFixture(async ({ pool, db, executionId, endpointId }) => {
		const { claimExecution } = await import("../../packages/domain/src/execution-lease.ts");
		const organization = (await db.query("SELECT w.organization_id FROM payloadbay.endpoint e JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE e.id=$1", [endpointId])).rows[0].organization_id;
		await db.query("INSERT INTO payloadbay.organization_policy(organization_id,version,limits,processing_concurrency,updated_by) VALUES($1,1,$2,1,'fixture-owner')", [organization, JSON.stringify({ workspaces: null, projects: null, admission: null })]);
		const queued = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) SELECT event_id,endpoint_id,publication_id FROM payloadbay.execution WHERE id=$1 RETURNING id", [executionId])).rows[0].id;
		assert.equal(await claimExecution(pool, queued, 1, "waiting-worker"), null);
		const deferred = (await db.query("SELECT state,attempt_number,dispatch_generation,due_at>clock_timestamp() AS delayed FROM payloadbay.execution WHERE id=$1", [queued])).rows[0];
		assert.deepEqual(deferred, {
			state: "queued",
			attempt_number: 0,
			dispatch_generation: 2,
			delayed: true,
		});
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.usage_fact WHERE metric='processing.attempt.started'")).rows[0].n, 0);
		assert.equal(await claimExecution(pool, queued, 1, "stale-worker"), null);
		assert.equal((await db.query("SELECT dispatch_generation FROM payloadbay.execution WHERE id=$1", [queued])).rows[0].dispatch_generation, 2);
		await db.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp()-interval '1 second' WHERE id=$1", [executionId]);
		await db.query("UPDATE payloadbay.execution SET due_at=clock_timestamp() WHERE id=$1", [queued]);
		const claims = await Promise.all([claimExecution(pool, queued, 2, "worker-a"), claimExecution(pool, queued, 2, "worker-b")]);
		assert.equal(claims.filter(Boolean).length, 1);
		assert.equal(claims.find(Boolean).attempt_number, 1);
		assert.equal((await db.query("SELECT quantity::text FROM payloadbay.usage_counter WHERE metric='processing.attempt.started'")).rows[0].quantity, "1");
	});
});
