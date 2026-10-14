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
