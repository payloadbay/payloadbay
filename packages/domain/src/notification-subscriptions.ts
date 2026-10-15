import type { Pool } from "pg";
import type { Actor } from "./authorization.ts";
import { notificationSubscriptionInput, notificationPreferenceOutput } from "../../contracts/src/notifications.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";

/** Preferences belong to the authenticated recipient, never an input-supplied user. */
export async function setNotificationSubscription(pool: Pool, actor: Actor, ruleId: string, input: unknown) {
	return transaction(pool, async (db) => {
		const rule = (await db.query("SELECT id,project_id,workspace_id FROM payloadbay.notification_rule WHERE id=$1 FOR SHARE", [ruleId])).rows[0];
		if (!rule) throw new AppError("not_found", 404, "Notification rule unavailable");
		const scope = rule.workspace_id ? { type: "workspace" as const, id: rule.workspace_id } : { type: "project" as const, id: rule.project_id };
		await requirePermission(db, actor, scope, "notifications.read");
		const parsed = notificationSubscriptionInput.safeParse(input);
		if (!parsed.success) throw new AppError("invalid_input", 400, "Provide an explicit email subscription preference");
		await db.query("INSERT INTO payloadbay.notification_subscription(rule_id,user_id,channel,enabled) VALUES($1,$2,'smtp',$3) ON CONFLICT(rule_id,user_id,channel) DO UPDATE SET enabled=EXCLUDED.enabled", [ruleId, actor.userId, parsed.data.enabled]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'notification.subscription_changed',$4,$5)", [actor.userId, scope.type, scope.id, ruleId, JSON.stringify({ channel: "smtp", enabled: parsed.data.enabled })]);

		return { ruleId, channel: "smtp" as const, enabled: parsed.data.enabled };
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
        COALESCE(subscription.enabled,false) AS "smtpEnabled"
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
