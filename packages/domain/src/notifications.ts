import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";
import { requirePermission, actorPermissions } from "./membership.ts";
import type { Actor, ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";

export type Condition = {
	key: string;
	revision: string;
	kind: string;
	scope: ScopeRef;
	subject: string;
	severity: "info" | "warning" | "critical";
	active: boolean;
	data?: Record<string, unknown>;
};

/** Trusted producers provide redacted data; recipients always pass live domain authorization. */
export async function reconcileCondition(pool: Pool, input: Condition) {
	if (!input.key || input.key.length > 200 || !input.revision || input.revision.length > 128 || input.subject.length > 200 || Buffer.byteLength(JSON.stringify(input.data ?? {})) > 8192) throw new AppError("invalid_condition", 400, "Notification condition is invalid");

	return transaction(pool, async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification:" + input.scope.type + ":" + input.scope.id + ":" + input.key]);
		const key = input.scope.type + ":" + input.scope.id + ":" + input.key;
		const existing = (await db.query("SELECT * FROM payloadbay.notification_incident WHERE condition_key=$1 AND status='active' FOR UPDATE", [key])).rows;
		const same = existing.find((row) => row.revision === input.revision);
		const changed: string[] = [];
		for (const row of existing)
			if (!input.active || row.revision !== input.revision) {
				await db.query("UPDATE payloadbay.notification_incident SET status='resolved',resolved_at=clock_timestamp(),last_seen=clock_timestamp() WHERE id=$1", [row.id]);
				changed.push(row.id);
			}

		let result = same;
		if (input.active && same) {
			result = (await db.query("UPDATE payloadbay.notification_incident SET last_seen=clock_timestamp(),subject=$2,severity=$3,redacted_data=$4 WHERE id=$1 RETURNING *", [same.id, input.subject, input.severity, JSON.stringify(input.data ?? {})])).rows[0];
		} else if (input.active) {
			result = (await db.query("INSERT INTO payloadbay.notification_incident(condition_key,revision,generation,kind,scope_type,scope_id,subject,severity,status,redacted_data) SELECT $1,$2,COALESCE(max(generation),0)+1,$3,$4,$5,$6,$7,'active',$8 FROM payloadbay.notification_incident WHERE condition_key=$1 RETURNING *", [key, input.revision, input.kind, input.scope.type, input.scope.id, input.subject, input.severity, JSON.stringify(input.data ?? {})])).rows[0];
			changed.push(result.id);
		}

		for (const id of changed)
			await appendChange(db, {
				scope: input.scope,
				kind: "notification.changed",
				resourceId: id,
				capability: input.kind === "executor.containment-advice" ? "settings.manage" : "notifications.read",
			});

		return input.active ? result : null;
	});
}

export async function reconcileRuntimeNotice(pool: Pool, installationId: string, mode: "runc" | "runsc") {
	return reconcileCondition(pool, {
		key: "executor-containment",
		revision: "ordinary-docker-v1",
		kind: "executor.containment-advice",
		scope: { type: "instance", id: installationId },
		subject: "Scripts use ordinary Docker containment",
		severity: "warning",
		active: mode === "runc",
		data: { configuredMode: mode, hostAttestation: "not-verified", instructions: "For additional host isolation, install gVisor/runsc on the Docker host, register the runtime, set PAYLOADBAY_EXECUTOR_RUNTIME=runsc, then recreate the Compose stack. Missing runsc prevents executor startup; there is no fallback." },
	});
}

async function incidentAccess(db: Pool | PoolClient, actor: Actor, incident: { scope_type: ScopeRef["type"]; scope_id: string; kind: string }) {
	const scope: ScopeRef = { type: incident.scope_type, id: incident.scope_id };
	await requirePermission(db, actor, scope, "notifications.read");
	if (incident.kind === "executor.containment-advice") await requirePermission(db, actor, scope, "settings.manage");
}

export async function listNotifications(pool: Pool, actor: Actor, scope: ScopeRef) {
	await requirePermission(pool, actor, scope, "notifications.read");
	const rows = (await pool.query("SELECT n.*,s.read_at,s.dismissed_at FROM payloadbay.notification_incident n LEFT JOIN payloadbay.notification_recipient_state s ON s.incident_id=n.id AND s.user_id=$1 WHERE n.scope_type=$2 AND n.scope_id=$3 AND n.status='active' AND s.dismissed_at IS NULL AND (s.snoozed_until IS NULL OR s.snoozed_until<=clock_timestamp()) ORDER BY n.first_seen DESC,n.id DESC LIMIT 200", [actor.userId, scope.type, scope.id])).rows;
	const held = await actorPermissions(pool, actor, scope);

	return rows
		.filter((row) => row.kind !== "executor.containment-advice" || held.has("settings.manage"))
		.map((row) => ({
			id: row.id,
			kind: row.kind,
			subject: row.subject,
			severity: row.severity,
			status: row.status,
			firstSeen: row.first_seen,
			lastSeen: row.last_seen,
			readAt: row.read_at,
			data: row.redacted_data,
			scope,
		}));
}

