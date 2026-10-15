import type { PoolClient } from "pg";
import type { ScopeRef } from "./authorization.ts";

export type ChangeKind = "event.recorded" | "event.accepted" | "execution.changed" | "attempt.completed" | "configuration.changed" | "health.changed" | "notification.changed";

export async function appendChange(
	db: PoolClient,
	change: {
		scope: ScopeRef;
		kind: ChangeKind;
		resourceId: string;
		capability?: string;
	},
) {
	return (await db.query("SELECT payloadbay.append_change($1,$2,$3,$4,$5::jsonb) AS cursor", [change.scope.type, change.scope.id, change.kind, change.resourceId, JSON.stringify(change.capability ? { capability: change.capability } : {})])).rows[0].cursor as string;
}
