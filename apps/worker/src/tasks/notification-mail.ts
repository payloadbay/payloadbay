import type { Pool } from "pg";
import type { ServerConfig } from "../../../../packages/domain/src/config.ts";
import { actorPermissions } from "../../../../packages/domain/src/membership.ts";

/** Resolve current preferences and authority immediately before the SMTP attempt. */
export async function notificationMailMessage(pool: Pool, jobId: string, config: ServerConfig) {
	const incident = (
		await pool.query(
			`SELECT notification.*,recipient.email FROM payloadbay.notification_dispatch dispatch JOIN payloadbay.notification_incident notification ON notification.id=dispatch.incident_id AND notification.generation=dispatch.generation JOIN payloadbay.notification_rule rule ON rule.id::text=notification.redacted_data->>'ruleId' AND COALESCE(rule.project_id,rule.workspace_id)=notification.scope_id AND rule.enabled AND rule.version::text=notification.revision JOIN payloadbay.notification_subscription subscription ON subscription.rule_id=rule.id AND subscription.user_id=dispatch.user_id AND subscription.channel='smtp' AND subscription.enabled JOIN auth."user" recipient ON recipient.id=dispatch.user_id AND recipient."emailVerified" AND recipient.banned IS NOT TRUE WHERE dispatch.platform_job_id=$1 AND dispatch.channel='smtp' AND dispatch.state='queued' AND notification.status='active' AND notification.scope_type IN ('project','workspace') AND notification.kind='delivery.failure-threshold'`,
			[jobId],
		)
	).rows[0];
	if (!incident) return null;
	const recipient = (await pool.query("SELECT user_id FROM payloadbay.notification_dispatch WHERE platform_job_id=$1", [jobId])).rows[0];
	try {
		if (!(await actorPermissions(pool, { userId: recipient.user_id }, { type: incident.scope_type, id: incident.scope_id })).has("notifications.read")) return null;
	} catch (error) {
		if (error instanceof Error && ["unauthenticated", "forbidden", "not_found"].includes((error as { code?: string }).code ?? "")) return null;
		throw error;
	}

	const link = new URL((incident.scope_type === "workspace" ? "/workspaces/" : "/projects/") + incident.scope_id + "/notifications", config.publicUrl).href;

	return {
		email: incident.email as string,
		subject: incident.subject as string,
		text: `A delivery failure threshold was reached.

Review notifications: ${link}

This message contains no webhook payloads or credentials.`,
	};
}
