import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { actorPermissions } from "./membership.ts";
import { snapshotNotificationChannel } from "./email-settings.ts";
import { encryptPrivate } from "./private-crypto.ts";

/** Durable per-incident/per-recipient dispatch; producer repetitions cannot resend mail. */
export async function queueIncidentNotifications(pool: Pool, incidentId: string, encryptionKey: string, publicUrl?: string): Promise<number> {
	return transaction(pool, async (db) => {
		const incident = (await db.query("SELECT * FROM payloadbay.notification_incident WHERE id=$1 AND status='active' AND kind='delivery.failure-threshold' AND scope_type IN ('project','workspace') FOR UPDATE", [incidentId])).rows[0];
		if (!incident) return 0;
		const rule = (await db.query("SELECT id FROM payloadbay.notification_rule WHERE id=$1 AND COALESCE(project_id,workspace_id)=$2 AND enabled AND version::text=$3", [incident.redacted_data.ruleId, incident.scope_id, incident.revision])).rows[0];
		if (!rule) return 0;
		const subscribers = (
			await db.query(
				`SELECT subscription.user_id,subscription.channel,subscription.channel_revision_id FROM payloadbay.notification_subscription subscription JOIN auth."user" recipient ON recipient.id=subscription.user_id AND recipient."emailVerified" WHERE subscription.rule_id=$1 AND subscription.enabled AND (subscription.channel='smtp' OR (subscription.channel_revision_id IS NOT NULL AND EXISTS(SELECT 1 FROM payloadbay.notification_channel channel WHERE channel.id::text=subscription.channel AND channel.enabled))) AND NOT EXISTS(SELECT 1 FROM payloadbay.notification_dispatch dispatch WHERE dispatch.incident_id=$2 AND dispatch.generation=$3 AND dispatch.user_id=subscription.user_id AND dispatch.channel=subscription.channel) ORDER BY subscription.user_id,subscription.channel LIMIT 100 FOR UPDATE OF subscription SKIP LOCKED`,
				[rule.id, incident.id, incident.generation],
			)
		).rows;
		let queued = 0;
		for (const subscriber of subscribers) {
			let allowed = false;
			try {
				allowed = (await actorPermissions(db, { userId: subscriber.user_id }, { type: incident.scope_type, id: incident.scope_id })).has("notifications.read");
			} catch (error) {
				if (!(error instanceof Error) || !["unauthenticated", "not_found", "forbidden"].includes((error as { code?: string }).code ?? "")) throw error;
			}

			if (!allowed) {
				await db.query("INSERT INTO payloadbay.notification_dispatch(incident_id,generation,user_id,channel,state) VALUES($1,$2,$3,$4,'skipped') ON CONFLICT DO NOTHING", [incident.id, incident.generation, subscriber.user_id, subscriber.channel]);
				continue;
			}

			const payload = {
				incidentId: incident.id,
				incidentGeneration: incident.generation,
				userId: subscriber.user_id,
				channelSnapshot: await snapshotNotificationChannel(db, subscriber.channel, publicUrl, subscriber.channel_revision_id ?? undefined),
			};
			const key = `notification:${incident.id}:${incident.generation}:${subscriber.user_id}:${subscriber.channel}`;
			const job = (await db.query("INSERT INTO payloadbay.platform_job(kind,encrypted_payload,job_key) VALUES('notification_mail',$1,$2) RETURNING id,generation", [encryptPrivate(payload, encryptionKey), key])).rows[0];
			await db.query("INSERT INTO payloadbay.notification_dispatch(incident_id,generation,user_id,channel,platform_job_id) VALUES($1,$2,$3,$4,$5)", [incident.id, incident.generation, subscriber.user_id, subscriber.channel, job.id]);
			await db.query("SELECT payloadbay.enqueue('platform_job',$1::json,clock_timestamp(),$2,30::smallint)", [JSON.stringify({ jobId: job.id, generation: job.generation }), `platform:${job.id}:${job.generation}`]);
			queued++;
		}

		return queued;
	});
}
