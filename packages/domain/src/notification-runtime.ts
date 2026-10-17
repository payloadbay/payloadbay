import type { Pool } from "pg";
import type { ServerConfig } from "./config.ts";
import type { ChannelSnapshot } from "./email-settings.ts";
import type { NotificationContext } from "../../script-sdk/src/lifecycle.ts";
import { emailContent } from "../../contracts/src/notification-channels.ts";
import { compiledStageSchema } from "../../contracts/src/executor.ts";
import { notificationDecision } from "../../contracts/src/lifecycle.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { decryptPrivate } from "./private-crypto.ts";
import { executeSource } from "./executor-client.ts";
import type { ExecuteOptions, ExecutionResult } from "../../../apps/executor/src/supervisor.ts";

export type NotificationInput = Pick<NotificationContext, "kind" | "message" | "recipient"> & { deliveryId: string; attempt: number };

/** The shipped email adapter is trusted platform code; copies use the same contract in workerd. */
export async function runNotificationChannel(pool: Pool, snapshot: ChannelSnapshot, input: NotificationInput, config: ServerConfig, options: { dryRun?: boolean; run?: (options: ExecuteOptions) => Promise<ExecutionResult> } = {}) {
	if (!snapshot.channelId) return notificationDecision.parse({ kind: "email", message: emailContent.parse(input.message) });
	const row = (await pool.query("SELECT r.compiled,r.secret_bindings,c.installation_id FROM payloadbay.notification_channel_revision r JOIN payloadbay.notification_channel c ON c.id=r.channel_id WHERE r.id=$1 AND c.id=$2 AND c.enabled", [snapshot.revisionId, snapshot.channelId])).rows[0];
	if (!row) throw new AppError("channel_unavailable", 409, "The pinned notification channel is unavailable");
	const secrets: Record<string, string> = Object.create(null);
	let bytes = 0;
	for (const [name, id] of Object.entries(row.secret_bindings as Record<string, string>)) {
		const secret = (await pool.query("SELECT encrypted_value,revoked_at FROM payloadbay.secret_version WHERE id=$1 AND scope_type='instance' AND scope_id=$2", [id, row.installation_id])).rows[0];
		if (!secret || secret.revoked_at) throw new AppError("secret_unavailable", 409, "A pinned notification secret is unavailable");
		secrets[name] = options.dryRun ? "[test secret: " + name + "]" : decryptPrivate<{ value: string }>(secret.encrypted_value, config.encryptionKey).value;
		bytes += Buffer.byteLength(secrets[name]);
		if (bytes > 65536) throw new AppError("secret_limit", 413, "Notification secrets exceed 64 KiB");
	}

	const compiled = compiledStageSchema.parse(row.compiled);
	const executeOptions: ExecuteOptions = {
		stage: "notification",
		bundle: compiled.bundle,
		input: { ...input, secrets },
		deadlineMs: 5000,
		maxFetches: options.dryRun ? 0 : 8,
	};
	const result = options.run ? await options.run(executeOptions) : await executeSource(config, { ...executeOptions, dryRun: options.dryRun });

	const decision = notificationDecision.parse(result.decision);
	if (decision.kind === "retry" || decision.kind === "fail") {
		let reason = decision.reason;
		const privateValues = [...Object.values(secrets), ...(input.kind.startsWith("auth.") ? [input.message.code, input.message.action?.url] : [])];
		for (const value of privateValues) if (value) reason = reason.split(value).join("[redacted]");

		return { ...decision, reason: reason.slice(0, 256) };
	}

	return decision;
}
