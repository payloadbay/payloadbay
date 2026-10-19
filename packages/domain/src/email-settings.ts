import type { Pool, PoolClient } from "pg";
import type { Actor } from "./authorization.ts";
import { emailBranding, emailSettingsInput, type EmailBranding } from "../../contracts/src/notification-channels.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { requirePermission } from "./membership.ts";
import { notificationInstance } from "./notification-channels.ts";

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

	return { version: row?.version ?? 0, channelKey: "smtp", branding: row ? emailBranding.parse(row.branding) : defaultEmailBranding(publicUrl) };
}

/** Instance-wide white-labeling stays unavailable until verified enterprise entitlements exist. */
export async function saveEmailSettings(pool: Pool, actor: Actor, input: unknown) {
	const scope = await notificationInstance(pool);
	await requirePermission(pool, actor, scope, "settings.manage");
	if (!emailSettingsInput.safeParse(input).success) throw new AppError("invalid_email_settings", 400, "Provide valid instance branding");

	throw new AppError("feature_unavailable", 403, "Instance customization requires enterprise licensing, which is not yet available");
}

/** Queue-time configuration: code revisions and presentation cannot drift during retries. */
export async function snapshotNotificationChannel(db: Pool | PoolClient, requestedKey = "smtp", publicUrl?: string, approvedRevisionId?: string): Promise<ChannelSnapshot> {
	const installation = (await db.query("SELECT id FROM payloadbay.installation WHERE singleton")).rows[0];
	const settings = installation ? (await db.query("SELECT channel_id,branding FROM payloadbay.email_settings WHERE installation_id=$1", [installation.id])).rows[0] : null;
	const selectedId = requestedKey === "smtp" ? null : requestedKey;
	if (!selectedId)
		return {
			requestedKey,
			channelId: null,
			revisionId: null,
			branding: settings ? emailBranding.parse(settings.branding) : defaultEmailBranding(publicUrl),
		};
	const channel = (await db.query("SELECT c.id,r.id AS active_revision_id FROM payloadbay.notification_channel c JOIN payloadbay.notification_channel_revision r ON r.channel_id=c.id AND r.id=COALESCE($3::uuid,c.active_revision_id) WHERE c.id=$1 AND c.installation_id=$2 AND c.enabled", [selectedId, installation?.id, approvedRevisionId ?? null])).rows[0];
	if (!channel) throw new AppError("channel_unavailable", 409, "Notification channel unavailable");

	return {
		requestedKey,
		channelId: channel.id,
		revisionId: channel.active_revision_id,
		branding: settings ? emailBranding.parse(settings.branding) : defaultEmailBranding(publicUrl),
	};
}
