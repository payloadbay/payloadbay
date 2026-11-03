import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { notificationSubscriptionInput, notificationPreferenceOutput } from "../../contracts/src/notifications.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry } from "./membership.ts";

/** Preferences belong to the authenticated recipient, never an input-supplied user. */
export async function setNotificationSubscription(pool: Pool, actor: Actor, ruleId: string, input: unknown) {
	return transaction(pool, async (db) => {
		const rule = (await db.query("SELECT id,project_id,workspace_id FROM payloadbay.notification_rule WHERE id=$1 FOR SHARE", [ruleId])).rows[0];
		if (!rule) throw new AppError("not_found", 404, "Notification rule unavailable");
		const scope = rule.workspace_id ? { type: "workspace" as const, id: rule.workspace_id } : { type: "project" as const, id: rule.project_id };
		await requirePermission(db, actor, scope, "notifications.read");
		const parsed = notificationSubscriptionInput.safeParse(input);
		if (!parsed.success) throw new AppError("invalid_input", 400, "Provide an explicit email subscription preference");
		const channel = parsed.data.channel;

		let revisionId: string | null = null;
		if (channel !== "smtp") {
			const ancestry = await scopeAncestry(db, scope);
			const selected = (await db.query("SELECT active_revision_id FROM payloadbay.notification_channel WHERE id=$1 AND installation_id=$2 AND ($3=false OR enabled) FOR SHARE", [channel, ancestry[0].id, parsed.data.enabled])).rows[0];
			if (!selected) throw new AppError("channel_unavailable", 409, "Choose an enabled notification channel");
			if (parsed.data.enabled && (!parsed.data.revisionId || parsed.data.revisionId !== selected.active_revision_id)) throw new AppError("channel_version_changed", 409, "Review the current notification module version before enabling it");
			revisionId = parsed.data.enabled ? selected.active_revision_id : null;
		}

		await db.query("INSERT INTO payloadbay.notification_subscription(rule_id,user_id,channel,enabled,channel_revision_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(rule_id,user_id,channel) DO UPDATE SET enabled=EXCLUDED.enabled,channel_revision_id=EXCLUDED.channel_revision_id", [ruleId, actor.userId, channel, parsed.data.enabled, revisionId]);

		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'notification.subscription_changed',$4,$5)", [actor.userId, scope.type, scope.id, ruleId, JSON.stringify({ channel, enabled: parsed.data.enabled })]);

		return { ruleId, channel, enabled: parsed.data.enabled };
	});
}

export async function listNotificationPreferences(pool: Pool, actor: Actor, projectId: string | { type: "workspace"; id: string }) {
	const scope = typeof projectId === "string" ? { type: "project" as const, id: projectId } : projectId;
	await requirePermission(pool, actor, scope, "notifications.read");
	const rows = (
		await pool.query(
			`
 SELECT rule.id,rule.project_id AS "projectId",rule.workspace_id AS "workspaceId",rule.endpoint_id AS "endpointId",
        rule.destination_id AS "destinationId",rule.enabled,rule.signal,rule.count,
        rule.window_seconds AS "windowSeconds",rule.severity,rule.recovery_policy AS "recoveryPolicy",
        rule.cooldown_seconds AS "cooldownSeconds",rule.version,
        COALESCE(subscription.enabled,false) AS "smtpEnabled",
        COALESCE((SELECT jsonb_agg(s.channel ORDER BY s.channel) FROM payloadbay.notification_subscription s WHERE s.rule_id=rule.id AND s.user_id=$2 AND s.enabled AND (s.channel='smtp' OR s.channel_revision_id IS NOT NULL)),'[]'::jsonb) AS channels,
        COALESCE((SELECT jsonb_object_agg(s.channel,r.version) FROM payloadbay.notification_subscription s JOIN payloadbay.notification_channel_revision r ON r.id=s.channel_revision_id WHERE s.rule_id=rule.id AND s.user_id=$2 AND s.enabled),'{}'::jsonb) AS "channelVersions"
 FROM payloadbay.notification_rule rule
 LEFT JOIN payloadbay.notification_subscription subscription
   ON subscription.rule_id=rule.id AND subscription.user_id=$2 AND subscription.channel='smtp'
 WHERE rule.${scope.type === "workspace" ? "workspace_id" : "project_id"}=$1
 ORDER BY rule.id LIMIT 32
 `,
			[scope.id, actor.userId],
		)
	).rows;

	return rows.map((row) => notificationPreferenceOutput.parse(row));
}
