import test from "node:test";
import assert from "node:assert/strict";
import { withFixtures } from "../../scripts/tests/fixtures.ts";
import { prepareDevelopmentDatabase } from "../../packages/domain/src/development.ts";
import { database } from "../../packages/domain/src/db.ts";
import { seedScope, seedEvent } from "../helpers/domain-fixtures.ts";
import { permissions } from "../../packages/contracts/src/permissions.ts";
import { createDestination } from "../../packages/domain/src/destinations.ts";
import { claimExecution, recoverExpired } from "../../packages/domain/src/execution-lease.ts";
import { createRunnerCredential, revokeRunnerCredential, claimRunnerDelivery, completeRunnerDelivery } from "../../packages/domain/src/runner.ts";
import { managedSend } from "../../packages/domain/src/delivery.ts";
import { runnerCompletion } from "../../packages/contracts/src/runner.ts";

const encryptionKey = "synthetic-runner-fixture-encryption-key";

async function fixture(
	run: (f: {
		pool: ReturnType<typeof database>;
		scope: Awaited<ReturnType<typeof seedScope>>;
		destinationId: string;
		token: string;
		authority: {
			executionId: string;
			endpointId: string;
			generation: number;
			owner: string;
		};
		httpUrl: string;
	}) => Promise<void>,
) {
	await withFixtures(async (f) => {
		await prepareDevelopmentDatabase(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		try {
			const scope = await seedScope(db);
			await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
			const destination = await createDestination(pool, { userId: "fixture-owner" }, { projectId: scope.project, name: "Private receiver", url: "http://runner.invalid" });
			const credential = await createRunnerCredential(pool, { userId: "fixture-owner" }, destination.id);
			const http = (await db.query("SELECT http_config FROM payloadbay.destination WHERE id=$1", [destination.id])).rows[0].http_config;
			scope.publication = (
				await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,$1,'runner-fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [
					JSON.stringify({
						private: {
							id: destination.id,
							name: "Private receiver",
							isDefault: true,
							httpConfig: http,
						},
					}),
					scope.publication,
				])
			).rows[0].id;
			const event = await seedEvent(db, scope);
			const executionId = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
			await claimExecution(pool, executionId, 1, "runner-fixture-worker");
			await run({
				pool,
				scope,
				destinationId: destination.id,
				token: credential.token,
				authority: {
					executionId,
					endpointId: scope.endpoint,
					generation: 1,
					owner: "runner-fixture-worker",
				},
				httpUrl: f.httpUrl,
			});
		} finally {
			db.release();
			await pool.end();
		}
	});
}

async function pending(pool: ReturnType<typeof database>, token: string) {
	for (let i = 0; i < 100; i++) {
		const value = await claimRunnerDelivery(pool, token, encryptionKey);
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}

	throw Error("Runner fixture did not receive a delivery");
}

test("Runner sends exact bytes to a private receiver through an encrypted durable claim and records its response", async () => {
	await fixture(async ({ pool, authority, token, httpUrl }) => {
		assert.equal(await claimRunnerDelivery(pool, token, encryptionKey), null);
		const source = Buffer.from([0, 255, 42, 10]);
		const sending = managedSend(pool, authority, "default", { operationId: "private-send", body: source, headers: { "x-synthetic-secret": "must-not-be-plaintext" } }, { encryptionKey, timeoutMs: 5000 });
		const envelope = await pending(pool, token);
		const stored = (await pool.query("SELECT payload FROM payloadbay.runner_delivery WHERE id=$1", [envelope.id])).rows[0].payload as Buffer;
		assert.equal(stored.includes(Buffer.from("must-not-be-plaintext")), false);
		assert.equal(await claimRunnerDelivery(pool, token, encryptionKey), null, "one attempt cannot be claimed twice");
		const response = await fetch(httpUrl + "/delivery", { method: String(envelope.method), headers: envelope.headers as Record<string, string>, body: Buffer.from(String(envelope.bodyBase64), "base64") });
		await completeRunnerDelivery(pool, token, String(envelope.id), envelope.leaseToken, { status: response.status, bodyBase64: Buffer.from(await response.arrayBuffer()).toString("base64"), contentType: response.headers.get("content-type") ?? "" });
		const result = await sending;
		assert.equal(result.ok, true);
		assert.equal(result.status, 200);
		assert.deepEqual((await (await fetch(httpUrl + "/receipts")).json())[0].body, source.toString("base64"));
		assert.equal((await pool.query("SELECT payload FROM payloadbay.runner_delivery WHERE id=$1", [envelope.id])).rows[0].payload, null);
		assert.equal((await pool.query("SELECT status_code FROM payloadbay.delivery_attempt WHERE id=$1", [envelope.id])).rows[0].status_code, 200);
		assert.equal((await managedSend(pool, authority, "default", { operationId: "private-send", body: source, headers: { "x-synthetic-secret": "must-not-be-plaintext" } }, { encryptionKey })).reused, true);
	});
});

