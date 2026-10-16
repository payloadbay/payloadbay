import type { Pool, PoolClient } from "pg";
import type { Actor } from "./authorization.ts";
import { emailBranding, emailSettingsInput, type EmailBranding } from "../../contracts/src/notification-channels.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { requirePermission } from "./membership.ts";
import { notificationInstance } from "./notification-channels.ts";
import { transaction } from "./db.ts";
import { appendChange } from "./changes.ts";

export type ChannelSnapshot = {
	requestedKey: string;
	channelId: string | null;
	revisionId: string | null;
	branding: EmailBranding;
};

export function defaultEmailBranding(publicUrl?: string) {
	return emailBranding.parse({ logoUrl: publicUrl ? new URL("/brand/payloadbay-email-logo.png", publicUrl).href : null });
}

export async function getEmailSettings(pool: Pool, actor: Actor, publicUrl?: string) {
	const scope = await notificationInstance(pool);
	await requirePermission(pool, actor, scope, "settings.manage");
	const row = (await pool.query("SELECT * FROM payloadbay.email_settings WHERE installation_id=$1", [scope.id])).rows[0];

	return { version: row?.version ?? 0, channelKey: row?.channel_id ?? "smtp", branding: row ? emailBranding.parse(row.branding) : defaultEmailBranding(publicUrl) };
}

export async function saveEmailSettings(pool: Pool, actor: Actor, input: unknown) {
	const parsed = emailSettingsInput.safeParse(input);
	if (!parsed.success) throw new AppError("invalid_email_settings", 400, "Provide valid email branding and a channel");
	const data = parsed.data;

	return transaction(pool, async (db) => {
		const scope = await notificationInstance(db);
		await requirePermission(db, actor, scope, "settings.manage");
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification-channels:" + scope.id]);
		const row = (await db.query("SELECT version FROM payloadbay.email_settings WHERE installation_id=$1 FOR UPDATE", [scope.id])).rows[0];
		if ((row?.version ?? 0) !== data.expectedVersion) throw new AppError("version_conflict", 409, "Email settings changed; reload before saving");
		if (data.channelKey !== "smtp" && !(await db.query("SELECT 1 FROM payloadbay.notification_channel WHERE id=$1 AND installation_id=$2 AND kind='email' AND enabled AND active_revision_id IS NOT NULL", [data.channelKey, scope.id])).rowCount) throw new AppError("channel_unavailable", 409, "Choose an enabled email channel");
		const saved = (await db.query("INSERT INTO payloadbay.email_settings(installation_id,channel_id,branding,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(installation_id) DO UPDATE SET channel_id=EXCLUDED.channel_id,branding=EXCLUDED.branding,version=payloadbay.email_settings.version+1,updated_by=EXCLUDED.updated_by RETURNING version", [scope.id, data.channelKey === "smtp" ? null : data.channelKey, JSON.stringify(data.branding), actor.userId])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'instance',$2,'email.settings_updated',$3,$4)", [actor.userId, scope.id, scope.id, JSON.stringify({ version: saved.version, channelKey: data.channelKey })]);
		await appendChange(db, {
			scope,
			kind: "configuration.changed",
			resourceId: scope.id,
			capability: "settings.manage",
		});

		return { version: saved.version as number, channelKey: data.channelKey, branding: data.branding };
	});
}

/** Queue-time configuration: code revisions and presentation cannot drift during retries. */
export async function snapshotNotificationChannel(db: Pool | PoolClient, requestedKey = "smtp", publicUrl?: string): Promise<ChannelSnapshot> {
	const installation = (await db.query("SELECT id FROM payloadbay.installation WHERE singleton")).rows[0];
	const settings = installation ? (await db.query("SELECT channel_id,branding FROM payloadbay.email_settings WHERE installation_id=$1", [installation.id])).rows[0] : null;
	const selectedId = requestedKey === "smtp" ? settings?.channel_id : requestedKey;
	if (!selectedId)
		return {
			requestedKey,
			channelId: null,
			revisionId: null,
			branding: settings ? emailBranding.parse(settings.branding) : defaultEmailBranding(publicUrl),
		};
	const channel = (await db.query("SELECT id,active_revision_id FROM payloadbay.notification_channel WHERE id=$1 AND installation_id=$2 AND enabled AND active_revision_id IS NOT NULL", [selectedId, installation?.id])).rows[0];
	if (!channel) throw new AppError("channel_unavailable", 409, "Notification channel unavailable");

	return {
		requestedKey,
		channelId: channel.id,
		revisionId: channel.active_revision_id,
		branding: settings ? emailBranding.parse(settings.branding) : defaultEmailBranding(publicUrl),
	};
}
