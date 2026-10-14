import { executePipeline } from "../../../../packages/domain/src/pipeline.ts";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { executionReference as reference } from "../../../../packages/contracts/src/executor.ts";
import type { ServerConfig } from "../../../../packages/domain/src/config.ts";
import { claimExecution, finishExecution, FenceError } from "../../../../packages/domain/src/execution-lease.ts";
import { resolvePinnedSecrets } from "../../../../packages/domain/src/secrets.ts";
import { executeSource } from "../../../../packages/domain/src/executor-client.ts";
import { managedSend } from "../../../../packages/domain/src/delivery.ts";
import { mintBrokerToken } from "../../../../packages/domain/src/broker-auth.ts";
import { processingDecision } from "../../../../packages/contracts/src/lifecycle.ts";
import { startHeartbeat } from "../recovery.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../executor/src/supervisor.ts";

export function processEventTask(pool: Pool, config: ServerConfig, run?: (options: ExecuteOptions) => Promise<ExecutionResult>) {
	return async (payload: unknown) => {
		const input = reference.parse(payload);
		const found = (await pool.query("SELECT endpoint_id FROM payloadbay.execution WHERE id=$1", [input.executionId])).rows[0];
		if (!found || found.endpoint_id !== input.endpointId) return;
		const owner = "event-" + randomUUID();
		const execution = await claimExecution(pool, input.executionId, input.generation, owner);
		if (!execution) return;
		const authority = {
			executionId: execution.id,
			endpointId: execution.endpoint_id,
			generation: execution.dispatch_generation,
			owner,
		};
		const abort = new AbortController();
		const heartbeat = startHeartbeat(pool, authority, () => abort.abort());
		try {
			const row = (await pool.query(`SELECT e.id,e.original_body,e.accepted_body,e.content_type,e.metadata,p.shared_versions,p.effective_bindings,r.bundle,ep.project_id FROM payloadbay.event e JOIN payloadbay.publication p ON p.id=$2 JOIN payloadbay.stage_revision r ON r.id=p.processing_revision_id JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id WHERE e.id=$1`, [execution.event_id, execution.publication_id])).rows[0];
			const secrets = await resolvePinnedSecrets(pool, row.project_id, row.shared_versions.processing?.secrets ?? {}, config.encryptionKey);
			const options: ExecuteOptions = {
				stage: "processing",
				bundle: row.bundle,
				deadlineMs: config.processingDeadlineMs,
				signal: abort.signal,
				input: {
					event: {
						id: row.id,
						body: new Uint8Array(row.accepted_body),
						originalBody: new Uint8Array(row.original_body),
						contentType: row.content_type,
						metadata: row.metadata,
					},
					executionId: execution.id,
					generation: authority.generation,
					attempt: execution.attempt_number,
					secrets,
				},
				broker: (target, value) => managedSend(pool, authority, target as Parameters<typeof managedSend>[2], value as Parameters<typeof managedSend>[3], { timeoutMs: config.httpTimeoutMs, signal: abort.signal }),
			};
			const result = await executePipeline({
				...options,
				bindings: row.effective_bindings ?? [],
				resolveSecrets: (refs) => resolvePinnedSecrets(pool, row.project_id, refs, config.encryptionKey),
				run: run ?? ((next) => executeSource(config, { ...next, brokerToken: mintBrokerToken(config.brokerSecret, authority, Date.now() + (next.deadlineMs ?? config.processingDeadlineMs) + 5000) })),
			});
			const decision = processingDecision.parse(result.decision);
			await finishExecution(pool, authority, decision, { maxAttempts: execution.max_attempts });
		} catch (error) {
			if (error instanceof FenceError || abort.signal.aborted) return;
			const revoked = typeof error === "object" && error !== null && "code" in error && error.code === "secret_revoked";
			try {
				await finishExecution(pool, authority, { kind: revoked ? "fail" : "retry", reason: revoked ? "pinned_secret_revoked" : "configured_script_failed" }, { maxAttempts: execution.max_attempts });
			} catch (failure) {
				if (!(failure instanceof FenceError)) throw failure;
			}
		} finally {
			abort.abort();
			await heartbeat.stop();
		}
	};
}
