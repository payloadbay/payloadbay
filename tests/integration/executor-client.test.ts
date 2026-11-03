import test from "node:test";
import { once } from "node:events";
import type { CompilationError as CompilationFailure } from "../../packages/contracts/src/compilation.ts";
import assert from "node:assert/strict";

test("U246 compiler client authenticates and preserves validated diagnostics", async () => {
	const { compileSource } = await import("../../packages/domain/src/executor-client.ts");
	const { CompilationError } = await import("../../packages/contracts/src/compilation.ts");
	const { createServer } = await import("node:http");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const token = "fixture-executor-token-32-characters";
	let invalid = false;
	const server = createServer(async (req, res) => {
		assert.equal(req.url, "/compile");
		assert.equal(req.headers.authorization, "Bearer " + token);
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk);
		try {
			const compiled = await compile(JSON.parse(Buffer.concat(chunks).toString()));
			res.setHeader("content-type", "application/json");
			res.end(JSON.stringify(invalid ? { ...compiled, sdkVersion: "unknown" } : compiled));
		} catch (error) {
			res.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: "compilation_failed", diagnostics: (error as CompilationFailure).diagnostics } }));
		}
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const config = { executorUrl: "http://127.0.0.1:" + (server.address() as { port: number }).port, executorToken: token };
	try {
		const value = await compileSource(config, { stage: "processing", body: "return ctx.complete();" });
		assert.equal(value.stage, "processing");
		await assert.rejects(compileSource(config, { stage: "ingress", body: "returnctx??;" }), CompilationError);
		invalid = true;
		await assert.rejects(compileSource(config, { stage: "processing", body: "return ctx.complete();" }), { code: "compiler_response_invalid" });
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
});

test("U250 executor HTTP invocation preserves binary bodies", async () => {
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { executeSource, compileSource } = await import("../../packages/domain/src/executor-client.ts");
	const fixture = await executorFixture();
	try {
		const config = { executorUrl: fixture.url, executorToken: "fixture-executor-token-32-characters" };
		const script = await compileSource(config, { stage: "ingress", body: "return ctx.respondOnly({status:200,body:ctx.request.body});" });
		const body = new Uint8Array(140000);
		body.fill(255);
		body[0] = 0;
		const result = await executeSource(config, {
			stage: "ingress",
			bundle: script.bundle,
			input: { request: { body } },
			deadlineMs: 2000,
		});
		assert.deepEqual(result.decision, { kind: "respondOnly", response: { status: 200, body } });
	} finally {
		await fixture.stop();
	}
});

test("RV01 worker refuses an incompatible executor before starting job runners", async () => {
	const { authFixture } = await import("../helpers/auth-fixtures.ts");
	const { fixtureEnvironment } = await import("../helpers/fixture-environment.ts");
	const { createServer } = await import("node:http");
	const { spawn } = await import("node:child_process");
	await authFixture(async (fixture) => {
		let probes = 0;
		const executor = createServer((_request, response) => {
			probes++;
			response.writeHead(200, { "content-type": "application/json" }).end(
				JSON.stringify({
					ready: true,
					runtime: "workerd",
					configuredMode: "runc",
					hostAttestation: false,
					protocolVersion: 2,
					sdkVersion: "1",
					compatibilityDate: "2026-07-01",
				}),
			);
		});
		executor.listen(0, "127.0.0.1");
		await once(executor, "listening");
		const address = executor.address();
		assert.ok(address && typeof address !== "string");
		const child = spawn(process.execPath, ["--import", "tsx", "apps/worker/src/main.ts"], {
			env: { ...fixtureEnvironment(fixture, "http://localhost:3000"), EXECUTOR_URL: `http://127.0.0.1:${address.port}`, PORT: "0" },
			stdio: ["ignore", "ignore", "pipe"],
		});
		let output = "";
		child.stderr.on("data", (chunk) => {
			output += String(chunk);
		});
		const exited = once(child, "exit");
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const code = await Promise.race([
				exited.then(([code]) => code),
				new Promise<null>((resolve) => {
					timer = setTimeout(() => resolve(null), 5000);
				}),
			]);
			assert.equal(probes, 1, "The actual worker must reach the incompatible readiness response");
			assert.equal(code, 1, "An HTTP200 alone must not authorize an incompatible executor");
			assert.match(output, /executor.*(compatib|readiness)/i);
			assert.equal(output.includes(fixture.databaseUrl), false);
		} finally {
			clearTimeout(timer);
			if (child.exitCode === null) child.kill("SIGTERM");
			const killer = setTimeout(() => child.kill("SIGKILL"), 12000);
			await exited;
			clearTimeout(killer);
			executor.closeAllConnections();
			await new Promise<void>((resolve) => executor.close(() => resolve()));
		}
	});
});
