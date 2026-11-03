import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { executorCompatibility } from "../../packages/contracts/src/compatibility.ts";
import { packWire, unpackWire } from "../../packages/contracts/src/wire.ts";

// Trusted source-entrypoint contracts complement the separate restricted-image
// tests. These host processes do not certify a container security boundary.
test("RX03 compiler stdin protocol flushes valid results and bounded diagnostic errors", () => {
	for (const [input, expected] of [
		[JSON.stringify({ stage: "processing", body: "return ctx.complete();" }), "result"],
		[JSON.stringify({ stage: "processing", body: "return ; invalid ???" }), "compilation_failed"],
		["not JSON", "invalid_source"],
		["x".repeat(3145729), "invalid_source"],
	]) {
		const child = spawnSync(process.execPath, ["--import", "tsx", "apps/executor/src/compile-child.ts"], {
			input,
			encoding: "utf8",
			timeout: 20000,
			maxBuffer: 8 * 1024 * 1024,
			env: { PATH: process.env.PATH },
		});
		assert.equal(child.error, undefined);
		assert.equal(child.status, 0, child.stderr);
		const reply = JSON.parse(child.stdout);
		if (expected === "result") {
			assert.equal(reply.result.stage, "processing");
			assert.equal(reply.result.sdkVersion, executorCompatibility.sdkVersion);
		} else {
			assert.equal(reply.error.code, expected);
			assert.ok(reply.error.diagnostics.length <= 20);
		}
	}
});

test("RX04 executor source HTTP entrypoint enforces auth, contracts and byte-preserving execution", async () => {
	const listener = createServer();
	listener.listen(0, "127.0.0.1");
	await once(listener, "listening");
	const port = (listener.address() as { port: number }).port;
	await new Promise<void>((resolve) => listener.close(() => resolve()));
	const token = "synthetic-source-entrypoint-token-32-characters";
	let brokerCalls = 0;
	const broker = createHttpServer(async (request, response) => {
		assert.equal(request.headers.authorization, "Bearer synthetic-broker-capability");
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk);
		const body = unpackWire(JSON.parse(Buffer.concat(chunks).toString("utf8"))) as { target: string; input: { operationId: string } };
		brokerCalls++;
		if (body.target === "rejected") response.writeHead(503).end();
		else
			response.writeHead(200, { "content-type": "application/json" }).end(
				JSON.stringify(
					packWire({
						ok: true,
						status: 202,
						response: "queued",
						attemptId: body.input.operationId,
					}),
				),
			);
	});
	broker.listen(0, "127.0.0.1");
	await once(broker, "listening");
	const brokerPort = (broker.address() as { port: number }).port;
	const child = spawn(process.execPath, ["--import", "tsx", "apps/executor/src/server.ts"], {
		env: {
			PATH: process.env.PATH,
			PORT: String(port),
			PAYLOADBAY_EXECUTOR_TOKEN: token,
			PAYLOADBAY_BROKER_URL: "http://127.0.0.1:" + brokerPort,
		},
		stdio: ["ignore", "ignore", "pipe"],
	});
	let errors = "";
	child.stderr.on("data", (chunk) => {
		errors += chunk;
	});
	const exited = once(child, "exit");
	const url = "http://127.0.0.1:" + port;
	const headers = { authorization: "Bearer " + token, "content-type": "application/json" };

	const post = (path: string, input: unknown) =>
		fetch(url + path, {
			method: "POST",
			headers,
			body: JSON.stringify(input),
			signal: AbortSignal.timeout(15000),
		});

	try {
		let health: Response | undefined;
		for (let i = 0; i < 200; i++) {
			assert.equal(child.exitCode, null, errors);
			try {
				health = await fetch(url + "/health", { signal: AbortSignal.timeout(1000) });
				if (health.ok) break;
			} catch {}

			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		assert.equal(health?.status, 200, errors);
		assert.deepEqual(await health!.json(), {
			...executorCompatibility,
			ready: true,
			runtime: "workerd",
			configuredMode: "runc",
			hostAttestation: false,
		});
		assert.equal((await fetch(url + "/execute", { method: "POST" })).status, 401);
		assert.equal((await post("/unknown", {})).status, 404);
		assert.equal((await fetch(url + "/execute", { headers })).status, 404);
		assert.equal((await post("/execute", { stage: "invalid", input: {}, bundle: "" })).status, 400);
		assert.equal((await post("/execute", { maxFetches: 9 })).status, 400);
		const malformed = await fetch(url + "/execute", { method: "POST", headers, body: "not JSON" });
		assert.equal(malformed.status, 400);
		assert.equal((await malformed.json()).error.code, "invalid_execution_request");
		const badCompile = await post("/compile", { stage: "processing", body: "return invalid ???;" });
		assert.equal(badCompile.status, 422);
		assert.equal((await badCompile.json()).error.code, "compilation_failed");
		const compiled = await post("/compile", { stage: "processing", body: "return ctx.complete();" });
		assert.equal(compiled.status, 200);
		const publication = await compiled.json();
		const execution = await post("/execute", {
			stage: "processing",
			bundle: publication.bundle,
			input: {},
			deadlineMs: 5000,
		});
		assert.equal(execution.status, 200);
		assert.deepEqual((await execution.json()).decision, { kind: "complete" });
		const wire = await post("/execute", {
			wire: 1,
			stage: "processing",
			bundle: "export default async function(ctx){return ctx.body;}",
			input: packWire({ body: new Uint8Array([0, 255, 17]) }),
			deadlineMs: 5000,
		});
		assert.equal(wire.status, 200);
		assert.deepEqual((unpackWire(await wire.json()) as { decision: Uint8Array }).decision, new Uint8Array([0, 255, 17]));
		const dry = await post("/execute", {
			stage: "processing",
			bundle: 'export default async function(ctx){return await ctx.destinations.send("fixture",{operationId:"one"});}',
			input: {},
			dryRun: true,
			deadlineMs: 5000,
		});
		assert.equal(dry.status, 200);
		assert.equal((await dry.json()).decision.attemptId, "dry-run:one");
		const managed = await post("/execute", {
			stage: "processing",
			bundle: 'export default async function(ctx){return await ctx.destinations.send("fixture",{operationId:"managed-one"});}',
			input: {},
			brokerToken: "synthetic-broker-capability",
			deadlineMs: 5000,
		});
		assert.equal(managed.status, 200);
		assert.equal((await managed.json()).decision.attemptId, "managed-one");
		const rejected = await post("/execute", {
			stage: "processing",
			bundle: 'export default async function(ctx){return await ctx.destinations.send("rejected",{operationId:"managed-two"});}',
			input: {},
			brokerToken: "synthetic-broker-capability",
			deadlineMs: 5000,
		});
		assert.equal(rejected.status, 422);
		assert.equal(brokerCalls, 2);
		const failed = await post("/execute", {
			stage: "processing",
			bundle: 'export default async function(){throw Error("synthetic failure");}',
			input: {},
			deadlineMs: 5000,
		});
		assert.equal(failed.status, 422);
		assert.equal((await failed.json()).error.code, "execution_error");
	} finally {
		child.kill("SIGTERM");
		const timer = setTimeout(() => child.kill("SIGKILL"), 6000);
		await exited;
		clearTimeout(timer);
		await new Promise<void>((resolve) => broker.close(() => resolve()));
	}

	assert.equal(child.exitCode, 0, errors);
});

