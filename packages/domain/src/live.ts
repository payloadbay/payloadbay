import type { Pool } from "pg";
import type { Actor, ScopeRef } from "./authorization.ts";
import { requirePermission, actorPermissions, scopeAncestry } from "./membership.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { Permission } from "../../contracts/src/permissions.ts";

export type LiveScope = ScopeRef | { type: "accessible"; id: string };

export async function readChanges(pool: Pool, actor: Actor, input: { scope: LiveScope; after: string; limit?: number }) {
	if (input.scope.type === "accessible") {
		const admitted = await pool.query("SELECT 1 FROM payloadbay.admission WHERE installation_id=$1 AND user_id=$2 AND active", [input.scope.id, actor.userId]);
		if (!admitted.rowCount) throw new AppError("forbidden", 403, "Instance access required");
	} else await requirePermission(pool, actor, input.scope, "metadata.read");
	if (!/^\d{1,20}$/.test(input.after) || BigInt(input.after) > BigInt("9223372036854775807")) throw new AppError("invalid_cursor", 400, "Live cursor is invalid");
	const limit = input.limit ?? 200;
	if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new AppError("invalid_pagination", 400, "Live backfill limit is invalid");
	const retained = (await pool.query("SELECT min(cursor) FILTER(WHERE created_at>clock_timestamp()-interval '24 hours')::text AS first,max(cursor)::text AS latest FROM payloadbay.change_record")).rows[0];
	if (retained.latest && BigInt(input.after) > BigInt(retained.latest)) throw new AppError("invalid_cursor", 400, "Live cursor is invalid");
	if (input.after !== "0" && retained.latest && (!retained.first || BigInt(input.after) < BigInt(retained.first)))
		return {
			items: [],
			cursor: retained.latest as string,
			hasMore: false,
			resyncRequired: true,
		};
	const scopeFilter =
		input.scope.type === "accessible"
			? "$3::uuid IS NOT NULL"
			: input.scope.type === "organization"
				? "((c.scope_type='organization' AND c.scope_id=$3::uuid) OR(c.scope_type='workspace' AND EXISTS(SELECT 1 FROM payloadbay.workspace w WHERE w.id=c.scope_id AND w.organization_id=$3::uuid)) OR(c.scope_type='project' AND EXISTS(SELECT 1 FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id=c.scope_id AND w.organization_id=$3::uuid)))"
				: input.scope.type === "project"
					? "c.scope_type='project' AND c.scope_id=$3::uuid"
					: input.scope.type === "workspace"
						? "((c.scope_type='workspace' AND c.scope_id=$3::uuid) OR(c.scope_type='project' AND EXISTS(SELECT 1 FROM payloadbay.project p WHERE p.id=c.scope_id AND p.workspace_id=$3::uuid)))"
						: "((c.scope_type='instance' AND c.scope_id=$3::uuid) OR(c.scope_type='organization' AND EXISTS(SELECT 1 FROM payloadbay.organization o WHERE o.id=c.scope_id AND o.installation_id=$3::uuid)) OR(c.scope_type='workspace' AND EXISTS(SELECT 1 FROM payloadbay.workspace w WHERE w.id=c.scope_id AND w.installation_id=$3::uuid)) OR(c.scope_type='project' AND EXISTS(SELECT 1 FROM payloadbay.project p JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE p.id=c.scope_id AND w.installation_id=$3::uuid)))";
	const rows = (await pool.query(`SELECT c.cursor::text,c.scope_type,c.scope_id,c.kind,c.resource_id,c.metadata FROM payloadbay.change_record c WHERE c.cursor>$1::bigint AND c.created_at>clock_timestamp()-interval '24 hours' AND (${scopeFilter}) ORDER BY c.cursor LIMIT $2`, [input.after, limit, input.scope.id])).rows;
	const items = [];
	let last = input.after;
	const permissions = new Map<string, Set<Permission>>();
	for (const row of rows) {
		last = row.cursor;
		const scope: ScopeRef = { type: row.scope_type, id: row.scope_id };
		let ancestry: ScopeRef[];
		try {
			ancestry = await scopeAncestry(pool, scope);
		} catch {
			continue;
		}

		if (input.scope.type === "accessible" ? ancestry[0].id !== input.scope.id : !ancestry.some((parent) => parent.type === input.scope.type && parent.id === input.scope.id)) continue;
		const key = scope.type + ":" + scope.id;
		let held = permissions.get(key);
		if (!held) {
			try {
				held = await actorPermissions(pool, actor, scope);
			} catch {
				continue;
			}

			permissions.set(key, held);
		}

		const capability = (row.metadata.capability ?? (row.kind === "notification.changed" ? "notifications.read" : "metadata.read")) as Permission;
		if (!held.has(capability)) continue;
		items.push({
			cursor: row.cursor,
			kind: row.kind,
			resourceId: row.resource_id,
			scope,
		});
	}

	return {
		items,
		cursor: last,
		hasMore: rows.length === limit,
		resyncRequired: false,
	};
}

