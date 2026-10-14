import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { compile } from "./compiler.ts";
import { CompilationError } from "../../../packages/contracts/src/compilation.ts";
import { ExecutionError } from "./supervisor.ts";

let active = 0;
const waiting: (() => void)[] = [];

export async function compileIsolated(input: unknown, signal?: AbortSignal): ReturnType<typeof compile> {
	const started = performance.now();
	if (active >= 1) {
		if (waiting.length >= 4) throw new ExecutionError("compiler_busy");
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				const index = waiting.indexOf(wake);
				if (index >= 0) waiting.splice(index, 1);
				reject(new ExecutionError("compiler_timeout"));
			}, 5000);

			const wake = () => {
				clearTimeout(timer);
				resolve();
			};

			waiting.push(wake);
		});
	}

	active++;
	try {
		const path = process.env.PAYLOADBAY_COMPILER_CHILD ?? fileURLToPath(new URL("./compile-child.ts", import.meta.url));

		return await new Promise((resolve, reject) => {
			const child = spawn(process.execPath, [...(path.endsWith(".ts") ? ["--import", "tsx"] : []), "--max-old-space-size=192", path], { env: { PATH: process.env.PATH }, detached: true, stdio: ["pipe", "pipe", "pipe"] });
			let settled = false;
			let size = 0;
			let stderr = 0;
			const chunks: Buffer[] = [];

			const stop = () => {
				if (child.pid)
					try {
						process.kill(-child.pid, "SIGKILL");
					} catch {}
			};

			const timer = setTimeout(() => fail(new ExecutionError("compiler_timeout")), Math.max(1, 5000 - (performance.now() - started)));

			const cancel = () => fail(new ExecutionError("cancelled"));

			function cleanup() {
				clearTimeout(timer);
				signal?.removeEventListener("abort", cancel);
			}

			function fail(error: Error) {
				if (settled) return;
				settled = true;
				stop();
				cleanup();
				reject(error);
			}

			child.on("error", () => fail(new ExecutionError("compiler_startup_failed")));
			child.stdin.on("error", () => {});
			child.stdout.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > 6291456) {
					fail(new ExecutionError("compiler_result_limit"));

					return;
				}

				chunks.push(chunk);
			});
			child.stderr.on("data", (chunk: Buffer) => {
				stderr += chunk.length;
				if (stderr > 16384) fail(new ExecutionError("compiler_log_limit"));
			});
			child.on("exit", (code) => {
				if (settled) return;
				settled = true;
				cleanup();
				try {
					if (code !== 0) throw new ExecutionError("compiler_failed");
					const reply = JSON.parse(Buffer.concat(chunks).toString("utf8"));
					if (reply.error) {
						if (reply.error.code === "compilation_failed") throw new CompilationError(reply.error.diagnostics);
						throw new ExecutionError(reply.error.code);
					}

					resolve(reply.result);
				} catch (error) {
					reject(error);
				}
			});
			signal?.addEventListener("abort", cancel, { once: true });
			if (signal?.aborted) {
				cancel();

				return;
			}

			const source = JSON.stringify(input);
			if (Buffer.byteLength(source) > 3145728) {
				fail(new ExecutionError("source_limit"));

				return;
			}

			child.stdin.end(source);
		});
	} finally {
		active--;
		waiting.shift()?.();
	}
}
