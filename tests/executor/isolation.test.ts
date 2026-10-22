import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../../apps/executor/src/compiler.ts";
import { execute } from "../../apps/executor/src/supervisor.ts";
import { Server, createServer } from "node:net";

test("U17 configured code cannot write host SSH key", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pab-ssh-fixture-"));
	const path = join(directory, "authorized_keys");
	try {
		const script = await compile({ stage: "processing", body: `const fs=(globalThis as any).require('node:fs');fs.writeFileSync(${JSON.stringify(path)},'fixture-key');return {kind:'complete'};` });
		await assert.rejects(execute({ bundle: script.bundle, stage: "processing", input: {} }), { code: "execution_error" });
		await assert.rejects(access(path), { code: "ENOENT" });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("U18 configured code cannot spawn native subprocess", async () => {
	const script = await compile({ stage: "processing", body: '(globalThis as any).process.getBuiltinModule("node:child_process").execSync("printf fixture");return {kind:"complete"};' });
	await assert.rejects(execute({ bundle: script.bundle, stage: "processing", input: {} }), { code: "execution_error" });
});

test("U19 configured code cannot import native addon", async () => {
	await assert.rejects(execute({ stage: "processing", input: {}, bundle: 'import addon from "node:sqlite";export default async function(){return {kind:"complete"};}' }), { code: "runtime_startup_failed" });
});

test("U20 configured code cannot read unrelated platform credentials", async () => {
	const previous = process.env.PAYLOADBAY_FIXTURE_SECRET;
	process.env.PAYLOADBAY_FIXTURE_SECRET = "synthetic-platform-secret";
	try {
		const script = await compile({ stage: "processing", body: 'if((globalThis as any).process?.env?.PAYLOADBAY_FIXTURE_SECRET)throw Error("credential_leaked");return {kind:"complete"};' });
		const result = await execute({ bundle: script.bundle, stage: "processing", input: {} });
		assert.deepEqual(result.decision, { kind: "complete" });
		assert.doesNotMatch(JSON.stringify(result), /synthetic-platform-secret/);
	} finally {
		if (previous === undefined) delete process.env.PAYLOADBAY_FIXTURE_SECRET;
		else process.env.PAYLOADBAY_FIXTURE_SECRET = previous;
	}
});

import { withFixtures } from "../../scripts/tests/fixtures.ts";

test("U21 route scripts cannot bypass tracked destinations with direct fetch", async () => {
	await withFixtures(async (f) => {
		const script = await compile({ stage: "processing", body: `try { await fetch(${JSON.stringify(f.httpUrl + "/delivery")},{method:'POST',body:'fixture'});return ctx.fail({reason:"direct HTTP escaped"}); } catch { return ctx.complete(); }` });
		const result = await execute({
			bundle: script.bundle,
			stage: "processing",
			input: {},
			maxFetches: 8,
		});
		assert.deepEqual(result.decision, { kind: "complete" });
		assert.deepEqual(await (await fetch(f.httpUrl + "/receipts")).json(), []);
	});
});

test("U22 nonyielding script terminates at configured deadline", async () => {
	const script = await compile({ stage: "processing", body: "while(true){}" });
	const started = performance.now();
	await assert.rejects(
		execute({
			bundle: script.bundle,
			stage: "processing",
			input: {},
			deadlineMs: 150,
		}),
		{ code: "deadline_exceeded" },
	);
	assert.ok(performance.now() - started < 1000, "deadline must interrupt nonyielding code promptly");
});

test("U23 RSS quota terminates allocating script", async () => {
	const script = await compile({ stage: "processing", body: "const chunks:Uint8Array[]=[];while(true){const bytes=new Uint8Array(1024*1024);bytes.fill(1);chunks.push(bytes);}" });
	await assert.rejects(
		execute({
			bundle: script.bundle,
			stage: "processing",
			input: {},
			memoryBytes: 96 * 1024 * 1024,
			deadlineMs: 3000,
		}),
		{ code: "memory_limit_exceeded" },
	);
});

test("U24 log burst cannot exceed configured quota", async () => {
	const script = await compile({ stage: "processing", body: 'for(let i=0;i<100;i++){ctx.log.info("x".repeat(128));}return {kind:"complete"};' });
	await assert.rejects(
		execute({
			bundle: script.bundle,
			stage: "processing",
			input: {},
			logBytes: 512,
		}),
		{ code: "log_limit_exceeded" },
	);
});

import { createExecutor } from "../../apps/executor/src/supervisor.ts";

test("U25 processing failure leaves reserved ingress capacity", async () => {
	const processing = await compile({ stage: "processing", body: "while(true){}" });
	const ingress = await compile({ stage: "ingress", body: 'return {kind:"respondOnly",response:{status:200,body:"ready"}};' });
	const executor = createExecutor({ ingressConcurrency: 1, processingConcurrency: 1 });
	let processingFinished = false;
	const failed = executor
		.run({
			stage: "processing",
			bundle: processing.bundle,
			input: {},
			deadlineMs: 600,
		})
		.catch((error) => {
			processingFinished = true;
			assert.equal(error.code, "deadline_exceeded");
		});
	try {
		const response = await executor.run({
			stage: "ingress",
			bundle: ingress.bundle,
			input: {},
			deadlineMs: 300,
		});
		assert.deepEqual(response.decision, { kind: "respondOnly", response: { status: 200, body: "ready" } });
		assert.equal(processingFinished, false, "processing capacity must not block reserved ingress");
	} finally {
		await failed;
	}
});

test("U187 cancellation interrupts a nonyielding script", async () => {
	const script = await compile({ stage: "processing", body: "while(true){}" });
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 100);
	try {
		await assert.rejects(
			execute({
				bundle: script.bundle,
				stage: "processing",
				input: {},
				signal: controller.signal,
				deadlineMs: 1000,
			}),
			{ code: "cancelled" },
		);
	} finally {
		clearTimeout(timer);
	}
});

test("U188 oversized script result is rejected", async () => {
	const script = await compile({ stage: "ingress", body: 'return {kind:"respondOnly",response:{status:200,body:"x".repeat(2*1024*1024)}};' });
	await assert.rejects(execute({ bundle: script.bundle, stage: "ingress", input: {} }), { code: "result_limit_exceeded" });
});

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

test("U189 standard Docker executor starts without host mounts", async () => {
	const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	docker(["build", "--target", "runner", "-f", "deploy/Dockerfile.executor", "-t", "payloadbay-bootstrap/executor-runner:local", "."]);
	const name = "pab-executor-" + randomUUID().slice(0, 8);
	const token = "fixture-executor-token-32-characters";
	try {
		docker(["run", "--rm", "-d", "--name", name, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--pids-limit", "128", "--memory", "768m", "--cpus", "1", "--tmpfs", "/tmp:size=67108864,mode=1777", "-e", "PAYLOADBAY_EXECUTOR_TOKEN=" + token, "-p", "127.0.0.1::8080", "payloadbay-bootstrap/executor-runner:local"]);
		const port = Number(docker(["port", name, "8080/tcp"]).split(":").at(-1));
		let health: Response | undefined;
		for (let i = 0; i < 100; i++) {
			try {
				health = await fetch(`http://127.0.0.1:${port}/health`);
				if (health.status !== 503) break;
			} catch {}

			await new Promise((r) => setTimeout(r, 50));
		}

		assert.equal(health?.status, 200, "executor readiness must prove real runtime startup");
		const run = await fetch(`http://127.0.0.1:${port}/execute`, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ stage: "processing", input: {}, bundle: 'export default async function(){return {kind:"complete"};}' }) });
		assert.equal(run.status, 200);
		assert.deepEqual((await run.json()).decision, { kind: "complete" });
		assert.equal((await fetch(`http://127.0.0.1:${port}/execute`, { method: "POST", body: "{}" })).status, 401);
		const state = JSON.parse(docker(["inspect", name]))[0];
		assert.equal(state.Config.User, "node");
		assert.deepEqual(state.Mounts, []);
		assert.equal(state.HostConfig.ReadonlyRootfs, true);
	} finally {
		docker(["rm", "-f", name]);
	}
});

