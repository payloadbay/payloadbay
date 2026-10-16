import type { Pool, PoolClient } from "pg";
import type { z } from "zod";
import type { Actor, ScopeRef } from "./authorization.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { notificationChannelInput, notificationChannelUpdate } from "../../contracts/src/notification-channels.ts";
import { requirePermission, actorPermissions } from "./membership.ts";
import { transaction } from "./db.ts";
import { appendChange } from "./changes.ts";
import { pinSourceImports, resolveSharedModules } from "./shared-code.ts";
import { secretForUse } from "./secrets.ts";

export { builtinEmailSource, webhookChannelSource } from "../../contracts/src/notification-templates.ts";
import { builtinEmailSource } from "../../contracts/src/notification-templates.ts";

export type ChannelSummary = {
	id: string;
	name: string;
	kind: "email" | "webhook";
	builtin: boolean;
	enabled: boolean;
	version: number;
	activeRevisionId: string | null;
	activeVersion: number;
	originKey: string | null;
};

export async function notificationInstance(db: Pool | PoolClient): Promise<ScopeRef> {
	const row = (await db.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
	if (!row) throw new AppError("installation_unavailable", 409, "Complete instance setup first");

	return { type: "instance", id: row.id };
}

async function channelAdministration(db: Pool | PoolClient, actor: Actor, write = false) {
	const scope = await notificationInstance(db);
	await requirePermission(db, actor, scope, "settings.manage");
	await requirePermission(db, actor, scope, "code.read");
	if (write) {
		await requirePermission(db, actor, scope, "code.edit");
		await requirePermission(db, actor, scope, "code.publish");
	}

	return scope;
}

function builtin(): ChannelSummary {
	return {
		id: "smtp",
		name: "Email",
		kind: "email",
		builtin: true,
		enabled: true,
		version: 1,
		activeRevisionId: null,
		activeVersion: 1,
		originKey: null,
	};
}

type ChannelRow = {
	id: string;
	name: string;
	kind: "email" | "webhook";
	enabled: boolean;
	version: number;
	active_revision_id: string | null;
	active_version?: number;
	origin_key: string | null;
};

function summary(row: ChannelRow): ChannelSummary {
	return {
		id: row.id,
		name: row.name,
		kind: row.kind,
		builtin: false,
		enabled: row.enabled,
		version: row.version,
		activeRevisionId: row.active_revision_id,
		activeVersion: row.active_version ?? 1,
		originKey: row.origin_key,
	};
}

export async function listNotificationChannels(pool: Pool, actor: Actor) {
	const scope = await notificationInstance(pool);
	const rights = await actorPermissions(pool, actor, scope);
	const admin = rights.has("settings.manage");
	const rows = (await pool.query("SELECT c.*,r.version AS active_version FROM payloadbay.notification_channel c LEFT JOIN payloadbay.notification_channel_revision r ON r.id=c.active_revision_id WHERE c.installation_id=$1 AND ($2 OR c.enabled OR EXISTS(SELECT 1 FROM payloadbay.notification_subscription subscription WHERE subscription.channel=c.id::text AND subscription.user_id=$3 AND subscription.enabled)) ORDER BY c.created_at,c.id LIMIT 100", [scope.id, admin, actor.userId])).rows;

	return [builtin(), ...rows.map(summary)];
}

export async function getNotificationChannel(pool: Pool, actor: Actor, key: string, revisionId?: string) {
	const scope = await channelAdministration(pool, actor);
	if (key === "smtp")
		return {
			...builtin(),
			source: builtinEmailSource,
			selectedRevisionId: null,
			sharedBindings: {} as Record<string, string>,
			secretBindings: {} as Record<string, string>,
			revisions: [] as { id: string; version: number; createdAt: string }[],
		};
	const row = (await pool.query("SELECT c.*,r.version AS active_version FROM payloadbay.notification_channel c LEFT JOIN payloadbay.notification_channel_revision r ON r.id=c.active_revision_id WHERE c.id=$1 AND c.installation_id=$2", [key, scope.id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Notification channel unavailable");
	const revision = (await pool.query("SELECT * FROM payloadbay.notification_channel_revision WHERE channel_id=$1 AND id=$2", [key, revisionId ?? row.active_revision_id])).rows[0];
	if (!revision) throw new AppError("not_found", 404, "Channel version unavailable");
	const revisions = (await pool.query("SELECT id,version,created_at FROM payloadbay.notification_channel_revision WHERE channel_id=$1 ORDER BY version DESC LIMIT 200", [key])).rows;

	return {
		...summary(row),
		source: revision.source as string,
		selectedRevisionId: revision.id as string,
		sharedBindings: revision.shared_bindings as Record<string, string>,
		secretBindings: revision.secret_bindings as Record<string, string>,
		revisions: revisions.map((item) => ({ id: item.id as string, version: item.version as number, createdAt: item.created_at.toISOString() as string })),
	};
}

export async function publishNotificationChannel(pool: Pool, actor: Actor, input: Omit<z.input<typeof notificationChannelInput>, "compile"> & { compile: typeof compile }) {
	const { compile: compiler, ...raw } = input;
	const parsed = notificationChannelInput.safeParse(raw);
	if (!parsed.success) throw new AppError("invalid_channel", 400, "Provide a channel name, kind and valid script");
	const data = parsed.data;
	const scope = await channelAdministration(pool, actor, true);
	if (data.originKey) await getNotificationChannel(pool, actor, data.originKey);
	const sharedBindings = await pinSourceImports(pool, actor, scope, data.source, data.sharedBindings);
	const sharedModules = await resolveSharedModules(pool, actor, scope, sharedBindings);
	const compiled = await compiler({
		stage: "notification",
		body: data.source,
		sourceId: "notification-channel",
		sharedModules,
	});

	return transaction(pool, async (db) => {
		await channelAdministration(db, actor, true);
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification-channels:" + scope.id]);
		for (const id of Object.values(data.secretBindings)) {
			const secret = await secretForUse(db, actor, id);
			if (secret.scope_type !== "instance" || secret.scope_id !== scope.id) throw new AppError("invalid_secret_binding", 400, "Instance channels use instance-owned secret versions");
		}

		let channel;
		if (data.id) {
			channel = (await db.query("SELECT * FROM payloadbay.notification_channel WHERE id=$1 AND installation_id=$2 FOR UPDATE", [data.id, scope.id])).rows[0];
			if (!channel) throw new AppError("not_found", 404, "Notification channel unavailable");
			if (channel.version !== data.expectedVersion) throw new AppError("version_conflict", 409, "Channel changed; reload before publishing");
			if (channel.kind !== data.kind) throw new AppError("channel_kind_changed", 409, "Create a new channel to change its transport kind");
		} else {
			if (Number((await db.query("SELECT count(*) FROM payloadbay.notification_channel WHERE installation_id=$1", [scope.id])).rows[0].count) >= 100) throw new AppError("channel_limit", 409, "At most 100 instance channels are supported");
			channel = (await db.query("INSERT INTO payloadbay.notification_channel(installation_id,name,kind,origin_key) VALUES($1,$2,$3,$4) RETURNING *", [scope.id, data.name, data.kind, data.originKey ?? null])).rows[0];
		}

		const version = Number((await db.query("SELECT COALESCE(max(version),0)+1 AS next FROM payloadbay.notification_channel_revision WHERE channel_id=$1", [channel.id])).rows[0].next);
		const revision = (await db.query("INSERT INTO payloadbay.notification_channel_revision(channel_id,version,source,compiled,shared_bindings,secret_bindings,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [channel.id, version, data.source, JSON.stringify(compiled), JSON.stringify(sharedBindings), JSON.stringify(data.secretBindings), actor.userId])).rows[0];
		const updated = (await db.query("UPDATE payloadbay.notification_channel SET name=$2,active_revision_id=$3,version=version+$4 WHERE id=$1 RETURNING *", [channel.id, data.name, revision.id, data.id ? 1 : 0])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'instance',$2,'notification.channel_published',$3,$4)", [actor.userId, scope.id, channel.id, JSON.stringify({ version, originKey: channel.origin_key })]);
		await appendChange(db, {
			scope,
			kind: "configuration.changed",
			resourceId: channel.id,
			capability: "settings.manage",
		});

		return { ...summary({ ...updated, active_version: version }), activeRevisionId: revision.id as string };
	});
}

export async function updateNotificationChannel(pool: Pool, actor: Actor, id: string, input: z.input<typeof notificationChannelUpdate>) {
	const data = notificationChannelUpdate.parse(input);

	return transaction(pool, async (db) => {
		const scope = await channelAdministration(db, actor, true);
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["notification-channels:" + scope.id]);
		const row = (await db.query("SELECT * FROM payloadbay.notification_channel WHERE id=$1 AND installation_id=$2 FOR UPDATE", [id, scope.id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Channel unavailable");
		if (row.version !== data.expectedVersion) throw new AppError("version_conflict", 409, "Channel changed; reload before saving");
		if (data.enabled === false && (await db.query("SELECT 1 FROM payloadbay.email_settings WHERE channel_id=$1", [id])).rowCount) throw new AppError("channel_in_use", 409, "Choose another transactional email channel before disabling this one");
		if (data.activeRevisionId && !(await db.query("SELECT 1 FROM payloadbay.notification_channel_revision WHERE id=$1 AND channel_id=$2", [data.activeRevisionId, id])).rowCount) throw new AppError("not_found", 404, "Channel version unavailable");
		await db.query("UPDATE payloadbay.notification_channel SET enabled=COALESCE($2,enabled),active_revision_id=COALESCE($3,active_revision_id),version=version+1 WHERE id=$1", [id, data.enabled ?? null, data.activeRevisionId ?? null]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'instance',$2,'notification.channel_configured',$3,$4)", [actor.userId, scope.id, id, JSON.stringify(data)]);
		await appendChange(db, {
			scope,
			kind: "configuration.changed",
			resourceId: id,
			capability: "settings.manage",
		});

		return { updated: true };
	});
}
