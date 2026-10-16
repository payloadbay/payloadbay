import test from "node:test";
import assert from "node:assert/strict";

test("U240 isolated compiler preserves bundles and body diagnostics", async () => {
	const { compileIsolated } = await import("../../apps/executor/src/compile-rpc.ts");
	const { CompilationError } = await import("../../apps/executor/src/compiler.ts");
	const result = await compileIsolated({ stage: "ingress", body: 'return ctx.respondOnly({status:200,body:"exact"});' });
	assert.equal(result.stage, "ingress");
	assert.match(result.bundle, /exact/);
	assert.equal(result.sdkVersion, "1");
	await assert.rejects(compileIsolated({ stage: "ingress", body: "return ctx.respondOnly({status:200,body:;" }), (error) => error instanceof CompilationError && error.diagnostics.some((d) => d.line === 1));
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(compileIsolated({ stage: "processing", body: "return ctx.complete();" }, controller.signal), { code: "cancelled" });
});

test("U242 TypeScript reference directives cannot read a host canary", async () => {
	const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { compile, CompilationError } = await import("../../apps/executor/src/compiler.ts");
	const dir = await mkdtemp(join(tmpdir(), "payloadbay-canary-"));
	try {
		const path = join(dir, "private.d.ts");
		await writeFile(path, "declare const canary: PRIVATE_CANARY_TYPE_MUST_NEVER_LEAK;");
		let caught: unknown;
		try {
			await compile({ stage: "processing", body: "return helper.handle();", sharedModules: { helper: { revisionId: "fixture", source: '/// <reference path="' + path + '" />\nexport function handle(){return {kind:"complete"} as const;}' } } });
		} catch (error) {
			caught = error;
		}

		assert.ok(caught instanceof CompilationError);
		assert.equal(caught.diagnostics[0].code, "unregistered_reference", "host references must be denied before reading them");
		assert.equal(JSON.stringify(caught.diagnostics).includes("PRIVATE_CANARY_TYPE_MUST_NEVER_LEAK"), false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("U243 large compiler result is flushed before child exits", async () => {
	const { compileIsolated } = await import("../../apps/executor/src/compile-rpc.ts");
	const body = "return ctx.respondOnly({status:200,body:" + JSON.stringify("x".repeat(120000)) + "});";
	let result: Awaited<ReturnType<typeof compileIsolated>> | undefined;
	let failed: unknown;
	try {
		result = await compileIsolated({ stage: "ingress", body });
	} catch (error) {
		failed = error;
	}

	assert.equal(failed, undefined, "large compiler results must flush before exit");
	assert.equal(result?.body, body);
});

test("U241 prebuilt executor provides authenticated compilation", async () => {
	const { execFileSync } = await import("node:child_process");
	const { randomUUID } = await import("node:crypto");

	const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

	docker(["build", "--target", "runner", "-f", "deploy/Dockerfile.executor", "-t", "payloadbay-bootstrap/executor-compiler:local", "."]);
	const name = "pab-compiler-" + randomUUID().slice(0, 8);
	const token = "fixture-executor-token-32-characters";
	try {
		docker(["run", "--rm", "-d", "--name", name, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--pids-limit", "128", "--memory", "768m", "--cpus", "1", "--tmpfs", "/tmp:size=67108864,mode=1777", "-e", "PAYLOADBAY_EXECUTOR_TOKEN=" + token, "-p", "127.0.0.1::8080", "payloadbay-bootstrap/executor-compiler:local"]);
		const port = Number(docker(["port", name, "8080/tcp"]).split(":").at(-1));
		const url = "http://127.0.0.1:" + port;
		let ready = false;
		for (let i = 0; i < 100; i++) {
			try {
				if ((await fetch(url + "/health")).status === 200) {
					ready = true;
					break;
				}
			} catch {}

			await new Promise((r) => setTimeout(r, 50));
		}

		assert.equal(ready, true);

		const post = (body: unknown, authenticated = true) => fetch(url + "/compile", { method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });

		assert.equal((await post({ stage: "processing", body: "return ctx.complete();" }, false)).status, 401);
		const valid = await post({ stage: "processing", body: "return ctx.complete();" });
		assert.equal(valid.status, 200, "compiler RPC must be available in the prebuilt image");
		const compiled = await valid.json();
		assert.match(compiled.bundle, /complete/);
		assert.equal(compiled.sdkVersion, "1");
		const bad = await post({ stage: "ingress", body: "return ctx.respondOnly({status:200,body:;" });
		assert.equal(bad.status, 422);
		assert.equal((await bad.json()).error.diagnostics[0].line, 1);
	} finally {
		docker(["rm", "-f", name]);
	}
});

test("U286 typed middleware continuation runs in real workerd", async () => {
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	let compiled: Awaited<ReturnType<typeof compile>> | undefined;
	try {
		compiled = await compile({ stage: "processing_middleware", body: 'return ctx.continue({event:{metadata:{tag:"custom"}}});' });
	} catch {}

	assert.ok(compiled, "ctx.continue helper must compile");
	const result = await execute({
		stage: "processing_middleware",
		bundle: compiled.bundle,
		input: {
			event: {
				id: "event",
				body: new Uint8Array([42]),
				originalBody: new Uint8Array([42]),
				contentType: "text/plain",
				metadata: {},
			},
			executionId: "execution",
			generation: 1,
			attempt: 1,
			secrets: {},
		},
	});
	assert.deepEqual(result.decision, { kind: "continue", patch: { event: { metadata: { tag: "custom" } } } });
	await assert.rejects(compile({ stage: "processing_middleware", body: "return ctx.continue({event:{originalBody:new Uint8Array([1])}});" }), (error) => typeof error === "object" && error !== null && "diagnostics" in error);
});

test("U287 shared source cannot dynamically import an unregistered runtime module", async () => {
	const { compile, CompilationError } = await import("../../apps/executor/src/compiler.ts");
	let caught: unknown;
	try {
		await compile({ stage: "processing", body: "await Helper.invoke();return ctx.complete();", sharedModules: { Helper: { revisionId: "revision", source: 'export async function invoke(){const name="./main.js";return import(name);}' } } });
	} catch (error) {
		caught = error;
	}

	assert.ok(caught instanceof CompilationError, "shared dynamic import must be rejected");
	assert.equal(caught.diagnostics[0].code, "unregistered_import");
	assert.equal(caught.diagnostics[0].sourceId, "Helper");
});

test("U294 executor RPC preserves zero direct-fetch budget", async () => {
	const { createServer } = await import("node:http");
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { executeSource } = await import("../../packages/domain/src/executor-client.ts");
	let calls = 0;
	const http = createServer((_request, response) => {
		calls++;
		response.end("fixture");
	});
	await new Promise<void>((resolve) => http.listen(0, "0.0.0.0", resolve));
	const address = http.address();
	assert.ok(address && typeof address === "object");
	const executor = await executorFixture();
	try {
		const config = { executorUrl: executor.url, executorToken: "fixture-executor-token-32-characters" };
		const bundle = `export default async function(ctx){try{await fetch('http://host.docker.internal:${address.port}/fixture');return ctx.complete();}catch{return ctx.fail({reason:'fetch blocked'});}}`;
		const allowed = await executeSource(config, { stage: "processing", bundle, input: {} });
		assert.equal((allowed.decision as { kind: string }).kind, "complete");
		assert.equal(calls, 1);
		const blocked = await executeSource(config, {
			stage: "processing",
			bundle,
			input: {},
			maxFetches: 0,
		});
		assert.equal((blocked.decision as { kind: string }).kind, "fail", "Zero fetch budget must reach the actual runtime");
		assert.equal(calls, 1, "Dry execution must make no HTTP request");
	} finally {
		await executor.stop();
		await new Promise<void>((resolve) => http.close(() => resolve()));
	}
});

test("U297 dry executor simulates managed delivery without network", async () => {
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { executeSource } = await import("../../packages/domain/src/executor-client.ts");
	const executor = await executorFixture();
	try {
		const result = await executeSource(
			{ executorUrl: executor.url, executorToken: "fixture-executor-token-32-characters" },
			{
				stage: "processing",
				bundle: 'export default async function(ctx){const result=await ctx.destinations.send({url:"http://127.0.0.1:1/unreachable"},{operationId:"main",body:"fixture"});if(!result.ok||result.attemptId!=="dry-run:main")return ctx.fail({reason:"simulation unavailable"});return ctx.complete();}',
				input: {},
				dryRun: true,
			},
		).catch(() => ({
			decision: { kind: "execution-error" },
		}));
		assert.equal((result.decision as { kind: string }).kind, "complete", "Dry managed sends must be simulated without a live broker");
	} finally {
		await executor.stop();
	}
});

test("U309 executor wire budget preserves maximum escaped and binary bodies", async () => {
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { executeSource } = await import("../../packages/domain/src/executor-client.ts");
	const executor = await executorFixture();
	try {
		const config = { executorUrl: executor.url, executorToken: "fixture-executor-token-32-characters" };
		const bytes = new Uint8Array(1048576);
		bytes[1048575] = 255;
		const processing = await executeSource(config, {
			stage: "processing",
			bundle: 'export default async function(ctx){if(ctx.event.body.length!==1048576||ctx.event.originalBody[1048575]!==255)return ctx.fail({reason:"binary corrupted"});return ctx.complete();}',
			input: { event: { body: bytes, originalBody: bytes } },
			deadlineMs: 5000,
		});
		assert.equal((processing.decision as { kind: string }).kind, "complete");
		let result;
		try {
			result = await executeSource(config, {
				stage: "ingress",
				bundle: 'export default async function(ctx){return ctx.accept({event:{body:String.fromCharCode(0).repeat(1048576),contentType:"application/octet-stream"},response:{status:200,body:String.fromCharCode(0).repeat(1048576)}});}',
				input: { request: { body: bytes } },
				deadlineMs: 5000,
			});
		} catch {
			result = null;
		}

		assert.ok(result, "Maximum legal escaped bodies must pass the executor wire boundary");
		const decision = result.decision as { event: { body: string }; response: { body: string } };
		assert.equal(Buffer.byteLength(decision.event.body), 1048576);
		assert.equal(Buffer.byteLength(decision.response.body), 1048576);
		const { compile } = await import("../../apps/executor/src/compiler.ts");
		const { execute } = await import("../../apps/executor/src/supervisor.ts");
		const large = await compile({ stage: "ingress", body: 'return ctx.respondOnly({status:200,body:"x".repeat(1048577)});' });
		await assert.rejects(execute({ stage: "ingress", bundle: large.bundle, input: {} }), { code: "result_limit_exceeded" });
	} finally {
		await executor.stop();
	}
});

test("full lifecycle modules support real named and default imports with contract validation", async () => {
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const sharedModules = { Messages: { source: 'export const message = "hello"; export default function suffix(){return "world";}', revisionId: "immutable-fixture" } };
	const body = 'import suffix, { message } from "@shared/Messages";\nexport default async function deliverPurchase(ctx: ProcessingContext): Promise<ProcessingDecision> { ctx.log.info(message+suffix()); return ctx.complete(); }';
	const compiled = await compile({ stage: "processing", body, sharedModules });
	const result = await execute({ stage: "processing", bundle: compiled.bundle, input: {} });
	assert.equal((result.decision as { kind: string }).kind, "complete");
	await assert.rejects(compile({ stage: "processing", body: body.replace("ctx.complete()", '"wrong"'), sharedModules }));
	await assert.rejects(compile({ stage: "processing", body: body.replace("export default", "export"), sharedModules }));
});
