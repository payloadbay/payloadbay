import { z } from "zod";
import { notificationRuleOutput } from "../../contracts/src/notifications.ts";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";
import { reconcileCondition } from "./notifications.ts";

export const notificationRuleInput = z
	.object({
		endpointId: z.uuid().nullable().optional(),
		destinationId: z.uuid().nullable().optional(),
		enabled: z.boolean().default(false),
		signal: z.literal("failed_operation").default("failed_operation"),
		count: z.number().int().min(1).max(1000000),
		windowSeconds: z.number().int().min(1).max(2678400),
		severity: z.enum(["info", "warning", "critical"]).default("warning"),
		recoveryPolicy: z.enum(["manual", "window"]).default("manual"),
		cooldownSeconds: z.number().int().min(0).max(86400).default(0),
	})
	.strict();

function dto(row: Record<string, unknown>) {
	return notificationRuleOutput.parse({
		id: row.id,
		projectId: row.project_id,
		endpointId: row.endpoint_id,
		destinationId: row.destination_id,
		enabled: row.enabled,
		signal: row.signal,
		count: row.count,
		windowSeconds: row.window_seconds,
		severity: row.severity,
		recoveryPolicy: row.recovery_policy,
		cooldownSeconds: row.cooldown_seconds,
		version: row.version,
	});
}

export async function createNotificationRule(pool: Pool, actor: Actor, projectId: string, input: unknown) {
	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "project", id: projectId }, "notifications.rules.manage");
		const parsed = notificationRuleInput.safeParse(input);
		if (!parsed.success) throw new AppError("invalid_input", 400, "Provide valid opt-in notification thresholds");
		const data = parsed.data;
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification-rules:" + projectId]);
		if (Number((await db.query("SELECT count(*) FROM payloadbay.notification_rule WHERE project_id=$1", [projectId])).rows[0].count) >= 32) throw new AppError("rule_limit", 409, "At most 32 rules are supported per project");
		for (const [table, id] of [
			["endpoint", data.endpointId],
			["destination", data.destinationId],
		] as const)
			if (id && !(await db.query("SELECT id FROM payloadbay." + table + " WHERE id=$1 AND project_id=$2", [id, projectId])).rowCount) throw new AppError("invalid_rule_scope", 400, "Rule targets must belong to this project");
		const row = (await db.query("INSERT INTO payloadbay.notification_rule(project_id,endpoint_id,destination_id,enabled,signal,count,window_seconds,severity,recovery_policy,cooldown_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [projectId, data.endpointId ?? null, data.destinationId ?? null, data.enabled, data.signal, data.count, data.windowSeconds, data.severity, data.recoveryPolicy, data.cooldownSeconds])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'notification.rule_created',$3)", [actor.userId, projectId, row.id]);
		await appendChange(db, {
			scope: { type: "project", id: projectId },
			kind: "configuration.changed",
			resourceId: row.id,
			capability: "notifications.rules.manage",
		});

		return dto(row);
	});
}

export async function listNotificationRules(pool: Pool, actor: Actor, projectId: string) {
	await requirePermission(pool, actor, { type: "project", id: projectId }, "notifications.rules.manage");

	return (await pool.query("SELECT * FROM payloadbay.notification_rule WHERE project_id=$1 ORDER BY id LIMIT 32", [projectId])).rows.map(dto);
}