const subscribers = new Map<string, number>();
let subscriberCount = 0;

/** HTTP polling is internal: browsers receive pushed SSE frames, never a polling API. */
export async function streamChanges(pool: Pool, actor: Actor, scope: LiveScope, after: string, signal: AbortSignal, options: { pollMs?: number; heartbeatMs?: number } = {}) {
	const initial = await readChanges(pool, actor, { scope, after });
	if (signal.aborted) throw new AppError("request_aborted", 499, "Request disconnected");
	const key = actor.userId;
	if (subscriberCount >= 256 || (subscribers.get(key) ?? 0) >= 8) throw new AppError("live_capacity", 429, "Too many live connections");
	subscribers.set(key, (subscribers.get(key) ?? 0) + 1);
	subscriberCount++;
	let cursor = initial.cursor;
	let stopped = false;
	let pending = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;

	let close = () => {};

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>(
		{
			start(controller) {
				close = () => {
					if (stopped) return;
					stopped = true;
					if (timer) clearInterval(timer);
					if (heartbeat) clearInterval(heartbeat);
					signal.removeEventListener("abort", close);
					subscriberCount--;
					const left = (subscribers.get(key) ?? 1) - 1;
					if (left) subscribers.set(key, left);
					else subscribers.delete(key);
					try {
						controller.close();
					} catch {}
				};

				const emit = (value: string) => {
					if (stopped) return;
					if ((controller.desiredSize ?? 0) <= 0) {
						close();

						return;
					}

					controller.enqueue(encoder.encode(value));
				};

				const frames = (items: typeof initial.items) => {
					if (items.length) emit(items.map((change) => `id: ${change.cursor}\nevent: ${change.kind}\ndata: ${JSON.stringify(change)}\n\n`).join(""));
				};

				const tick = async () => {
					if (pending || stopped) return;
					pending = true;
					try {
						const changes = await readChanges(pool, actor, { scope, after: cursor });
						cursor = changes.cursor;
						if (changes.resyncRequired) emit(`id: ${cursor}\nevent: resync-required\ndata: {}\n\n`);
						frames(changes.items);
					} catch {
						close();
					} finally {
						pending = false;
					}
				};

				emit(": connected\n\n");
				if (initial.resyncRequired) emit(`id: ${cursor}\nevent: resync-required\ndata: {}\n\n`);
				frames(initial.items);
				timer = setInterval(() => void tick(), options.pollMs ?? 1000);
				heartbeat = setInterval(() => emit(": heartbeat\n\n"), options.heartbeatMs ?? 15000);
				signal.addEventListener("abort", close, { once: true });
				if (signal.aborted) close();
			},
			cancel() {
				close();
			},
		},
		{ highWaterMark: 262144, size: (chunk) => chunk?.byteLength ?? 0 },
	);

	return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
