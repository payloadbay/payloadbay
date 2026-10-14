import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

test("non-root app standalone and executor runtime images start without host mounts", async () => {
	docker(["build", "-f", "deploy/Dockerfile.executor", "-t", "payloadbay-bootstrap/executor:local", "."]);
	assert.match(docker(["run", "--rm", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "payloadbay-bootstrap/executor:local", "--version"]), /2026-10-13/);
	docker(["build", "--target", "smoke", "-f", "deploy/Dockerfile.app", "-t", "payloadbay-bootstrap/app:local", "."]);
	const name = "pab-image-" + randomUUID().slice(0, 8);
	try {
		docker(["run", "-d", "--rm", "--name", name, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:size=16777216", "-p", "127.0.0.1::3000", "payloadbay-bootstrap/app:local"]);
		const port = Number(docker(["port", name, "3000/tcp"]).split(":").at(-1));
		let response: Response | undefined;
		for (let i = 0; i < 100; i++) {
			try {
				response = await fetch(`http://127.0.0.1:${port}/`);
				if (response.ok) break;
			} catch {}

			await new Promise((r) => setTimeout(r, 100));
		}

		assert.equal(response?.status, 200);
		const html = await response!.text();
		assert.match(html, /Payload Bay/);
		const css = html.match(/href="([^"]+\.css[^\"]*)"/);
		assert.ok(css);
		assert.equal((await fetch(`http://127.0.0.1:${port}${css[1]}`)).status, 200);
		const container = JSON.parse(docker(["inspect", name]))[0];
		assert.equal(container.Config.User, "node");
		assert.deepEqual(container.Mounts, []);
	} finally {
		docker(["rm", "-f", name]);
	}
});

test("U253 restricted worker image delivers accepted bytes through isolated executor", async () => {
	const { withFixtures } = await import("../../scripts/tests/fixtures.ts");
	const { prepareDevelopmentDatabase: migrate } = await import("../../packages/domain/src/development.ts");
	const { database } = await import("../../packages/domain/src/db.ts");
	const { seedScope } = await import("../helpers/domain-fixtures.ts");
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { fixtureEnvironment } = await import("../helpers/fixture-environment.ts");
	const { compileSource, executeSource } = await import("../../packages/domain/src/executor-client.ts");
	const { receiveIngress } = await import("../../packages/domain/src/ingress.ts");
	docker(["build", "-f", "deploy/Dockerfile.worker", "-t", "payloadbay-bootstrap/worker:local", "."]);
	await withFixtures(async (f) => {
		await migrate(f.databaseUrl);
		const pool = database(f.databaseUrl);
		const db = await pool.connect();
		const executor = await executorFixture({ network: f.network, brokerUrl: "http://worker:8081/broker" });
		const name = "pab-worker-" + randomUUID().slice(0, 8);
		let started = false;
		try {
			const scope = await seedScope(db);
			await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
			const config = { executorUrl: executor.url, executorToken: "fixture-executor-token-32-characters" };
			const ingress = await compileSource(config, { stage: "ingress", body: 'return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"stored"}});' });
			const processing = await compileSource(config, { stage: "processing", body: 'const delivery=await ctx.destinations.send("primary",{operationId:"primary",body:ctx.event.body});return delivery.ok?ctx.complete():ctx.retry({reason:"delivery failed"});' });

			const revision = async (value: typeof ingress) => (await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [value.stage, value.body, value.bodyDigest, value.sdkVersion, value.bundle, value.bundleDigest, JSON.stringify(value.sourceMap)])).rows[0].id;

			const snapshot = {
				"fixture-target": {
					id: "fixture-target",
					name: "primary",
					httpConfig: { url: "http://http:8080/delivery", method: "POST" },
					secretRefs: [],
					concurrency: 4,
					version: 1,
				},
			};
			const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) VALUES($1,$2,$3,$4,'fixture','fixture-owner') RETURNING id", [scope.endpoint, await revision(ingress), await revision(processing), JSON.stringify(snapshot)])).rows[0].id;
			await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [publication, scope.endpoint]);
			const key = (await db.query("SELECT ingress_key FROM payloadbay.endpoint")).rows[0].ingress_key;
			const response = await receiveIngress(
				pool,
				{
					key,
					body: new Uint8Array([0, 255, 42]),
					headers: {},
					method: "POST",
					url: "https://fixture.test",
				},
				{ encryptionKey: "fixture-encryption-key-32-characters", run: (input) => executeSource(config, input) },
			);
			assert.equal(response.status, 202);
			const env = fixtureEnvironment(f, "http://app:3000");
			env.DATABASE_URL = f.containerDatabaseUrl;
			env.SMTP_HOST = "smtp";
			env.SMTP_PORT = "1025";
			env.EXECUTOR_URL = "http://executor:8080";
			const keys = ["DATABASE_URL", "PUBLIC_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM", "SMTP_SECURE", "BETTER_AUTH_SECRET", "PAYLOADBAY_ENCRYPTION_KEY", "PAYLOADBAY_BOOTSTRAP_SECRET", "PAYLOADBAY_EXECUTOR_TOKEN", "PAYLOADBAY_BROKER_SECRET", "EXECUTOR_URL"];
			docker(["run", "--rm", "-d", "--name", name, "--network", f.network, "--network-alias", "worker", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--pids-limit", "128", "--memory", "512m", "--tmpfs", "/tmp:size=16777216,mode=1777", ...keys.flatMap((key) => ["-e", key + "=" + env[key]]), "payloadbay-bootstrap/worker:local"]);
			started = true;
			let state = "";
			for (let i = 0; i < 100; i++) {
				state = (await db.query("SELECT state FROM payloadbay.execution")).rows[0].state;
				if (state === "succeeded") break;
				await new Promise((r) => setTimeout(r, 50));
			}

			assert.equal(state, "succeeded", "worker image must complete real destination delivery");
			const receipts = await (await fetch(f.httpUrl + "/receipts")).json();
			assert.equal(receipts.length, 1);
			assert.equal(receipts[0].body, Buffer.from([0, 255, 42]).toString("base64"));
			assert.equal((await db.query("SELECT status_code FROM payloadbay.delivery_attempt")).rows[0].status_code, 200);
			const container = JSON.parse(docker(["inspect", name]))[0];
			assert.equal(container.Config.User, "node");
			assert.deepEqual(container.Mounts, []);
		} finally {
			if (started) docker(["rm", "-f", name]);
			await executor.stop();
			db.release();
			await pool.end();
		}
	});
});
