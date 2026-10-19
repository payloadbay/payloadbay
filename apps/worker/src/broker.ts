import { createServer } from "node:http";
import type { Pool } from "pg";
import type { ServerConfig } from "../../../packages/domain/src/config.ts";
import { verifyBrokerToken } from "../../../packages/domain/src/broker-auth.ts";
import { managedSend } from "../../../packages/domain/src/delivery.ts";
import { packWire, unpackWire } from "../../../packages/contracts/src/wire.ts";
import type { DestinationTarget, SendInput } from "../../../packages/script-sdk/src/lifecycle.ts";

export function createBroker(pool: Pool, config: ServerConfig, resolveConfig: () => Promise<ServerConfig> = async () => config) {
	return createServer(async (request, response) => {
		const abort = new AbortController();
		response.on("close", () => {
			if (!response.writableFinished) abort.abort();
		});
		try {
			if (request.url === "/health" && request.method === "GET") {
				await pool.query("SELECT 1");
				response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ready: true }));

				return;
			}

			if (request.url !== "/broker" || request.method !== "POST") {
				response.writeHead(404).end();

				return;
			}

			const authorization = request.headers.authorization ?? "";
			if (!authorization.startsWith("Bearer ")) throw Error("Invalid capability");
			const authority = verifyBrokerToken(config.brokerSecret, authorization.slice(7), Date.now());
			const chunks: Buffer[] = [];
			let bytes = 0;
			for await (const chunk of request) {
				bytes += chunk.length;
				if (bytes > 1572864) {
					response.writeHead(413).end();

					return;
				}

				chunks.push(chunk);
			}

			const input = unpackWire(JSON.parse(Buffer.concat(chunks).toString("utf8"))) as { target: DestinationTarget; input: SendInput };
			const result = await managedSend(pool, authority, input.target, input.input, { timeoutMs: (await resolveConfig()).httpTimeoutMs, signal: abort.signal });
			response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(packWire(result)));
		} catch {
			if (!response.writableEnded) response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: "broker_request_rejected" } }));
		}
	});
}
