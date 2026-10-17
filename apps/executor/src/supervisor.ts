import { packWire, unpackWire, wireRuntimeSource } from "../../../packages/contracts/src/wire.ts";
import { workerdConfig } from "./workerd-config.ts";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

export class ExecutionError extends Error {
	constructor(public readonly code: string) {
		super(code);
	}
}

export type ExecuteOptions = {
	bundle: string;
	stage: string;
	input: Record<string, unknown>;
	deadlineMs?: number;
	memoryBytes?: number;
	logBytes?: number;
	maxFetches?: number;
	signal?: AbortSignal;
	broker?: (target: unknown, input: unknown) => Promise<unknown>;
};

export type ExecutionResult = {
	decision: unknown;
	logs: { level: string; message: string; data?: unknown }[];
	peakRssBytes: number;
	durationMs: number;
};

async function port() {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const p = (server.address() as { port: number }).port;
	await new Promise<void>((r) => server.close(() => r()));

	return p;
}

export async function execute(options: ExecuteOptions): Promise<ExecutionResult> {
	const dir = await mkdtemp(join(tmpdir(), "payloadbay-run-"));
	let child: ChildProcess | undefined;
	let output = "";
	let peakRssBytes = 0;
	let rssTimer: ReturnType<typeof setInterval> | undefined;
	const started = performance.now();
	const token = randomBytes(32).toString("hex");
	let fetches = 0;
	const abort = new AbortController();
	const runAbort = new AbortController();
	let stoppedCode = "deadline_exceeded";
	const deadlineTimer = setTimeout(() => runAbort.abort(), options.deadlineMs ?? (options.stage.startsWith("ingress") ? 2000 : 30000));

	const cancel = () => {
		stoppedCode = "cancelled";
		runAbort.abort();
	};

	options.signal?.addEventListener("abort", cancel, { once: true });
	if (options.signal?.aborted) cancel();
	const proxy = createHttpServer(async (req, res) => {
		try {
			const supplied = Buffer.from(req.headers.authorization ?? "");
			const expected = Buffer.from(token);
			if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
				res.writeHead(401).end();

				return;
			}

			const chunks: Buffer[] = [];
			let total = 0;
			for await (const chunk of req) {
				total += chunk.length;
				if (total > 1572864) throw Error("request_limit");
				chunks.push(chunk);
			}

			const payload = unpackWire(JSON.parse(Buffer.concat(chunks).toString("utf8"))) as {
				target: unknown;
				input: unknown;
				url: string;
				method: string;
				headers: Record<string, string>;
				body: string;
			};
			if (req.url === "/managed") {
				if (!options.broker) throw Error("managed_send_unavailable");
				res.setHeader("content-type", "application/json");
				res.end(JSON.stringify(packWire(await options.broker(payload.target, payload.input))));

				return;
			}

			if (++fetches > (options.maxFetches ?? 8)) throw Error("fetch_quota");
			const url = new URL(payload.url);
			if (!["http:", "https:"].includes(url.protocol)) throw Error("invalid_target");
			const response = await fetch(url, {
				method: payload.method,
				headers: payload.headers,
				body: ["GET", "HEAD"].includes(payload.method) ? undefined : Buffer.from(payload.body, "base64"),
				redirect: "manual",
				signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
			});
			let size = 0;
			const parts: Buffer[] = [];
			if (response.body)
				for await (const piece of response.body) {
					size += piece.byteLength;
					if (size > 1048576) throw Error("response_limit");
					parts.push(Buffer.from(piece));
				}

			res.setHeader("content-type", "application/json");
			res.end(JSON.stringify(packWire({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.concat(parts).toString("base64") })));
		} catch {
			res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "fetch_failed" }));
		}
	});
	proxy.listen(0, "127.0.0.1");
	await once(proxy, "listening");
	const proxyPort = (proxy.address() as { port: number }).port;
	try {
		const socketPort = await port();
		await writeFile(join(dir, "bundle.js"), options.bundle, { mode: 0o600 });
		await writeFile(join(dir, "wire.js"), wireRuntimeSource, { mode: 0o600 });
		await writeFile(
			join(dir, "main.js"),
			`import handler from './bundle.js';
 import {packWire,unpackWire} from './wire.js';
 const encode=bytes=>{const value=new Uint8Array(bytes);let text='';for(let i=0;i<value.length;i+=32768)text+=String.fromCharCode(...value.subarray(i,i+32768));return btoa(text);};
 const decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
 export default {async fetch(request,env){
  if(new URL(request.url).pathname==='/health')return new Response('ready');
  const bridge=async(path,value)=>{const response=await env.REQUEST.fetch('http://bridge'+path,{method:'POST',headers:{authorization:env.TOKEN,'content-type':'application/json'},body:JSON.stringify(packWire(value))});if(!response.ok)throw Error('fetch_failed');return unpackWire(await response.json());};
  globalThis.fetch=async(input,init)=>{const outbound=new Request(input,init);const result=await bridge('/fetch',{url:outbound.url,method:outbound.method,headers:Object.fromEntries(outbound.headers),body:encode(await outbound.arrayBuffer())});return new Response(result.status===204||result.status===304?null:decode(result.body),{status:result.status,headers:result.headers});};
  const logs=[];let logSize=0,logExceeded=false;
  try{const input=unpackWire(await request.json());
   const secrets=[...Object.values(input.secrets??{}),...(input.kind?.startsWith('auth.')?[input.message?.code,input.message?.action?.url]:[])].filter(value=>typeof value==='string'&&value.length>0);
   const redact=(value,depth=0)=>{if(depth>30)throw Error('log nesting limit');if(typeof value==='string'){for(const secret of secrets)value=value.split(secret).join('[redacted]');return value;}if(Array.isArray(value))return value.map(item=>redact(item,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[redact(key),redact(item,depth+1)]));return value;};
   const emit=level=>(message,data)=>{const text=JSON.stringify({level,message:redact(String(message)),data:redact(data)});const size=new TextEncoder().encode(text).length;if(logSize+size>${options.logBytes ?? 16384}){logExceeded=true;throw Error('log quota exceeded');}logSize+=size;logs.push(JSON.parse(text));};
   input.log={info:emit('info'),warn:emit('warn'),error:emit('error')};
   input.accept=value=>({kind:'accept',...value});input.reject=response=>({kind:'reject',response});input.respondOnly=response=>({kind:'respondOnly',response});
   input.continue=patch=>({kind:'continue',...(patch===undefined?{}:{patch})});
   input.email=message=>({kind:'email',message});
   input.complete=()=>({kind:'complete'});input.retry=value=>({kind:'retry',...value});input.fail=value=>({kind:'fail',...value});
   input.destinations={send:(target,value)=>bridge('/managed',{target,input:value})};
   console.log=input.log.info;console.info=input.log.info;console.warn=input.log.warn;console.error=input.log.error;
   const decision=await handler(input);if(logExceeded)return Response.json({error:'log_limit_exceeded'});
   return Response.json(packWire({decision,logs}));
  }catch{return Response.json({error:logExceeded?'log_limit_exceeded':'execution_error'});}
 }};`,
			{ mode: 0o600 },
		);
		await writeFile(join(dir, "deny.js"), "export default {fetch(){return new Response('direct networking unavailable',{status:403})}};", { mode: 0o600 });
		await writeFile(join(dir, "config.capnp"), workerdConfig(socketPort, proxyPort, token), { mode: 0o600 });
		const binary = process.env.WORKERD_BINARY ?? createRequire(import.meta.url)("workerd").default;
		child = spawn(binary, ["serve", join(dir, "config.capnp")], {
			cwd: dir,
			env: { PATH: process.env.PATH, NODE_ENV: "production", NODE_V8_COVERAGE: "" },
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		rssTimer = setInterval(async () => {
			if (!child?.pid) return;
			try {
				const status = await readFile(`/proc/${child.pid}/status`, "utf8");
				const kb = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
				peakRssBytes = Math.max(peakRssBytes, kb * 1024);
				if (kb * 1024 > (options.memoryBytes ?? 268435456)) {
					stoppedCode = "memory_limit_exceeded";
					runAbort.abort();
				}
			} catch {}
		}, 10);

		const capture = (data: Buffer) => {
			if (Buffer.byteLength(output) + data.length > (options.logBytes ?? 16384)) {
				stoppedCode = "log_limit_exceeded";
				runAbort.abort();

				return;
			}

			output += data.toString();
		};

		child.stdout?.on("data", capture);
		child.stderr?.on("data", capture);
		let ready = false;
		for (let i = 0; i < 100; i++) {
			if (child.exitCode !== null || child.signalCode !== null) throw new ExecutionError("runtime_startup_failed");
			try {
				await fetch(`http://127.0.0.1:${socketPort}/health`, { signal: AbortSignal.any([runAbort.signal, AbortSignal.timeout(100)]) });
				ready = true;
				break;
			} catch {
				await new Promise((r) => setTimeout(r, 10));
			}
		}

		if (!ready) throw new ExecutionError("runtime_startup_failed");
		const response = await fetch(`http://127.0.0.1:${socketPort}/execute`, { method: "POST", body: JSON.stringify(packWire(options.input)), signal: runAbort.signal });
		const chunks: Buffer[] = [];
		let resultBytes = 0;
		if (response.body)
			for await (const chunk of response.body) {
				resultBytes += chunk.byteLength;
				if (resultBytes > 16777216) throw new ExecutionError("result_limit_exceeded");
				chunks.push(Buffer.from(chunk));
			}

		const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		const result = (Array.isArray(raw) ? unpackWire(raw) : raw) as { error?: string; decision: unknown; logs: ExecutionResult["logs"] };
		if (result.error) throw new ExecutionError(result.error);
		const outcome = result.decision as { response?: { body?: unknown }; event?: { body?: unknown }; patch?: { event?: { body?: unknown } } } | null;
		for (const body of [outcome?.response?.body, outcome?.event?.body, outcome?.patch?.event?.body]) {
			if ((typeof body === "string" ? Buffer.byteLength(body) : body instanceof Uint8Array ? body.byteLength : 0) > 1048576) throw new ExecutionError("result_limit_exceeded");
		}

		return {
			decision: result.decision,
			logs: result.logs,
			peakRssBytes,
			durationMs: performance.now() - started,
		};
	} catch (error) {
		if (runAbort.signal.aborted) throw new ExecutionError(stoppedCode);
		throw error;
	} finally {
		clearTimeout(deadlineTimer);
		if (rssTimer) clearInterval(rssTimer);
		options.signal?.removeEventListener("abort", cancel);
		if (child && child.exitCode === null && child.signalCode === null) {
			const exited = once(child, "exit");
			try {
				process.kill(-child.pid!, "SIGKILL");
			} catch {}

			await Promise.race([exited, new Promise((r) => setTimeout(r, 1000))]);
		}

		abort.abort();
		proxy.closeAllConnections();
		await new Promise<void>((r) => proxy.close(() => r()));
		await rm(dir, { recursive: true, force: true });
	}
}

export function createExecutor(limits: { ingressConcurrency: number; processingConcurrency: number; notificationConcurrency?: number }) {
	const active = { ingress: 0, processing: 0, notification: 0 };
	const waiting: Record<keyof typeof active, { resolve: () => void; reject: (error: Error) => void }[]> = { ingress: [], processing: [], notification: [] };

	return {
		async run(options: ExecuteOptions): Promise<ExecutionResult> {
			const lane = options.stage === "notification" ? "notification" : options.stage.startsWith("ingress") ? "ingress" : "processing";
			const maximum = lane === "notification" ? (limits.notificationConcurrency ?? 1) : lane === "ingress" ? limits.ingressConcurrency : limits.processingConcurrency;
			const started = performance.now();
			const deadline = options.deadlineMs ?? (lane === "ingress" ? 2000 : 30000);
			if (active[lane] >= maximum) {
				if (waiting[lane].length >= 16) throw new ExecutionError("executor_busy");
				await new Promise<void>((resolve, reject) => {
					const remove = () => {
						const index = waiting[lane].indexOf(entry);
						if (index >= 0) waiting[lane].splice(index, 1);
						clearTimeout(timer);
						options.signal?.removeEventListener("abort", cancel);
					};

					const cancel = () => {
						remove();
						reject(new ExecutionError("cancelled"));
					};

					const entry = {
						resolve: () => {
							remove();
							resolve();
						},
						reject,
					};
					waiting[lane].push(entry);
					const timer = setTimeout(() => {
						remove();
						reject(new ExecutionError("deadline_exceeded"));
					}, deadline);
					options.signal?.addEventListener("abort", cancel, { once: true });
					if (options.signal?.aborted) cancel();
				});
			} else active[lane]++;
			try {
				return await execute({ ...options, deadlineMs: Math.max(1, deadline - (performance.now() - started)) });
			} finally {
				const next = waiting[lane].shift();
				if (next) next.resolve();
				else active[lane]--;
			}
		},
	};
}