import { validateRuntime } from "../../scripts/tests/runtime.ts";

test("U26 explicitly unavailable runsc fails at deployment", () => {
	assert.throws(() => validateRuntime("runsc", { runc: {} }), /Set PAYLOADBAY_EXECUTOR_RUNTIME=runc/);

	const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	const runtimes = JSON.parse(docker(["info", "--format", "{{json .Runtimes}}"]));
	if (!runtimes.runsc) assert.throws(() => docker(["run", "--rm", "--runtime", "runsc", "payloadbay-bootstrap/executor-runner:local"]), /unknown or invalid runtime name: runsc/);
	else assert.match(docker(["run", "--rm", "--runtime", "runsc", "--entrypoint", "workerd", "payloadbay-bootstrap/executor-runner:local", "--version"]), /2026-10-13/);
});

test("U249 script SDK helpers preserve bytes and invoke managed destination", async () => {
	const ingress = await compile({ stage: "ingress", body: 'if(!(ctx.request.body instanceof Uint8Array))throw Error("bytes unavailable");return ctx.accept({event:{body:ctx.request.body,contentType:"application/octet-stream",metadata:{literal:["b","not-base64"]}},response:{status:202,body:"stored"}});' });
	const bytes = new Uint8Array([0, 255, 42]);
	const accepted = await execute({ stage: "ingress", bundle: ingress.bundle, input: { request: { body: bytes } } });
	assert.deepEqual(accepted.decision, { kind: "accept", event: { body: bytes, contentType: "application/octet-stream", metadata: { literal: ["b", "not-base64"] } }, response: { status: 202, body: "stored" } });
	const processing = await compile({ stage: "processing", body: 'const result=await ctx.destinations.send("default",{operationId:"primary",body:ctx.event.body});return result.ok?ctx.complete():ctx.retry({reason:"delivery failed"});' });
	const sent: unknown[] = [];
	const result = await execute({
		stage: "processing",
		bundle: processing.bundle,
		input: { event: { body: bytes } },
		broker: async (target, input) => {
			sent.push({ target, input });

			return { ok: true, status: 204, attemptId: "fixture" };
		},
	});
	assert.deepEqual(result.decision, { kind: "complete" });
	assert.deepEqual(sent, [{ target: "default", input: { operationId: "primary", body: bytes } }]);
});