/** One account inbox: database filtering happens before the bounded result window. */
export async function listAccountNotifications(pool: Pool, actor: Actor) {
	const rows = (
		await pool.query(
			`SELECT n.*,s.read_at,p.name AS project_name,w.name AS workspace_name,o.name AS organization_name FROM payloadbay.notification_incident n
 LEFT JOIN payloadbay.notification_recipient_state s ON s.incident_id=n.id AND s.user_id=$1
 LEFT JOIN payloadbay.project p ON n.scope_type='project' AND p.id=n.scope_id AND p.archived_at IS NULL
 LEFT JOIN payloadbay.workspace w ON w.id=CASE WHEN n.scope_type='workspace' THEN n.scope_id ELSE p.workspace_id END AND w.archived_at IS NULL
 LEFT JOIN payloadbay.organization o ON o.id=CASE WHEN n.scope_type='organization' THEN n.scope_id ELSE w.organization_id END AND o.archived_at IS NULL
 JOIN payloadbay.installation i ON i.singleton AND i.bootstrap_state='complete'
 WHERE n.status='active' AND s.dismissed_at IS NULL AND (s.snoozed_until IS NULL OR s.snoozed_until<=clock_timestamp())
 AND EXISTS(SELECT 1 FROM payloadbay.admission a WHERE a.user_id=$1 AND a.installation_id=i.id AND a.active)
 AND EXISTS(SELECT 1 FROM payloadbay.grant_record g WHERE g.user_id=$1 AND 'notifications.read'=ANY(g.permissions) AND (
 (n.scope_type='instance' AND n.scope_id=i.id AND g.scope_type='instance' AND g.scope_id=i.id)
 OR (n.scope_type<>'instance' AND o.id IS NOT NULL AND ((g.scope_type='organization' AND g.scope_id=o.id) OR (g.scope_type='workspace' AND g.scope_id=w.id) OR (g.scope_type='project' AND g.scope_id=p.id)))))
 AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM payloadbay.api_token t WHERE t.id=$2 AND t.user_id=$1
 AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp() AND 'notifications.read'=ANY(t.permissions)
 AND (t.personal OR (n.scope_type='instance' AND t.scope_type='instance' AND t.scope_id=i.id)
 OR (n.scope_type<>'instance' AND ((t.scope_type='organization' AND t.scope_id=o.id) OR (t.scope_type='workspace' AND t.scope_id=w.id) OR (t.scope_type='project' AND t.scope_id=p.id))))
 AND (t.workspace_ids IS NULL OR w.id=ANY(t.workspace_ids))
 AND (n.kind<>'executor.containment-advice' OR 'settings.manage'=ANY(t.permissions))))
 ORDER BY n.first_seen DESC,n.id DESC LIMIT 200`,
			[actor.userId, actor.token?.id ?? null],
		)
	).rows;
	const rights = new Map<string, Awaited<ReturnType<typeof actorPermissions>>>();
	const items = [];
	for (const row of rows) {
		const scope: ScopeRef = { type: row.scope_type, id: row.scope_id };
		const key = scope.type + scope.id;
		try {
			if (!rights.has(key)) rights.set(key, await actorPermissions(pool, actor, scope));
			const held = rights.get(key)!;
			if (!held.has("notifications.read") || (row.kind === "executor.containment-advice" && !held.has("settings.manage"))) continue;
		} catch (error) {
			if (error instanceof AppError && ["forbidden", "unauthenticated", "not_found"].includes(error.code)) continue;
			throw error;
		}

		items.push({
			id: row.id,
			kind: row.kind,
			subject: row.subject,
			severity: row.severity,
			status: row.status,
			firstSeen: row.first_seen,
			lastSeen: row.last_seen,
			readAt: row.read_at,
			data: row.redacted_data,
			scope,
			scopeName: scope.type === "instance" ? "Instance operations" : scope.type === "organization" ? row.organization_name : scope.type === "workspace" ? row.workspace_name : row.project_name,
		});
	}

	return items;
}

export async function dismissNotification(pool: Pool, actor: Actor, id: string) {
	return transaction(pool, async (db) => {
		const incident = (await db.query("SELECT scope_type,scope_id,kind FROM payloadbay.notification_incident WHERE id=$1", [id])).rows[0];
		if (!incident) throw new AppError("not_found", 404, "Notification unavailable");
		await incidentAccess(db, actor, incident);
		await db.query("INSERT INTO payloadbay.notification_recipient_state(incident_id,user_id,read_at,dismissed_at) VALUES($1,$2,clock_timestamp(),clock_timestamp()) ON CONFLICT(incident_id,user_id) DO UPDATE SET read_at=clock_timestamp(),dismissed_at=clock_timestamp()", [id, actor.userId]);
		await appendChange(db, {
			scope: { type: incident.scope_type, id: incident.scope_id },
			kind: "notification.changed",
			resourceId: id,
			capability: incident.kind === "executor.containment-advice" ? "settings.manage" : "notifications.read",
		});
	});
}

/** Personal snooze expires in SQL; a new incident generation is never muted. */
export async function snoozeNotification(pool: Pool, actor: Actor, id: string, minutes: number) {
	if (![15, 60, 1440].includes(minutes)) throw new AppError("invalid_input", 400, "Choose 15 minutes, one hour or one day");

	return transaction(pool, async (db) => {
		const incident = (await db.query("SELECT scope_type,scope_id,kind FROM payloadbay.notification_incident WHERE id=$1 AND status='active'", [id])).rows[0];
		if (!incident) throw new AppError("not_found", 404, "Notification unavailable");
		await incidentAccess(db, actor, incident);
		const row = (await db.query("INSERT INTO payloadbay.notification_recipient_state(incident_id,user_id,read_at,snoozed_until) VALUES($1,$2,clock_timestamp(),clock_timestamp()+$3*interval '1 minute') ON CONFLICT(incident_id,user_id) DO UPDATE SET snoozed_until=EXCLUDED.snoozed_until RETURNING snoozed_until", [id, actor.userId, minutes])).rows[0];
		await appendChange(db, {
			scope: { type: incident.scope_type, id: incident.scope_id },
			kind: "notification.changed",
			resourceId: id,
			capability: incident.kind === "executor.containment-advice" ? "settings.manage" : "notifications.read",
		});

		return { snoozedUntil: row.snoozed_until };
	});
}
