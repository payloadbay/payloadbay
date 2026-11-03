import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHmac } from "node:crypto";
import { build } from "esbuild";
import { createRequire } from "node:module";

const workerdBinary = createRequire(import.meta.url)("workerd").default;

test("workerd runs bundled TypeScript HMAC and broker binding with denied global outbound", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pab-workerd-"));
	const broker = createServer((req, res) => {
		res.setHeader("content-type", "application/json");
		res.end('{"status":200}');
	});
	broker.listen(0, "127.0.0.1");
	await once(broker, "listening");
	const brokerPort = (broker.address() as any).port;
	const socket = createSocketServer();
	socket.listen(0, "127.0.0.1");
	await once(socket, "listening");
	const port = (socket.address() as any).port;
	await new Promise<void>((r) => socket.close(() => r()));
	let child: ReturnType<typeof spawn> | undefined;
	let output = "";
	try {
		await writeFile(
			join(dir, "worker.ts"),
			`export default {async fetch(request:Request,env:any){
   const path=new URL(request.url).pathname;
   if(path==='/broker')return env.BROKER.fetch('http://broker/send');
   if(path==='/outbound')return fetch('http://127.0.0.1:${brokerPort}/');
   const body=await request.arrayBuffer();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('fixture-secret'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
   const signature=Uint8Array.from((request.headers.get('x-signature')??'').match(/../g)??[],v=>parseInt(v,16));
   return new Response(await crypto.subtle.verify('HMAC',key,signature,body)?'accepted':'invalid',{status:await crypto.subtle.verify('HMAC',key,signature,body)?202:401,headers:{'content-type':'text/plain'}});
  }};`,
		);
		await build({
			entryPoints: [join(dir, "worker.ts")],
			outfile: join(dir, "worker.js"),
			bundle: true,
			format: "esm",
			platform: "browser",
		});
		await writeFile(join(dir, "deny.js"), "export default {fetch(){return new Response('outbound denied',{status:403})}};");
		await writeFile(
			join(dir, "config.capnp"),
			`using Workerd=import "/workerd/workerd.capnp";const config:Workerd.Config=(services=[
   (name="main",worker=(modules=[(name="worker.js",esModule=embed "worker.js")],compatibilityDate="2026-07-01",globalOutbound="deny",bindings=[(name="BROKER",service="broker")])),
   (name="deny",worker=(modules=[(name="deny.js",esModule=embed "deny.js")],compatibilityDate="2026-07-01",globalOutbound="deny")),
   (name="broker",external=(address="127.0.0.1:${brokerPort}",http=()))],sockets=[(name="http",address="127.0.0.1:${port}",http=(),service="main")]);`,
		);
		child = spawn(workerdBinary, ["serve", join(dir, "config.capnp")], { env: { PATH: process.env.PATH }, stdio: ["ignore", "pipe", "pipe"] });
		child.stdout?.on("data", (d) => (output += d));
		child.stderr?.on("data", (d) => (output += d));
		const url = `http://127.0.0.1:${port}`;

		const request = (path: string, init: RequestInit = {}) => fetch(path, { ...init, signal: AbortSignal.timeout(3000) });

		for (let i = 0; i < 100; i++) {
			if (child.exitCode !== null) throw Error(output);
			try {
				await request(url + "/outbound");
				break;
			} catch {
				if (i === 99) throw Error("workerd startup timeout: " + output);
				await new Promise((r) => setTimeout(r, 50));
			}
		}

		const body = Buffer.from([0, 255, 42]);
		const signature = createHmac("sha256", "fixture-secret").update(body).digest("hex");
		const accepted = await request(url, { method: "POST", body, headers: { "x-signature": signature } });
		assert.equal(accepted.status, 202);
		assert.equal(await accepted.text(), "accepted");
		assert.equal(accepted.headers.get("content-type"), "text/plain");
		assert.equal((await request(url, { method: "POST", body, headers: { "x-signature": "00".repeat(32) } })).status, 401);
		assert.deepEqual(await (await request(url + "/broker")).json(), { status: 200 });
		assert.equal((await request(url + "/outbound")).status, 403);
	} finally {
		if (child && child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
			await Promise.race([once(child, "exit"), new Promise((r) => setTimeout(r, 2000))]);
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
				await once(child, "exit");
			}
		}

		await new Promise<void>((r) => broker.close(() => r()));
		await rm(dir, { recursive: true, force: true });
	}
});