/** Trusted producer: thresholds count distinct managed operations, never retry attempts. */
export async function evaluateFailureRules(pool: Pool) {
	const rules = (await pool.query("SELECT * FROM payloadbay.notification_rule WHERE signal='failed_operation' ORDER BY id LIMIT 2000")).rows;
	const incidents = [];
	for (const rule of rules) {
		const observed = Number(
			(
				await pool.query(
					`SELECT count(DISTINCT (a.execution_id,a.operation_id)) FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.endpoint e ON e.id=x.endpoint_id JOIN payloadbay.managed_operation m ON m.execution_id=a.execution_id AND m.operation_id=a.operation_id WHERE e.project_id=$1 AND ($2::uuid IS NULL OR e.id=$2) AND ($3::uuid IS NULL OR m.destination_snapshot->>'id'=$3::text) AND a.ended_at>=clock_timestamp()-($4::integer*interval '1 second') AND (a.network_error IS NOT NULL OR a.status_code<200 OR a.status_code>=300)`,
					[rule.project_id, rule.endpoint_id, rule.destination_id, rule.window_seconds],
				)
			).rows[0].count,
		);
		const key = "project:" + rule.project_id + ":failure-rule:" + rule.id;
		const latest = (await pool.query("SELECT status,resolved_at FROM payloadbay.notification_incident WHERE condition_key=$1 AND revision=$2 ORDER BY generation DESC LIMIT 1", [key, String(rule.version)])).rows[0];
		const held = rule.recovery_policy === "manual" && latest?.status === "active";
		const cooling = latest?.status === "resolved" && new Date(latest.resolved_at).getTime() + rule.cooldown_seconds * 1000 > Date.now();
		const active = rule.enabled && (held || (observed >= rule.count && !cooling));
		const incident = await reconcileCondition(pool, {
			key: "failure-rule:" + rule.id,
			revision: String(rule.version),
			kind: "delivery.failure-threshold",
			scope: { type: "project", id: rule.project_id },
			subject: "Delivery failure threshold reached",
			severity: rule.severity,
			active,
			data: {
				ruleId: rule.id,
				observedCount: observed,
				threshold: rule.count,
				windowSeconds: rule.window_seconds,
				endpointId: rule.endpoint_id,
				destinationId: rule.destination_id,
			},
		});
		if (incident) incidents.push(incident);
	}

	return incidents;
}

export const notificationRuleUpdateInput = notificationRuleInput
	.omit({
		enabled: true,
		signal: true,
		severity: true,
		recoveryPolicy: true,
		cooldownSeconds: true,
	})
	.partial()
	.extend({
		enabled: z.boolean().optional(),
		signal: z.literal("failed_operation").optional(),
		severity: z.enum(["info", "warning", "critical"]).optional(),
		recoveryPolicy: z.enum(["manual", "window"]).optional(),
		cooldownSeconds: z.number().int().min(0).max(86400).optional(),
	})
	.strict();

export async function updateNotificationRule(pool: Pool, actor: Actor, id: string, expectedVersion: number, input: unknown) {
	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT * FROM payloadbay.notification_rule WHERE id=$1 FOR UPDATE", [id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Notification rule unavailable");
		await requirePermission(db, actor, { type: "project", id: row.project_id }, "notifications.rules.manage");
		if (row.version !== expectedVersion) throw new AppError("version_conflict", 409, "Rule changed; reload before saving");
		const patch = notificationRuleUpdateInput.safeParse(input);
		if (!patch.success) throw new AppError("invalid_input", 400, "Provide valid notification rule changes");
		const data = notificationRuleInput.parse({
			endpointId: row.endpoint_id,
			destinationId: row.destination_id,
			enabled: row.enabled,
			signal: row.signal,
			count: row.count,
			windowSeconds: row.window_seconds,
			severity: row.severity,
			recoveryPolicy: row.recovery_policy,
			cooldownSeconds: row.cooldown_seconds,
			...patch.data,
		});
		for (const [table, target] of [
			["endpoint", data.endpointId],
			["destination", data.destinationId],
		] as const)
			if (target && !(await db.query("SELECT id FROM payloadbay." + table + " WHERE id=$1 AND project_id=$2", [target, row.project_id])).rowCount) throw new AppError("invalid_rule_scope", 400, "Rule targets must belong to this project");
		const changed = (await db.query("UPDATE payloadbay.notification_rule SET endpoint_id=$2,destination_id=$3,enabled=$4,signal=$5,count=$6,window_seconds=$7,severity=$8,recovery_policy=$9,cooldown_seconds=$10,version=version+1 WHERE id=$1 RETURNING *", [id, data.endpointId ?? null, data.destinationId ?? null, data.enabled, data.signal, data.count, data.windowSeconds, data.severity, data.recoveryPolicy, data.cooldownSeconds])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,'project',$2,'notification.rule_updated',$3)", [actor.userId, row.project_id, id]);
		await appendChange(db, {
			scope: { type: "project", id: row.project_id },
			kind: "configuration.changed",
			resourceId: id,
			capability: "notifications.rules.manage",
		});

		return dto(changed);
	});
}