test("Runner revocation, creator removal and tenant boundaries deny further payload access", async () => {
	await fixture(async ({ pool, scope, destinationId, token }) => {
		await assert.rejects(claimRunnerDelivery(pool, "pabr_" + "0".repeat(64), encryptionKey), { code: "unauthenticated" });
		await assert.rejects(createRunnerCredential(pool, { userId: "unrelated-customer" }, destinationId));
		await pool.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'platform-staff')", [scope.installation]);
		await pool.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('platform-staff','instance',$1,'owner',$2)", [scope.installation, permissions]);
		await assert.rejects(createRunnerCredential(pool, { userId: "platform-staff" }, destinationId), { code: "forbidden" });
		await pool.query("UPDATE payloadbay.grant_record SET permissions='{}' WHERE scope_id=$1", [scope.organization]);
		await assert.rejects(claimRunnerDelivery(pool, token, encryptionKey), { code: "forbidden" });
		await pool.query("UPDATE payloadbay.grant_record SET permissions=$2 WHERE scope_id=$1", [scope.organization, permissions]);
		const rotated = await createRunnerCredential(pool, { userId: "fixture-owner" }, destinationId);
		await assert.rejects(claimRunnerDelivery(pool, token, encryptionKey), { code: "unauthenticated" });
		await revokeRunnerCredential(pool, { userId: "fixture-owner" }, destinationId);
		await assert.rejects(claimRunnerDelivery(pool, rotated.token, encryptionKey), { code: "unauthenticated" });
		assert.equal(JSON.stringify((await pool.query("SELECT redacted_diff FROM payloadbay.audit")).rows).includes(rotated.token), false);
	});
});

test("Runner timeout retains a failed attempt and stale acknowledgements cannot complete a replacement generation", async () => {
	await fixture(async ({ pool, authority, token }) => {
		const sending = managedSend(pool, authority, "default", { operationId: "offline", body: "request" }, { encryptionKey, timeoutMs: 1500 });
		const envelope = await pending(pool, token);
		const firstKey = envelope.idempotencyKey;
		await assert.rejects(completeRunnerDelivery(pool, token, String(envelope.id), "0".repeat(64), { networkError: "local_delivery_failed" }), { code: "stale_delivery" });
		const first = await sending;
		assert.equal(first.ok, false);
		assert.equal(first.networkError, "delivery_network_error");
		await assert.rejects(completeRunnerDelivery(pool, token, String(envelope.id), envelope.leaseToken, { networkError: "local_delivery_failed" }), { code: "stale_delivery" });
		const retry = managedSend(pool, authority, "default", { operationId: "offline", body: "request" }, { encryptionKey, timeoutMs: 1500 });
		const next = await pending(pool, token);
		assert.equal(next.idempotencyKey, firstKey);
		await pool.query("UPDATE payloadbay.execution SET lease_expiry=clock_timestamp() WHERE id=$1", [authority.executionId]);
		assert.deepEqual(await recoverExpired(pool), [authority.executionId]);
		await assert.rejects(completeRunnerDelivery(pool, token, String(next.id), next.leaseToken, { status: 204, bodyBase64: "", contentType: "" }), { code: "stale_delivery" });
		await assert.rejects(retry, { code: "stale_execution" });
	});
});

test("Runner completion contracts reject oversized or malformed response bytes", () => {
	for (const result of [{ status: 999, bodyBase64: "", contentType: "" }, { status: 200, bodyBase64: "not base64", contentType: "" }, { status: 200, bodyBase64: Buffer.alloc(65537).toString("base64"), contentType: "" }, { networkError: "arbitrary private diagnostic" }]) {
		assert.equal(runnerCompletion.safeParse({ leaseToken: "a".repeat(64), result }).success, false);
	}
});