test("U252 tracked destination bridge preserves a large binary request body", async () => {
	await withFixtures(async (f) => {
		const script = await compile({ stage: "processing", body: 'const bytes=new Uint8Array(140000);bytes.fill(255);bytes[0]=0;const reply=await ctx.destinations.post({body:bytes});return reply.ok?ctx.complete():ctx.fail({reason:"HTTP failed"});' });
		const result = await execute({
			stage: "processing",
			bundle: script.bundle,
			input: {},
			broker: async (target, input) => {
				assert.equal(target, "default");
				const request = input as { body: Uint8Array; method: string };
				assert.equal(request.method, "POST");
				const response = await fetch(f.httpUrl + "/delivery", { method: request.method, body: Buffer.from(request.body) });

				return { ok: response.ok, status: response.status, attemptId: "fixture" };
			},
		});
		assert.deepEqual(result.decision, { kind: "complete" });
		const receipts = await (await fetch(f.httpUrl + "/receipts")).json();
		const body = Buffer.from(receipts[0].body, "base64");
		assert.equal(body.length, 140000);
		assert.equal(body[0], 0);
		assert.equal(body[139999], 255);
	});
});

test("U258 quoted and multiline secrets are redacted from structured logs", async () => {
	const script = await compile({ stage: "processing", body: "ctx.log.info(ctx.secrets.KEY,{nested:{value:ctx.secrets.KEY}});return ctx.complete();" });
	const result = await execute({ stage: "processing", bundle: script.bundle, input: { secrets: { KEY: 'fixture-secret\n"quoted"' } } });
	assert.equal(result.logs[0].message, "[redacted]", "structured logs must redact escaped secret values");
	assert.deepEqual(result.logs[0].data, { nested: { value: "[redacted]" } });
});

