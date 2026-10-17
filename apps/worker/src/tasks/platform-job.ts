import type { Pool } from "pg";
import { cleanupTask } from "./cleanup.ts";
import { platformJobPriority } from "@payloadbay/domain/platform-jobs";
import nodemailer from "nodemailer";
import { transaction } from "../../../../packages/domain/src/db.ts";
import { decryptPrivate } from "../../../../packages/domain/src/private-crypto.ts";
import { renderEmailMessage } from "@payloadbay/domain/email-renderer";
import { defaultEmailBranding, type ChannelSnapshot } from "../../../../packages/domain/src/email-settings.ts";
import { runNotificationChannel, type NotificationInput } from "../../../../packages/domain/src/notification-runtime.ts";
import { actorPermissions } from "../../../../packages/domain/src/membership.ts";
import { notificationMessage } from "./notification-message.ts";
import type { EmailContent } from "../../../../packages/contracts/src/notification-channels.ts";
import type { ServerConfig } from "../../../../packages/domain/src/config.ts";

type PlatformJob = {
	id: string;
	kind: string;
	generation: number;
	attempt_number: number;
	max_attempts: number;
	expiry: Date | null;
	encrypted_payload: Buffer;
};
type MailPayload = {
	email?: string;
	otp?: string;
	identifier?: string;
	verificationHash?: string;
	expiresAt?: string;
	invitationId?: string;
	url?: string;
	userId?: string;
	message?: EmailContent;
	channelSnapshot?: ChannelSnapshot;
};

/** Resolve live policy on every attempt; script output never selects the SMTP recipient. */
async function resolveMessage(pool: Pool, job: PlatformJob, data: MailPayload, config: ServerConfig) {
	const snapshot = data.channelSnapshot ?? {
		requestedKey: "smtp",
		channelId: null,
		revisionId: null,
		branding: defaultEmailBranding(config.publicUrl),
	};
	if (job.expiry && job.expiry.getTime() <= Date.now()) return null;
	if (snapshot.channelId && !(await pool.query("SELECT 1 FROM payloadbay.notification_channel WHERE id=$1 AND enabled", [snapshot.channelId])).rowCount) return null;
	let email: string;
	let message: EmailContent;
	let kind: NotificationInput["kind"];
	if (job.kind === "notification_mail") {
		const current = await notificationMessage(pool, job.id, config);
		if (!current) return null;
		email = current.email;
		message = current.message;
		kind = "delivery.failure-threshold";
	} else if (job.kind === "otp_mail") {
		const allowed = (await pool.query('SELECT value,"expiresAt">clock_timestamp() AS live FROM auth.verification WHERE identifier=$1 ORDER BY "createdAt" DESC LIMIT 1', [data.identifier])).rows[0];
		if (!data.email || !data.otp || !data.expiresAt || !data.verificationHash || new Date(data.expiresAt).getTime() <= Date.now() || !allowed?.live || !allowed.value.startsWith(data.verificationHash + ":")) return null;
		email = data.email;
		kind = "auth.login-code";
		message = {
			subject: "Your Payload Bay sign-in code",
			title: "Your sign-in code",
			preview: "Sign in to your Payload Bay account.",
			paragraphs: ["Use this code to sign in. It expires in five minutes.", "If you did not request this code, you can ignore this email."],
			code: data.otp,
		};
	} else if (job.kind === "invitation_mail") {
		if (!data.email || !data.url || !(await pool.query("SELECT 1 FROM payloadbay.invitation WHERE id=$1 AND state='pending' AND expires_at>clock_timestamp()", [data.invitationId])).rowCount) return null;
		email = data.email;
		kind = "auth.invitation";
		message = {
			subject: "You're invited to Payload Bay",
			title: "You're invited to Payload Bay",
			paragraphs: ["You have been invited to join this Payload Bay installation.", "Sign in with this email address to review and accept your access. This invitation expires in seven days.", "If you did not expect this invitation, you can ignore it."],
			action: { label: "Review invitation", url: data.url },
		};
	} else if (job.kind === "channel_test") {
		const scope = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
		const user = (await pool.query('SELECT email FROM auth."user" WHERE id=$1 AND "emailVerified" AND banned IS NOT TRUE', [data.userId])).rows[0];
		if (!scope || !user || !data.userId || !data.message) return null;
		try {
			const rights = await actorPermissions(pool, { userId: data.userId }, { type: "instance", id: scope.id });
			if (!rights.has("settings.manage") || !rights.has("code.test.effects")) return null;
		} catch {
			return null;
		}

		email = user.email;
		kind = "channel.test";
		message = data.message;
	} else throw Error("Unsupported notification job kind");

	return {
		email,
		message,
		kind,
		snapshot,
	};
}