test("RX05 compiler RPC rejects malformed, excessive and cancelled child output with bounded admission", async () => {
	const { compileIsolated } = await import("../../apps/executor/src/compile-rpc.ts");
	const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const directory = await mkdtemp(join(tmpdir(), "pab-compiler-protocol-"));
	const original = process.env.PAYLOADBAY_COMPILER_CHILD;
	try {
		const child = join(directory, "protocol.mjs");
		process.env.PAYLOADBAY_COMPILER_CHILD = child;
		for (const [source, code] of [
			["process.exit(2)", "compiler_failed"],
			['process.stdout.write(JSON.stringify({error:{code:"invalid_source"}}))', "invalid_source"],
			['process.stderr.write("x".repeat(17000));setInterval(()=>{},1000)', "compiler_log_limit"],
			['process.stdout.write("x".repeat(6291457));setInterval(()=>{},1000)', "compiler_result_limit"],
		]) {
			await writeFile(child, source);
			await assert.rejects(compileIsolated({ stage: "processing", body: "return ctx.complete();" }), { code });
		}

		await writeFile(child, 'process.stdout.write("not JSON")');
		await assert.rejects(compileIsolated({ stage: "processing", body: "return ctx.complete();" }), SyntaxError);
		await writeFile(child, "setInterval(()=>{},1000)");
		await assert.rejects(compileIsolated({ stage: "processing", body: "x".repeat(3145729) }), { code: "source_limit" });
		const controllers = Array.from({ length: 6 }, () => new AbortController());
		const pending = controllers.map((controller) =>
			compileIsolated({ stage: "processing", body: "return ctx.complete();" }, controller.signal).then(
				() => "unexpected_success",
				(error: { code: string }) => error.code,
			),
		);
		assert.equal(await pending[5], "compiler_busy");
		for (const controller of controllers) controller.abort();
		assert.deepEqual(await Promise.all(pending.slice(0, 5)), Array(5).fill("cancelled"));
		await assert.rejects(compileIsolated({ stage: "processing", body: "return ctx.complete();" }), { code: "compiler_timeout" });
	} finally {
		if (original === undefined) delete process.env.PAYLOADBAY_COMPILER_CHILD;
		else process.env.PAYLOADBAY_COMPILER_CHILD = original;
		await rm(directory, { recursive: true, force: true });
	}
});