test("EX34 ingress startup survives another listener taking a released ephemeral port", async () => {
	const script = await compile({ stage: "ingress", body: 'return ctx.respondOnly({status:200,body:"own execution"});' });
	const descriptor = Object.getOwnPropertyDescriptor(Server.prototype, "close")!;
	const close = Server.prototype.close;
	const competitors: Server[] = [];
	let reclaimed = false;
	let reclaimFailure: unknown;
	Object.defineProperty(Server.prototype, "close", {
		...descriptor,
		value: function (this: Server, callback?: (error?: Error) => void) {
			const address = this.address();
			if (reclaimed || !address || typeof address === "string") return close.call(this, callback);
			reclaimed = true;

			return close.call(this, (error) => {
				if (error) return callback?.(error);
				const competitor = createServer((socket) => socket.destroy());
				competitors.push(competitor);
				competitor.once("error", (failure) => {
					reclaimFailure = failure;
					callback?.();
				});
				competitor.listen(address.port, address.address, () => callback?.());
			});
		},
	});
	try {
		const result = await execute({ stage: "ingress", bundle: script.bundle, input: {} });
		assert.equal(reclaimFailure, undefined);
		assert.equal(reclaimed, true);
		assert.deepEqual(result.decision, { kind: "respondOnly", response: { status: 200, body: "own execution" } });
	} finally {
		Object.defineProperty(Server.prototype, "close", descriptor);
		await Promise.all(competitors.map((server) => new Promise<void>((resolve) => close.call(server, () => resolve()))));
	}
});

test("CF11 platform notification code cannot fetch loopback infrastructure", async () => {
	await withFixtures(async (fixture) => {
		const before = await (await fetch(fixture.httpUrl + "/receipts")).json();
		const script = await compile({ stage: "notification", body: `try { await fetch(${JSON.stringify(fixture.httpUrl + "/delivery")},{method:'POST',body:'private probe'}); return ctx.fail({ reason: 'private target reached' }); } catch { return ctx.complete(); }` });
		const result = await execute({ stage: "notification", bundle: script.bundle, input: {} });
		assert.deepEqual(result.decision, { kind: "complete" });
		assert.equal((await (await fetch(fixture.httpUrl + "/receipts")).json()).length, before.length);
	});
});

