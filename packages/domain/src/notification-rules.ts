import { notificationRuleInput, notificationRuleUpdateInput } from "../../contracts/src/notifications.ts";

import { notificationRuleOutput } from "../../contracts/src/notifications.ts";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { requirePermission } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";
import { reconcileCondition } from "./notifications.ts";

export { notificationRuleInput, notificationRuleUpdateInput } from "../../contracts/src/notifications.ts";

type RuleScope = { type: "project" | "workspace"; id: string };

function ruleScope(row: Record<string, unknown>): RuleScope {
	return row.workspace_id ? { type: "workspace", id: row.workspace_id as string } : { type: "project", id: row.project_id as string };
}

function dto(row: Record<string, unknown>) {
	return notificationRuleOutput.parse({
		id: row.id,
		projectId: row.project_id,
		workspaceId: row.workspace_id ?? null,
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

export async function createNotificationRule(pool: Pool, actor: Actor, projectId: string | RuleScope, input: unknown) {
	const scope: RuleScope = typeof projectId === "string" ? { type: "project", id: projectId } : projectId;
	const column = scope.type === "workspace" ? "workspace_id" : "project_id";

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, scope, "notifications.rules.manage");
		const parsed = notificationRuleInput.safeParse(input);
		if (!parsed.success) throw new AppError("invalid_input", 400, "Provide valid opt-in notification thresholds");
		const data = parsed.data;
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification-rules:" + scope.type + ":" + scope.id]);
		if (Number((await db.query(`SELECT count(*) FROM payloadbay.notification_rule WHERE ${column}=$1`, [scope.id])).rows[0].count) >= 32) throw new AppError("rule_limit", 409, "At most 32 rules are supported per scope");
		for (const [table, id] of [
			["endpoint", data.endpointId],
			["destination", data.destinationId],
		] as const)
			if (id && (scope.type === "workspace" || !(await db.query("SELECT id FROM payloadbay." + table + " WHERE id=$1 AND project_id=$2", [id, scope.id])).rowCount)) throw new AppError("invalid_rule_scope", 400, "Rule targets must belong to this project");
		const row = (await db.query(`INSERT INTO payloadbay.notification_rule(${column},endpoint_id,destination_id,enabled,signal,count,window_seconds,severity,recovery_policy,cooldown_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [scope.id, data.endpointId ?? null, data.destinationId ?? null, data.enabled, data.signal, data.count, data.windowSeconds, data.severity, data.recoveryPolicy, data.cooldownSeconds])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'notification.rule_created',$4)", [actor.userId, scope.type, scope.id, row.id]);
		await appendChange(db, {
			scope,
			kind: "configuration.changed",
			resourceId: row.id,
			capability: "notifications.rules.manage",
		});

		return dto(row);
	});
}

export async function listNotificationRules(pool: Pool, actor: Actor, projectId: string | RuleScope) {
	const scope: RuleScope = typeof projectId === "string" ? { type: "project", id: projectId } : projectId;
	await requirePermission(pool, actor, scope, "notifications.rules.manage");

	return (await pool.query(`SELECT * FROM payloadbay.notification_rule WHERE ${scope.type === "workspace" ? "workspace_id" : "project_id"}=$1 ORDER BY id LIMIT 32`, [scope.id])).rows.map(dto);
}

/** Trusted producer: thresholds count distinct managed operations, never retry attempts. */
export async function evaluateFailureRules(pool: Pool) {
	const rules = (await pool.query("SELECT * FROM payloadbay.notification_rule WHERE signal='failed_operation' ORDER BY id LIMIT 2000")).rows;
	const incidents = [];
	for (const rule of rules) {
		const scope = ruleScope(rule);
		const observed = Number(
			(
				await pool.query(
					`SELECT count(DISTINCT (a.execution_id,a.operation_id)) FROM payloadbay.delivery_attempt a JOIN payloadbay.execution x ON x.id=a.execution_id JOIN payloadbay.endpoint e ON e.id=x.endpoint_id JOIN payloadbay.managed_operation m ON m.execution_id=a.execution_id AND m.operation_id=a.operation_id WHERE (e.project_id=$1 OR ($5::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM payloadbay.project p WHERE p.id=e.project_id AND p.workspace_id=$5))) AND ($2::uuid IS NULL OR e.id=$2) AND ($3::uuid IS NULL OR m.destination_snapshot->>'id'=$3::text) AND a.ended_at>=clock_timestamp()-($4::integer*interval '1 second') AND (a.network_error IS NOT NULL OR a.status_code<200 OR a.status_code>=300)`,
					[rule.project_id, rule.endpoint_id, rule.destination_id, rule.window_seconds, rule.workspace_id],
				)
			).rows[0].count,
		);
		const key = scope.type + ":" + scope.id + ":failure-rule:" + rule.id;
		const latest = (await pool.query("SELECT status,resolved_at FROM payloadbay.notification_incident WHERE condition_key=$1 AND revision=$2 ORDER BY generation DESC LIMIT 1", [key, String(rule.version)])).rows[0];
		const held = rule.recovery_policy === "manual" && latest?.status === "active";
		const cooling = latest?.status === "resolved" && new Date(latest.resolved_at).getTime() + rule.cooldown_seconds * 1000 > Date.now();
		const active = rule.enabled && (held || (observed >= rule.count && !cooling));
		const incident = await reconcileCondition(pool, {
			key: "failure-rule:" + rule.id,
			revision: String(rule.version),
			kind: "delivery.failure-threshold",
			scope,
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

export async function updateNotificationRule(pool: Pool, actor: Actor, id: string, expectedVersion: number, input: unknown) {
	return transaction(pool, async (db) => {
		const row = (await db.query("SELECT * FROM payloadbay.notification_rule WHERE id=$1 FOR UPDATE", [id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Notification rule unavailable");
		const scope = ruleScope(row);
		await requirePermission(db, actor, scope, "notifications.rules.manage");
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
			if (target && (scope.type === "workspace" || !(await db.query("SELECT id FROM payloadbay." + table + " WHERE id=$1 AND project_id=$2", [target, row.project_id])).rowCount)) throw new AppError("invalid_rule_scope", 400, "Rule targets must belong to this project");
		const changed = (await db.query("UPDATE payloadbay.notification_rule SET endpoint_id=$2,destination_id=$3,enabled=$4,signal=$5,count=$6,window_seconds=$7,severity=$8,recovery_policy=$9,cooldown_seconds=$10,version=version+1 WHERE id=$1 RETURNING *", [id, data.endpointId ?? null, data.destinationId ?? null, data.enabled, data.signal, data.count, data.windowSeconds, data.severity, data.recoveryPolicy, data.cooldownSeconds])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id) VALUES($1,$2,$3,'notification.rule_updated',$4)", [actor.userId, scope.type, scope.id, id]);
		await appendChange(db, {
			scope,
			kind: "configuration.changed",
			resourceId: id,
			capability: "notifications.rules.manage",
		});

		return dto(changed);
	});
}
