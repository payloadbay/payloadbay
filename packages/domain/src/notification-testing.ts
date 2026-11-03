import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import type { ServerConfig } from "./config.ts";
import { notificationInstance, getNotificationChannel } from "./notification-channels.ts";
import { requirePermission } from "./membership.ts";
import { snapshotNotificationChannel } from "./email-settings.ts";
import { encryptPrivate } from "./private-crypto.ts";
import { transaction } from "./db.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { EmailContent } from "../../contracts/src/notification-channels.ts";

export function sampleNotification(kind: "login" | "invitation" | "alert", publicUrl: string): EmailContent {
	if (kind === "login")
		return {
			subject: "Your Payload Bay sign-in code",
			title: "Your sign-in code",
			paragraphs: ["This is a preview of your sign-in email. This sample code does not grant access."],
			code: "123456",
		};
	if (kind === "invitation")
		return {
			subject: "You're invited to Payload Bay",
			title: "You're invited",
			paragraphs: ["This is a preview of a workspace invitation."],
			action: { label: "Review invitation", url: new URL("/account", publicUrl).href },
		};

	return {
		subject: "Payload Bay delivery alert",
		title: "Delivery failure threshold reached",
		paragraphs: ["A configured delivery rule reached its failure threshold.", "This is a synthetic notification; no production events were used."],
		action: { label: "Inspect events", url: new URL("/events", publicUrl).href },
	};
}

/** Explicit effects test, fixed to the current verified administrator; never accepts an arbitrary recipient. */
export async function queueChannelTest(pool: Pool, actor: Actor, key: string, config: ServerConfig) {
	const scope = await notificationInstance(pool);
	await requirePermission(pool, actor, scope, "settings.manage");
	await requirePermission(pool, actor, scope, "code.test.effects");
	await getNotificationChannel(pool, actor, key);

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, scope, "settings.manage");
		await requirePermission(db, actor, scope, "code.test.effects");
		const user = (await db.query('SELECT email FROM auth."user" WHERE id=$1 AND "emailVerified" AND banned IS NOT TRUE', [actor.userId])).rows[0];
		if (!user) throw new AppError("verified_email_required", 409, "Verify your account email before sending a test");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["channel-test:" + actor.userId]);
		if (Number((await db.query("SELECT count(*) FROM payloadbay.platform_job WHERE kind='channel_test' AND job_key LIKE $1 AND created_at>clock_timestamp()-interval '1 minute'", ["channel-test:" + actor.userId + ":%"])).rows[0].count) >= 5) throw new AppError("test_limit", 429, "Wait a minute before sending more test notifications");
		const snapshot = await snapshotNotificationChannel(db, key, config.publicUrl);
		if (snapshot.revisionId) {
			const revision = (await db.query("SELECT secret_bindings FROM payloadbay.notification_channel_revision WHERE id=$1", [snapshot.revisionId])).rows[0];
			if (Object.keys(revision.secret_bindings).length) await requirePermission(db, actor, scope, "secrets.use");
		}

		const payload = { userId: actor.userId, message: sampleNotification("alert", config.publicUrl), channelSnapshot: snapshot };
		const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key,expiry) VALUES('channel_test',$1,$2,clock_timestamp()+interval '10 minutes') RETURNING id,generation", [encryptPrivate(payload, config.encryptionKey), "channel-test:" + actor.userId + ":" + crypto.randomUUID()])).rows[0];
		await db.query("SELECT payloadbay.enqueue('platform_job',$1::json,clock_timestamp(),$2,30::smallint)", [JSON.stringify({ jobId: job.id, generation: job.generation }), `platform:${job.id}:${job.generation}`]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'instance',$2,'notification.test_queued',$3)", [actor.userId, scope.id, job.id]);

		return { jobId: job.id as string, recipient: user.email as string };
	});
}