test("CF12 notification transport pins DNS and bounds responses with operator-only private targets", async () => {
	const { notificationFetch, publicAddress } = await import("../../apps/executor/src/notification-fetch.ts");
	const { createServer } = await import("node:http");
	const { networkInterfaces } = await import("node:os");
	const { gzipSync, deflateSync, brotliCompressSync } = await import("node:zlib");
	for (const address of ["127.0.0.1", "169.254.169.254", "10.0.0.1", "100.100.100.200", "192.168.0.1", "0.0.0.0", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fd00:ec2::254", "2001:db8::1", "invalid"]) assert.equal(publicAddress(address), false, address);
	for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(publicAddress(address), true, address);

	const signal = () => AbortSignal.timeout(5000);

	for (const value of ["http://127.0.0.1/", "http://2130706433/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/", "http://100.100.100.200/", "http://[fd00:ec2::254]/", "http://localhost/"]) await assert.rejects(notificationFetch(new URL(value), { method: "GET", headers: {}, signal: signal() }, [new URL(value).hostname.replace(/^\[|\]$/g, "")]), /notification_target_blocked/);
	await assert.rejects(notificationFetch(new URL("ftp://example.test/"), { method: "GET", headers: {}, signal: signal() }), /invalid_target/);
	await assert.rejects(notificationFetch(new URL("https://user:pass@example.test/"), { method: "GET", headers: {}, signal: signal() }), /invalid_target/);
	await assert.rejects(notificationFetch(new URL("http://example.test/"), { method: "GET", headers: {}, signal: AbortSignal.abort() }));
	const address = Object.values(networkInterfaces())
		.flat()
		.find((entry) => entry?.family === "IPv4" && !entry.internal)!.address;
	let requests = 0;
	const server = createServer((request, response) => {
		requests++;
		assert.ok([address + ":" + (server.address() as import("node:net").AddressInfo).port, "configured.invalid:" + (server.address() as import("node:net").AddressInfo).port].includes(request.headers.host!));
		if (request.url === "/redirect") {
			response.writeHead(302, { location: "http://169.254.169.254/" }).end();

			return;
		}

		if (request.url === "/empty") {
			response.writeHead(204).end();

			return;
		}

		if (request.url === "/large") {
			response.end(Buffer.alloc(1048577));

			return;
		}

		if (request.url === "/bomb") {
			response.setHeader("content-encoding", "gzip");
			response.end(gzipSync(Buffer.alloc(1048577)));

			return;
		}

		const text = Buffer.from("bounded reply");
		const encodings = { "/gzip": ["gzip", gzipSync(text)], "/deflate": ["deflate", deflateSync(text)], "/br": ["br", brotliCompressSync(text)] } as const;
		const encoded = encodings[request.url as keyof typeof encodings];
		if (encoded) {
			response.setHeader("content-encoding", encoded[0]);
			response.end(encoded[1]);
		} else response.end(text);
	});
	await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
	const url = "http://" + address + ":" + (server.address() as import("node:net").AddressInfo).port;

	const get = (path: string) => notificationFetch(new URL(path, url), { method: "GET", headers: { host: "wrong-host" }, signal: signal() }, [address]);

	try {
		const dns = await import("node:dns/promises");
		const { syncBuiltinESMExports } = await import("node:module");
		const pinned = test.mock.method(dns.default, "lookup", (async () => [{ address, family: 4 }]) as unknown as typeof dns.lookup);
		syncBuiltinESMExports();
		try {
			const target = new URL(url);
			target.hostname = "configured.invalid";
			assert.equal(await (await notificationFetch(target, { method: "GET", headers: {}, signal: signal() }, ["configured.invalid"])).text(), "bounded reply");
			assert.equal(pinned.mock.callCount(), 1, "Connection must use the validated answer, not resolve the hostname again");
		} finally {
			pinned.mock.restore();
			syncBuiltinESMExports();
		}

		for (const path of ["/", "/gzip", "/deflate", "/br"]) assert.equal(await (await get(path)).text(), "bounded reply");
		const before = requests;
		assert.equal((await get("/redirect")).status, 302);
		assert.equal(requests, before + 1, "Redirects must never be followed");
		assert.equal(await (await get("/empty")).text(), "");
		assert.equal(await (await notificationFetch(new URL(url), { method: "HEAD", headers: {}, signal: signal() }, [address])).text(), "");
		await assert.rejects(get("/large"), /response_limit/);
		await assert.rejects(get("/bomb"));
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}

	await assert.rejects(get("/"));
});

test("route code cannot use an arbitrary URL target even after bypassing TypeScript", async () => {
	const script = await compile({ stage: "processing", body: 'try { await ctx.destinations.send({url:"https://unconfigured.example"} as any,{operationId:"probe",body:"private"}); return ctx.fail({reason:"unexpected target"}); } catch { return ctx.complete(); }' });
	let called = false;
	const result = await execute({
		stage: "processing",
		bundle: script.bundle,
		input: {},
		broker: async () => {
			called = true;

			return { ok: true, attemptId: "unexpected" };
		},
	});
	assert.deepEqual(result.decision, { kind: "complete" });
	assert.equal(called, false);
});
