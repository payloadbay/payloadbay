import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { authFixture, identity, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { fixtureEnvironment } from "../helpers/fixture-environment.ts";
import { executorFixture } from "../helpers/executor-fixture.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { bootstrapOwner } from "../../packages/domain/src/bootstrap.ts";
import { createAuth } from "../../packages/domain/src/auth-runtime.ts";
import { publish } from "../../packages/domain/src/publication.ts";
import { receiveIngress } from "../../packages/domain/src/ingress.ts";
import { executeSource } from "../../packages/domain/src/executor-client.ts";
import { compile } from "../../apps/executor/src/compiler.ts";
import { permissions } from "../../packages/contracts/src/permissions.ts";

type WorkerExit = [code: number | null, signal: NodeJS.Signals | null];

test("the real worker drains script and mail jobs, handles SIGINT and bounds a lost close acknowledgement", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pab-worker-close-"));
	try {
		// Trusted test preload: close the actual broker but lose its callback.
		const preload = join(directory, "lose-close-ack.mjs");
		await writeFile(preload, 'import {Server} from "node:http";const original=Server.prototype.close;Server.prototype.close=function(){return Reflect.apply(original,this,[]);};\n');
		await authFixture(async (f) => {
			const executor = await executorFixture();
			const workers: { child: ChildProcess; exited: Promise<WorkerExit> }[] = [];
			try {
				const scope = await seedScope(f.db);
				await identity(f.db, "fixture-owner");
				const config = { ...fixtureConfig(f), executorUrl: executor.url };
				await bootstrapOwner(f.pool, { userId: "fixture-owner", providedSecret: config.bootstrapSecret, expectedSecret: config.bootstrapSecret });
				await f.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'owner',$2) ON CONFLICT DO NOTHING", [scope.organization, permissions]);
				await f.db.query("INSERT INTO payloadbay.draft(endpoint_id,stage,body) VALUES($1,'ingress',$2),($1,'processing','return ctx.complete();')", [scope.endpoint, 'return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"Accepted"}});']);
				await publish(
					f.pool,
					{ userId: "fixture-owner" },
					{
						endpointId: scope.endpoint,
						expectedVersion: 1,
						draftVersions: { ingress: 1, processing: 1 },
						compile,
					},
				);
				const key = (await f.db.query("SELECT ingress_key FROM payloadbay.endpoint WHERE id=$1", [scope.endpoint])).rows[0].ingress_key;
				const accepted = await receiveIngress(
					f.pool,
					{
						key,
						body: new TextEncoder().encode("synthetic worker request"),
						headers: { "content-type": "text/plain" },
						method: "POST",
						url: "https://fixture.example.test/ingress/" + key,
					},
					{ encryptionKey: config.encryptionKey, run: (options) => executeSource(config, options) },
				);
				assert.equal(accepted.status, 202);
				const auth = createAuth(f.pool, config);
				try {
					await auth.api.sendVerificationOTP({ body: { email: "fixture-owner@example.test", type: "sign-in" } });
				} finally {
					await auth.close();
				}

				const start = (loseCloseAcknowledgement: boolean) => {
					const child = spawn(process.execPath, ["--import", "tsx", ...(loseCloseAcknowledgement ? ["--import", pathToFileURL(preload).href] : []), "apps/worker/src/main.ts"], { env: { ...fixtureEnvironment(f, config.publicUrl), EXECUTOR_URL: executor.url, PORT: "0" }, stdio: "ignore" });
					const worker = { child, exited: once(child, "exit") as Promise<WorkerExit> };
					workers.push(worker);

					return worker;
				};

				const until = async (child: ChildProcess, predicate: () => Promise<boolean>, label: string) => {
					const deadline = Date.now() + 20000;
					while (Date.now() < deadline) {
						assert.equal(child.exitCode, null, "Worker exited before " + label);
						assert.equal(child.signalCode, null, "Worker stopped before " + label);
						if (await predicate()) return;
						await new Promise((resolve) => setTimeout(resolve, 50));
					}

					const states = {
						executions: (await f.db.query("SELECT state,attempt_number FROM payloadbay.execution WHERE endpoint_id=$1", [scope.endpoint])).rows,
						mail: (await f.db.query("SELECT kind,state,left(last_error,200) AS error FROM payloadbay.platform_job")).rows,
						jobs: (await f.db.query("SELECT attempts,left(last_error,200) AS error FROM graphile_worker.jobs")).rows,
					};
					throw Error("Worker did not reach " + label + ": " + JSON.stringify(states));
				};

				const stopped = async (exited: Promise<WorkerExit>) => {
					let timer: ReturnType<typeof setTimeout> | undefined;
					try {
						return await Promise.race([
							exited,
							new Promise<never>((_resolve, reject) => {
								timer = setTimeout(() => reject(Error("Worker shutdown exceeded its bound")), 15000);
							}),
						]);
					} finally {
						clearTimeout(timer);
					}
				};

				const normal = start(false);
				await until(
					normal.child,
					async () => {
						const execution = (await f.db.query("SELECT state FROM payloadbay.execution WHERE endpoint_id=$1", [scope.endpoint])).rows[0];
						const mail = (await f.db.query("SELECT state FROM payloadbay.platform_job WHERE kind='otp_mail'")).rows[0];

						const ready = (await f.db.query("SELECT worker_seen_at IS NOT NULL AS ready FROM payloadbay.installation WHERE singleton")).rows[0].ready;

						return execution?.state === "succeeded" && mail?.state === "succeeded" && ready;
					},
					"durable script and mail completion",
				);
				assert.equal((await (await fetch(f.mailUrl + "/api/v1/messages")).json()).total, 1);
				normal.child.kill("SIGINT");
				assert.equal((await stopped(normal.exited))[0], 0);
				const began = (await f.db.query("SELECT clock_timestamp() AS started")).rows[0].started;
				const interrupted = start(true);
				await until(interrupted.child, async () => (await f.db.query("SELECT worker_seen_at>$1 AS ready FROM payloadbay.installation WHERE singleton", [began])).rows[0].ready, "ready worker heartbeat");
				const signalledAt = Date.now();
				interrupted.child.kill("SIGTERM");
				assert.equal((await stopped(interrupted.exited))[0], 1);
				assert.ok(Date.now() - signalledAt >= 9000, "The real shutdown watchdog must fire, rather than an unrelated early failure");
			} finally {
				for (const worker of workers) {
					if (worker.child.exitCode === null && worker.child.signalCode === null) worker.child.kill("SIGKILL");
					await worker.exited;
				}

				await executor.stop();
			}
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
