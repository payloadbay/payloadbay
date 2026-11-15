import test from "node:test";
import assert from "node:assert/strict";
import { nextFixture } from "../helpers/next-fixture.ts";
import { seedScope, seedEvent } from "../helpers/domain-fixtures.ts";
import { permissions } from "../../packages/contracts/src/permissions.ts";
import { createDestination } from "../../packages/domain/src/destinations.ts";
import { createToken } from "../../packages/domain/src/tokens.ts";
import { claimExecution } from "../../packages/domain/src/execution-lease.ts";
import { managedSend } from "../../packages/domain/src/delivery.ts";

async function protocolClient(server: string, target: string, token: string) {
	const authorization = "Bearer " + token;
	const claim = await fetch(server + "/api/v1/runner/claim", { method: "POST", headers: { authorization } });
	if (claim.status === 204) return { state: "idle" };
	assert.equal(claim.status, 200);
	const envelope = await claim.json();
	const local = await fetch(target, {
		method: envelope.method,
		headers: { ...envelope.headers, "x-payloadbay-delivery-id": envelope.idempotencyKey },
		body: ["GET", "HEAD"].includes(envelope.method) ? undefined : Buffer.from(envelope.bodyBase64, "base64"),
		redirect: "manual",
	});
	const result = { status: local.status, bodyBase64: Buffer.from(await local.arrayBuffer()).toString("base64"), contentType: local.headers.get("content-type") ?? "" };
	const completion = await fetch(server + "/api/v1/runner/deliveries/" + envelope.id + "/complete", { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ leaseToken: envelope.leaseToken, result }) });
	assert.equal(completion.status, 204);

	return { state: "reported" };
}

test("Runner real Next APIs deliver private bytes, reject ambient authority and revoke derived credentials", async () => {
	await nextFixture(async (f) => {
		const scope = await seedScope(f.db);
		await f.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2)", [scope.organization, permissions]);
		const key = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Runner setup",
				permissions: ["destinations.configure", "payload.read"],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		const destination = await createDestination(f.pool, { userId: "fixture-owner" }, { projectId: scope.project, name: "Private receiver", url: "http://runner.invalid" });
		const setupPath = f.url + "/api/v1/destinations/" + destination.id + "/runner";
		const configured = await fetch(setupPath, { method: "POST", headers: { authorization: "Bearer " + key.secret } });
		assert.equal(configured.status, 200);
		assert.equal(configured.headers.get("cache-control"), "no-store");
		const credential = await configured.json();
		for (const authorization of ["", "Bearer " + key.secret, "Bearer pabr_" + "0".repeat(64)]) {
			assert.equal((await fetch(f.url + "/api/v1/runner/claim", { method: "POST", headers: { authorization } })).status, 401);
		}

		const http = (await f.db.query("SELECT http_config FROM payloadbay.destination WHERE id=$1", [destination.id])).rows[0].http_config;
		const publication = (
			await f.db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) SELECT endpoint_id,ingress_revision_id,processing_revision_id,$1,'runner-http','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [
				JSON.stringify({
					private: {
						id: destination.id,
						isDefault: true,
						name: "Private receiver",
						httpConfig: http,
					},
				}),
				scope.publication,
			])
		).rows[0].id;
		const eventId = await seedEvent(f.db, { endpoint: scope.endpoint, publication });
		const executionId = (await f.db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [eventId, scope.endpoint, publication])).rows[0].id;
		await claimExecution(f.pool, executionId, 1, "runner-http-worker");
		const sending = managedSend(
			f.pool,
			{
				executionId,
				endpointId: scope.endpoint,
				generation: 1,
				owner: "runner-http-worker",
			},
			"default",
			{ operationId: "private-api-send", body: Buffer.from([0, 255, 42]) },
			{ encryptionKey: "fixture-encryption-key-32-characters", timeoutMs: 10000 },
		);
		const external = process.env.PAB_RUNNER_MODULE ? await import(process.env.PAB_RUNNER_MODULE) : null;

		async function deliverPending() {
			for (let i = 0; i < 100; i++) {
				const outcome = external ? await external.runOnce(external.configuration({ PAYLOADBAY_URL: f.url, PAYLOADBAY_RUNNER_TARGET: f.httpUrl + "/delivery", PAYLOADBAY_RUNNER_TOKEN: credential.token })) : await protocolClient(f.url, f.httpUrl + "/delivery", credential.token);
				if (outcome.state === "reported") return;
				await new Promise((resolve) => setTimeout(resolve, 20));
			}

			assert.fail("Runner did not report the pending delivery");
		}

		await deliverPending();
		assert.equal((await sending).ok, true);
		assert.equal((await (await fetch(f.httpUrl + "/receipts")).json())[0].body, Buffer.from([0, 255, 42]).toString("base64"));
		for (const method of ["GET", "HEAD"] as const) {
			const sendingMethod = managedSend(
				f.pool,
				{
					executionId,
					endpointId: scope.endpoint,
					generation: 1,
					owner: "runner-http-worker",
				},
				"default",
				{ operationId: "private-api-" + method, method, body: "" },
				{ encryptionKey: "fixture-encryption-key-32-characters", timeoutMs: 10000 },
			);
			await deliverPending();
			assert.equal((await sendingMethod).ok, true);
			const receipt = (await (await fetch(f.httpUrl + "/receipts")).json()).at(-1);
			assert.equal(receipt.method, method);
			assert.equal(receipt.body, "");
		}

		const headers = { authorization: "Bearer " + credential.token, "content-type": "application/json" };
		assert.equal((await fetch(f.url + "/api/v1/runner/deliveries/" + crypto.randomUUID() + "/complete", { method: "POST", headers, body: JSON.stringify({ leaseToken: "a".repeat(64), result: { networkError: "local_delivery_failed" } }) })).status, 409);
		await f.db.query("UPDATE payloadbay.api_token SET revoked_at=clock_timestamp() WHERE id=$1", [key.id]);
		assert.equal((await fetch(f.url + "/api/v1/runner/claim", { method: "POST", headers })).status, 401, "revoking the setup API key also revokes its derived Runner authority");
		const deleted = await fetch(setupPath, { method: "DELETE", headers: { authorization: "Bearer " + key.secret } });
		assert.equal(deleted.status, 401);
		const ownerKey = await createToken(
			f.pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Revoke Runner",
				permissions: ["destinations.configure", "payload.read"],
				expiresAt: new Date(Date.now() + 60000),
			},
		);
		assert.equal((await fetch(setupPath, { method: "DELETE", headers: { authorization: "Bearer " + ownerKey.secret } })).status, 200);
	});
});
