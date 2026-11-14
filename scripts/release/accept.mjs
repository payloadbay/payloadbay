import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";

export function candidateCoordinates(text) {
	const lines = text.trim().split(/\r?\n/);
	const result = {};
	for (const line of lines) {
		const match = /^(SOURCE_SHA|PAYLOADBAY_(APP|WORKER|EXECUTOR|MIGRATOR)_IMAGE)=(\S+)$/.exec(line);
		assert.ok(match, "Unexpected candidate coordinate");
		assert.equal(Object.hasOwn(result, match[1]), false, "Duplicate candidate coordinate");
		result[match[1]] = match[3];
	}

	assert.match(result.SOURCE_SHA ?? "", /^[a-f0-9]{40}$/);
	for (const service of ["APP", "WORKER", "EXECUTOR", "MIGRATOR"]) assert.match(result[`PAYLOADBAY_${service}_IMAGE`] ?? "", new RegExp(`^ghcr\\.io/payloadbay/payloadbay-${service.toLowerCase()}@sha256:[a-f0-9]{64}$`));

	return result;
}

async function availablePort() {
	const server = createServer();
	await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));

	return port;
}

export async function accept(candidateDirectory, { validateOnly = false } = {}) {
	const coordinates = candidateCoordinates(await readFile(join(candidateDirectory, "images.env"), "utf8"));
	if (validateOnly) return { status: "coordinates-valid-not-installation-certified", sourceSha: coordinates.SOURCE_SHA };
	const directory = await mkdtemp(join(tmpdir(), "pab-release-accept-"));
	const project = "pab-accept-" + randomUUID().slice(0, 12);
	const port = await availablePort();
	const mailPort = await availablePort();
	const receiverPort = await availablePort();
	const url = "http://127.0.0.1:" + port;
	const env = {
		...process.env,
		...coordinates,
		PUBLIC_URL: url,
		PAYLOADBAY_PORT: String(port),
		PAYLOADBAY_BIND_ADDRESS: "127.0.0.1",
		SMTP_HOST: "accept-mail",
		SMTP_PORT: "1025",
		SMTP_SECURE: "false",
		SMTP_USER: "",
		SMTP_PASSWORD: "",
		SMTP_FROM: "acceptance@example.test",
	};
	for (const name of ["BETTER_AUTH_SECRET", "PAYLOADBAY_ENCRYPTION_KEY", "PAYLOADBAY_BOOTSTRAP_SECRET", "PAYLOADBAY_EXECUTOR_TOKEN", "PAYLOADBAY_BROKER_SECRET", "POSTGRES_PASSWORD", "PAYLOADBAY_APP_DATABASE_PASSWORD", "PAYLOADBAY_WORKER_DATABASE_PASSWORD"]) env[name] = randomBytes(32).toString("hex");

	const docker = (args, input) =>
		execFileSync("docker", args, {
			env,
			input,
			encoding: "utf8",
			timeout: 180000,
			maxBuffer: 8 * 1024 * 1024,
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();

	const files = ["-f", resolve(candidateDirectory, "compose.yml"), "-f", join(directory, "accept.json")];

	const compose = (...args) => docker(["compose", "--project-name", project, ...files, ...args]);

	const sql = (query) => compose("exec", "-T", "postgres", "psql", "-U", "payloadbay_admin", "-d", "payloadbay", "-v", "ON_ERROR_STOP=1", "-Atc", query);

	const receiver = `const http=require('node:http');const receipts=[];http.createServer(async(req,res)=>{if(req.method==='GET'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(receipts));}let chunks=[];for await(const chunk of req)chunks.push(chunk);receipts.push([...Buffer.concat(chunks)]);res.writeHead(receipts.length===1?503:204).end();}).listen(3001,'0.0.0.0');`;
	const manifest = JSON.parse(await readFile(join(candidateDirectory, "source-manifest.json"), "utf8"));
	const override = {
		services: {
			"accept-mail": { image: "axllent/mailpit:v1.30.2@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6", ports: [`127.0.0.1:${mailPort}:8025`] },
			"accept-receiver": {
				image: manifest.runtime.nodeImage,
				command: ["node", "-e", receiver],
				ports: [`127.0.0.1:${receiverPort}:3001`],
				read_only: true,
				cap_drop: ["ALL"],
				security_opt: ["no-new-privileges:true"],
				user: "node",
			},
		},
	};
	await writeFile(join(directory, "accept.json"), JSON.stringify(override), { mode: 0o600 });
	const checks = [];
	let cookie = "";

	const request = async (path, body, method = "POST", extraHeaders = {}) => {
		const response = await fetch(url + path, {
			method,
			headers: {
				origin: url,
				"content-type": "application/json",
				"x-payloadbay-csrf": "1",
				cookie,
				...extraHeaders,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(30000),
		});
		assert.equal(response.ok, true, `Acceptance HTTP ${response.status} at ${path}`);

		return response;
	};

	const waitFor = async (predicate, label) => {
		for (let attempt = 0; attempt < 120; attempt++) {
			if (await predicate()) return;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		throw Error("Acceptance timeout: " + label);
	};

	try {
		compose("pull");
		for (const service of ["APP", "WORKER", "EXECUTOR", "MIGRATOR"]) {
			const image = JSON.parse(docker(["image", "inspect", coordinates[`PAYLOADBAY_${service}_IMAGE`]]))[0];
			assert.equal(image.Config.Labels["org.opencontainers.image.revision"], coordinates.SOURCE_SHA, "Images must share the candidate source commit");
			assert.ok(image.Config.User && !["root", "0", "0:0"].includes(image.Config.User), "Application images must run as non-root");
		}

		checks.push("coordinated-published-images");
		compose("up", "-d", "--wait", "--wait-timeout", "120");
		assert.deepEqual(await (await request("/api/v1/bootstrap", undefined, "GET")).json(), { configured: false });
		const email = "owner@example.test";
		await request("/api/v1/bootstrap", {
			action: "request-code",
			secret: env.PAYLOADBAY_BOOTSTRAP_SECRET,
			email,
			name: "Acceptance owner",
		});
		let otp;
		await waitFor(async () => {
			const messages = await (await fetch(`http://127.0.0.1:${mailPort}/api/v1/messages`)).json();
			if (!messages.messages?.length) return false;
			const message = await (await fetch(`http://127.0.0.1:${mailPort}/api/v1/message/${messages.messages[0].ID}`)).json();
			otp = message.Text.match(/\b\d{6}\b/)?.[0];

			return Boolean(otp);
		}, "owner email");
		const signed = await request("/api/auth/sign-in/email-otp", { email, otp });
		cookie = signed.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		assert.ok(cookie);
		await request("/api/v1/bootstrap", { action: "complete", secret: env.PAYLOADBAY_BOOTSTRAP_SECRET });
		assert.deepEqual(await (await request("/api/v1/bootstrap", undefined, "GET")).json(), { configured: true });
		checks.push("real-email-owner-bootstrap");
		const organizations = await (await request("/api/v1/organizations", undefined, "GET")).json();
		const workspace = await (await request("/api/v1/workspaces", { parentId: organizations[0].id, name: "Acceptance", slug: "acceptance" })).json();
		const projectResource = await (await request("/api/v1/projects", { parentId: workspace.id, name: "Acceptance", slug: "acceptance" })).json();
		await request(`/api/v1/projects/${projectResource.id}/destinations`, { name: "Receiver", url: "http://accept-receiver:3001/webhook" });
		const endpoint = await (await request(`/api/v1/projects/${projectResource.id}/endpoints`, { name: "Acceptance", slug: "acceptance" })).json();
		const stages = {
			ingress: 'export async function POST(ctx: IngressContext): Promise<IngressDecision> { return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"Accepted"}}); }',
			processing: 'export default async function(ctx: ProcessingContext): Promise<ProcessingDecision> { const result=await ctx.destinations.send({body:ctx.event.body,headers:{"content-type":ctx.event.contentType}});return result.ok?ctx.complete():ctx.retry({reason:"Acceptance receiver unavailable",delayMs:1000}); }',
		};
		for (const [stage, body] of Object.entries(stages)) await request(`/api/v1/endpoints/${endpoint.id}/drafts/${stage}`, { body }, "PATCH", { "if-match": '"1"' });
		await request(`/api/v1/endpoints/${endpoint.id}/publications`, { expectedVersion: 1, draftVersions: { ingress: 2, processing: 2 } });
		const key = sql("SELECT ingress_key FROM payloadbay.endpoint WHERE slug='acceptance'");
		const bytes = Buffer.from([0, 255, 42, 10]);
		const received = await fetch(url + "/ingress/" + key, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: bytes });
		assert.equal(received.status, 202);
		assert.equal(sql("SELECT count(*) FROM payloadbay.event WHERE original_body=decode('00ff2a0a','hex') AND accepted_body=original_body"), "1");
		checks.push("durable-byte-preserving-acceptance");
		await waitFor(async () => (await (await fetch(`http://127.0.0.1:${receiverPort}/receipts`)).json()).length >= 2, "receiver retry");
		const receipts = await (await fetch(`http://127.0.0.1:${receiverPort}/receipts`)).json();
		assert.ok(receipts.every((body) => JSON.stringify(body) === JSON.stringify([...bytes])));
		await waitFor(async () => sql("SELECT count(*) FROM payloadbay.execution WHERE state='succeeded'") === "1", "processing completion");
		assert.equal(sql("SELECT count(*) FROM payloadbay.delivery_attempt WHERE status_code=503"), "1");
		checks.push("receiver-outage-retry-history");
		compose("restart", "worker", "executor");
		assert.equal(sql("SELECT count(*) FROM payloadbay.event WHERE original_body=decode('00ff2a0a','hex')"), "1");
		checks.push("service-restart-retains-event");

		return {
			status: "installation-and-delivery-passed",
			sourceSha: coordinates.SOURCE_SHA,
			checks,
			remaining: ["fresh-cluster-backup-restore", "upgrade-compatibility"],
		};
	} finally {
		try {
			compose("down", "--volumes", "--remove-orphans");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const candidate = process.argv[2];
		assert.ok(candidate && !candidate.startsWith("--"), "Usage: node scripts/release/accept.mjs <candidate-directory> [--validate-only]");
		console.log(JSON.stringify(await accept(resolve(candidate), { validateOnly: process.argv.includes("--validate-only") }), null, 2));
	} catch {
		console.error("Release acceptance failed. No release certification was issued; candidate coordinates and Docker/HTTP prerequisites must be checked locally.");
		process.exitCode = 1;
	}
}
