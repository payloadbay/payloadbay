import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, availableParallelism, totalmem, loadavg } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { withFixtures } from "../../scripts/tests/fixtures.ts";
import { database } from "../../packages/domain/src/db.ts";
import { prepareDevelopmentDatabase } from "../../packages/domain/src/development.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { executorFixture } from "../helpers/executor-fixture.ts";
import { fixtureEnvironment } from "../helpers/fixture-environment.ts";
import { compileSource } from "../../packages/domain/src/executor-client.ts";
import { scheduleDispatch } from "../../packages/domain/src/execution-lease.ts";
import { ensureNextBuild } from "../../scripts/tests/next-build.ts";

const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function percentile(values: number[], fraction: number) {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
}

/** Release acceptance against existing behavior, not an invented pre-implementation Red. */
test("PF01 real HTTP ingress and critical delivery meet fixture latency targets under bulk backlog", { timeout: 240000 }, async (t) => {
	ensureNextBuild();
	const directory = await mkdtemp(join(tmpdir(), "payloadbay-latency-"));
	const suffix = randomUUID().slice(0, 8);
	const appImage = "payloadbay-tests/performance-app:" + suffix;
	const workerImage = "payloadbay-tests/performance-worker:" + suffix;
	const started: string[] = [];
	const builtImages: string[] = [];
	try {
		// Preserve unrelated Docker drafts: benchmark committed Dockerfiles without changing the worktree.
		for (const file of ["Dockerfile.app", "Dockerfile.worker", "Dockerfile.executor"]) {
			await writeFile(join(directory, file), execFileSync("git", ["show", "HEAD:deploy/" + file]));
			let ignored: Buffer;
			try {
				ignored = execFileSync("git", ["show", "HEAD:deploy/" + file + ".dockerignore"], { stdio: ["ignore", "pipe", "pipe"] });
			} catch {
				ignored = execFileSync("git", ["show", "HEAD:.dockerignore"]);
			}

			await writeFile(join(directory, file + ".dockerignore"), ignored);
		}

		docker(["build", "--target", "smoke", "-f", join(directory, "Dockerfile.app"), "-t", appImage, "."]);
		builtImages.push(appImage);
		docker(["build", "-f", join(directory, "Dockerfile.worker"), "-t", workerImage, "."]);
		builtImages.push(workerImage);
		await withFixtures(async (fixture) => {
			await prepareDevelopmentDatabase(fixture.databaseUrl);
			const pool = database(fixture.databaseUrl);
			const db = await pool.connect();
			const executor = await executorFixture({ network: fixture.network, brokerUrl: "http://worker:8081/broker", dockerfile: join(directory, "Dockerfile.executor") });
			try {
				const scope = await seedScope(db);
				await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
				const config = { executorUrl: executor.url, executorToken: "fixture-executor-token-32-characters" };
				const ingress = await compileSource(config, { stage: "ingress", body: 'return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"stored"}});' });
				const processing = await compileSource(config, { stage: "processing", body: 'const result=await ctx.destinations.send("primary",{operationId:"primary",body:ctx.event.body});return result.ok?ctx.complete():ctx.retry({reason:"receiver unavailable"});' });
				const bulkProcessing = await compileSource(config, { stage: "processing", body: "await new Promise(resolve=>setTimeout(resolve,100));return ctx.complete();" });

				const revision = async (value: typeof ingress) => (await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [value.stage, value.body, value.bodyDigest, value.sdkVersion, value.bundle, value.bundleDigest, JSON.stringify(value.sourceMap)])).rows[0].id;

				const ingressId = await revision(ingress);
				const destination = {
					primary: {
						id: "primary",
						name: "primary",
						httpConfig: { url: "http://http:8080/delivery", method: "POST" },
						secretRefs: [],
						concurrency: 4,
						version: 1,
					},
				};
				const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,destination_snapshot,dependency_digest,created_by) VALUES($1,$2,$3,$4,'latency','fixture-owner') RETURNING id", [scope.endpoint, ingressId, await revision(processing), JSON.stringify(destination)])).rows[0].id;
				await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1,priority=0 WHERE id=$2", [publication, scope.endpoint]);
				const key = (await db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
				const bulk = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key,priority) VALUES($1,'Bulk backlog','bulk',gen_random_uuid()::text,100) RETURNING id", [scope.project])).rows[0].id;
				const bulkPublication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) VALUES($1,$2,$3,'latency-bulk','fixture-owner') RETURNING id", [bulk, ingressId, await revision(bulkProcessing)])).rows[0].id;
				await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [bulkPublication, bulk]);
				await db.query("BEGIN");
				try {
					for (let i = 0; i < 1000; i++) {
						const event = (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,accepted_body,headers,content_type) VALUES($1,$2,$3,$3,'{}','text/plain') RETURNING id", [bulk, bulkPublication, Buffer.from("synthetic bulk fixture")])).rows[0].id;
						const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING *", [event, bulk, bulkPublication])).rows[0];
						await scheduleDispatch(db, execution, 100);
					}

					await db.query("COMMIT");
				} catch (cause) {
					await db.query("ROLLBACK");
					throw cause;
				}

				const env = fixtureEnvironment(fixture, "http://app:3000");
				env.DATABASE_URL = fixture.containerDatabaseUrl;
				env.EXECUTOR_URL = "http://executor:8080";
				env.SMTP_HOST = "smtp";
				env.SMTP_PORT = "1025";
				const keys = ["DATABASE_URL", "PUBLIC_URL", "SMTP_HOST", "SMTP_PORT", "SMTP_FROM", "SMTP_SECURE", "BETTER_AUTH_SECRET", "PAYLOADBAY_ENCRYPTION_KEY", "PAYLOADBAY_BOOTSTRAP_SECRET", "PAYLOADBAY_EXECUTOR_TOKEN", "PAYLOADBAY_BROKER_SECRET", "EXECUTOR_URL"];
				const names = { app: "pab-latency-app-" + suffix, worker: "pab-latency-worker-" + suffix };
				for (const role of ["app", "worker"] as const) {
					docker(["run", "--rm", "-d", "--name", names[role], "--network", fixture.network, "--network-alias", role, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--pids-limit", "128", "--memory", "512m", "--cpus", "1", "--tmpfs", "/tmp:size=67108864,mode=1777", ...(role === "app" ? ["-p", "127.0.0.1::3000"] : []), ...keys.flatMap((name) => ["-e", name + "=" + env[name]]), role === "app" ? appImage : workerImage]);
					started.push(names[role]);
				}

				const url = "http://127.0.0.1:" + Number(docker(["port", names.app, "3000/tcp"]).split(":").at(-1));
				let ready = false;
				for (let i = 0; i < 100; i++) {
					try {
						if ((await fetch(url + "/api/auth/get-session", { signal: AbortSignal.timeout(1000) })).ok) {
							docker(["exec", names.worker, "node", "-e", 'fetch("http://localhost:8081/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))']);
							ready = true;
							break;
						}
					} catch {}

					await sleep(100, undefined, { signal: t.signal });
				}

				assert.equal(ready, true, "Real app and worker must be ready before measurement");

				const remainingBulk = async () => Number((await db.query("SELECT count(*)::int AS count FROM payloadbay.execution WHERE endpoint_id=$1 AND state IN ('queued','running','retry_wait')", [bulk])).rows[0].count);

				const bulkSamples = [await remainingBulk()];
				const acknowledgments: number[] = [];
				const failures: number[] = [];
				const pending: Promise<void>[] = [];
				const hostLoadBefore = loadavg();
				const began = performance.now();
				for (let i = 0; i < 600; i++) {
					await sleep(Math.max(0, began + i * 100 - performance.now()), undefined, { signal: t.signal });
					pending.push(
						(async () => {
							const start = performance.now();
							try {
								const response = await fetch(url + "/ingress/" + key, {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ fixture: "latency", sequence: i }),
									signal: AbortSignal.any([t.signal, AbortSignal.timeout(5000)]),
								});
								await response.arrayBuffer();
								if (response.status !== 202) failures.push(response.status);
							} catch {
								failures.push(0);
							}

							acknowledgments.push(performance.now() - start);
						})(),
					);
					if (i % 50 === 49) bulkSamples.push(await remainingBulk());
				}

				await Promise.all(pending);
				const launchAndAckMs = performance.now() - began;
				let completed = 0;
				for (let i = 0; i < 120; i++) {
					completed = (await db.query("SELECT count(*)::int AS count FROM payloadbay.execution WHERE endpoint_id=$1 AND state='succeeded'", [scope.endpoint])).rows[0].count;
					if (completed === 600) break;
					await sleep(250, undefined, { signal: t.signal });
				}

				const attempts = (
					await db.query(
						`SELECT x.id,e.received_at,min(extract(epoch FROM (a.started_at-e.received_at))*1000)::float8 AS latency_ms,
 min(extract(epoch FROM (f.occurred_at-e.received_at))*1000)::float8 AS queue_ms,
 min(extract(epoch FROM (a.started_at-f.occurred_at))*1000)::float8 AS claimed_to_attempt_ms,
 min(extract(epoch FROM (a.ended_at-a.started_at))*1000)::float8 AS http_ms
 FROM payloadbay.execution x JOIN payloadbay.event e ON e.id=x.event_id JOIN payloadbay.delivery_attempt a ON a.execution_id=x.id
 LEFT JOIN payloadbay.usage_fact f ON f.organization_id=$2 AND f.metric='processing.attempt.started' AND f.source_key=(x.id::text||':1')
 WHERE x.endpoint_id=$1 GROUP BY x.id,e.received_at`,
						[scope.endpoint, scope.organization],
					)
				).rows;
				const delivery = attempts.map((row) => Number(row.latency_ms));
				const metrics = {
					sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
					fixture: {
						architecture: process.arch,
						logicalCpus: availableParallelism(),
						hostMemoryBytes: totalmem(),
						appCpu: 1,
						workerCpu: 1,
						executorCpu: 1,
						appMemoryBytes: 536870912,
						workerMemoryBytes: 536870912,
						executorMemoryBytes: 805306368,
						executorMode: "runc",
						requests: 600,
						ratePerSecond: 10,
						durationSeconds: 60,
						bulkSeed: 1000,
						bulkScriptDelayMs: 100,
						priority: { critical: 0, bulk: 100 },
						warmupRequests: 0,
					},
					images: Object.fromEntries([names.app, names.worker, executor.name].map((name) => [name, docker(["inspect", "--format", "{{.Image}}", name])])),
					hostLoadBefore,
					hostLoadAfter: loadavg(),
					queueP95Ms: percentile(
						attempts.map((row) => Number(row.queue_ms)),
						0.95,
					),
					claimedToAttemptP95Ms: percentile(
						attempts.map((row) => Number(row.claimed_to_attempt_ms)),
						0.95,
					),
					httpP95Ms: percentile(
						attempts.map((row) => Number(row.http_ms)),
						0.95,
					),
					samples: attempts.map((row) => ({
						receivedAt: row.received_at.toISOString(),
						firstAttemptMs: row.latency_ms,
						queueMs: row.queue_ms,
						claimedToAttemptMs: row.claimed_to_attempt_ms,
						httpMs: row.http_ms,
					})),
					launchAndAckMs,
					ackSamples: acknowledgments.length,
					failedRequests: failures.length,
					completed,
					firstAttempts: delivery.length,
					bulkSamples,
					ackP95Ms: percentile(acknowledgments, 0.95),
					firstAttemptP95Ms: percentile(delivery, 0.95),
					firstAttemptMaxMs: delivery.length ? Math.max(...delivery) : null,
					latencyDefinition: "Real HTTP request through full response body; delivery starts measured from stored event.received_at (acceptance transaction timestamp), not ACK response time. Published bundles prepared before measurement; per-request workerd startup remains included.",
				};
				await writeFile(join(process.env.PAB_TEST_ARTIFACT_DIR!, "latency.json"), JSON.stringify(metrics, null, 2));
				console.log(
					JSON.stringify({
						ackP95Ms: metrics.ackP95Ms,
						firstAttemptP95Ms: metrics.firstAttemptP95Ms,
						firstAttemptMaxMs: metrics.firstAttemptMaxMs,
						completed,
						failedRequests: failures.length,
					}),
				);
				assert.equal(failures.length, 0, "Every request must be durably acknowledged");
				assert.equal(completed, 600, "Every measured event must reach the healthy receiver");
				assert.equal(delivery.length, 600);
				assert.ok(
					bulkSamples.every((count) => count > 0),
					"Lower-priority backlog must remain throughout measurement",
				);
				assert.ok(metrics.ackP95Ms !== null && metrics.ackP95Ms <= 1000, "p95 provider ACK must be <=1s");
				assert.ok(metrics.firstAttemptP95Ms !== null && metrics.firstAttemptP95Ms <= 2000, "p95 acceptance-to-first-attempt must be <=2s");
				assert.ok(metrics.firstAttemptMaxMs !== null && metrics.firstAttemptMaxMs <= 10000, "No critical event may wait >10s");
			} finally {
				for (const name of started.reverse()) docker(["rm", "-f", name]);
				started.length = 0;
				await executor.stop();
				db.release();
				await pool.end();
			}
		});
	} finally {
		for (const name of started.reverse()) docker(["rm", "-f", name]);
		await rm(directory, { recursive: true, force: true });
		for (const image of builtImages) docker(["image", "rm", image]);
	}
});