export function platformJobTask(pool: Pool, config: ServerConfig) {
	return async (input: unknown) => {
		const payload = input as { jobId?: unknown; generation?: unknown };
		if (!payload || typeof payload.jobId !== "string" || !/^[-0-9a-f]{36}$/i.test(payload.jobId) || typeof payload.generation !== "number" || !Number.isInteger(payload.generation) || payload.generation < 1) throw Error("Invalid mail job reference");
		const claimed = (await pool.query("UPDATE payloadbay.platform_job SET state='running',attempt_number=attempt_number+1,lease_owner='mail-worker',lease_expiry=clock_timestamp()+interval '30 seconds' WHERE id=$1 AND generation=$2 AND state='queued' AND attempt_number<max_attempts RETURNING *", [payload.jobId, payload.generation])).rows[0] as PlatformJob | undefined;
		if (!claimed) return;
		const job = claimed;

		async function finish(state: "succeeded" | "failed" | "expired", error: string | null = null) {
			const changed = await pool.query("UPDATE payloadbay.platform_job SET state=$3,last_error=$4,lease_owner=NULL,lease_expiry=NULL WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp()", [job.id, job.generation, state, error]);
			if (changed.rowCount && job.kind === "notification_mail") await pool.query("UPDATE payloadbay.notification_dispatch SET state=$2 WHERE platform_job_id=$1", [job.id, state === "succeeded" ? "sent" : state === "expired" ? "skipped" : "failed"]);
		}

		async function retry(reason: string, requestedDelay?: number) {
			if (job.attempt_number >= job.max_attempts) return finish("failed", reason);
			const delay = requestedDelay ?? Math.min(60000, 1000 * 2 ** Math.max(0, job.attempt_number - 1));
			if (job.expiry && Date.now() + delay >= job.expiry.getTime()) return finish("expired", reason);
			await transaction(pool, async (db) => {
				const fresh = (await db.query("UPDATE payloadbay.platform_job SET state='queued',last_error=$3,generation=generation+1,lease_owner=NULL,lease_expiry=NULL,due_at=clock_timestamp()+($4::integer*interval '1 millisecond'),claim_deadline_at=clock_timestamp()+($4::integer*interval '1 millisecond')+interval '30 seconds' WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp() RETURNING *", [job.id, job.generation, reason, delay])).rows[0];
				if (fresh) await db.query("SELECT payloadbay.enqueue('platform_job',$1::json,$2,$3,$4::smallint)", [JSON.stringify({ jobId: fresh.id, generation: fresh.generation }), fresh.due_at, `platform:${fresh.id}:${fresh.generation}`, platformJobPriority(job.kind)]);
			});
		}

		try {
			if (job.kind === "event_retention") {
				await cleanupTask(pool, config)(job);

				return;
			}

			const data = decryptPrivate<MailPayload>(job.encrypted_payload, config.encryptionKey);
			const message = await resolveMessage(pool, job, data, config);
			if (!message) return finish("expired");
			const decision = await runNotificationChannel(
				pool,
				message.snapshot,
				{
					kind: message.kind,
					message: message.message,
					recipient: { email: message.email },
					deliveryId: job.id,
					attempt: job.attempt_number,
				},
				config,
			);
			if (decision.kind === "retry") return retry(decision.reason, decision.delayMs);
			if (decision.kind === "fail") return finish("failed", decision.reason);
			if (decision.kind === "complete") {
				if (message.kind.startsWith("auth.")) return finish("failed", "An authentication email channel must return an email message");

				return finish("succeeded");
			}

			const rendered = await renderEmailMessage(decision.message, message.snapshot.branding);
			// A slow adapter must not send a revoked invitation, superseded OTP or removed recipient.
			const current = await resolveMessage(pool, job, data, config);
			if (!current) return finish("expired");
			if (!(await pool.query("SELECT 1 FROM payloadbay.platform_job WHERE id=$1 AND generation=$2 AND state='running' AND lease_expiry>clock_timestamp()", [job.id, job.generation])).rowCount) return;
			const transport = nodemailer.createTransport({
				host: config.smtp.host,
				port: config.smtp.port,
				secure: config.smtp.secure,
				auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
				requireTLS: Boolean(config.smtp.user) && !config.smtp.secure,
				connectionTimeout: 5000,
				socketTimeout: 10000,
			});
			try {
				await transport.sendMail({ from: config.smtp.from, to: current.email, ...rendered });
			} finally {
				transport.close();
			}

			await finish("succeeded");
		} catch {
			await retry(job.kind === "event_retention" ? "Event retention failed; inspect database configuration" : "Notification delivery failed; inspect SMTP configuration and the published channel");
		}
	};
}
