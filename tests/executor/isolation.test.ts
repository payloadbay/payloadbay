import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../../apps/executor/src/compiler.ts";
import { execute } from "../../apps/executor/src/supervisor.ts";

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

test("U21 bounded direct fetch is available to scripts", async () => {
	await withFixtures(async (f) => {
		const script = await compile({ stage: "processing", body: `const response=await fetch(${JSON.stringify(f.httpUrl + "/delivery")},{method:'POST',body:'fixture'});let limited=false;try{await fetch(${JSON.stringify(f.httpUrl + "/health")});}catch{limited=true;}return response.status===200&&limited?{kind:'complete'}:{kind:'fail',reason:'fetch availability or quota failed'};` });
		const result = await execute({
			bundle: script.bundle,
			stage: "processing",
			input: {},
			maxFetches: 1,
		});
		assert.deepEqual(result.decision, { kind: "complete" });
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

test("U252 direct fetch preserves a large binary request body", async () => {
	await withFixtures(async (f) => {
		const script = await compile({ stage: "processing", body: `const bytes=new Uint8Array(140000);bytes.fill(255);bytes[0]=0;const reply=await fetch(${JSON.stringify(f.httpUrl + "/delivery")},{method:'POST',body:bytes});return reply.ok?ctx.complete():ctx.fail({reason:"HTTP failed"});` });
		const result = await execute({ stage: "processing", bundle: script.bundle, input: {} });
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
