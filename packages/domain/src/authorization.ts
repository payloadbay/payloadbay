import { AppError } from "../../contracts/src/errors.ts";
import { permissions, type Permission } from "../../contracts/src/permissions.ts";

export type ScopeRef = { type: "instance" | "workspace" | "project"; id: string };

export type Grant = { scopeType: ScopeRef["type"]; scopeId: string; permissions: readonly Permission[] };

export type Actor = { userId: string; token?: { id: string; scope: ScopeRef; permissions: readonly Permission[] } };

export function effectivePermissions(grants: readonly Grant[], ancestry: readonly ScopeRef[]): Set<Permission> {
	return new Set(grants.filter((grant) => ancestry.some((scope) => scope.type === grant.scopeType && scope.id === grant.scopeId)).flatMap((grant) => [...grant.permissions]));
}

export const rolePermissions = {
	owner: [...permissions],
	admin: permissions.filter((permission) => permission !== "ownership.transfer"),
	operator: ["metadata.read", "payload.read", "events.replay", "endpoints.pause", "code.read", "code.test", "jobs.read", "notifications.read"] as Permission[],
	viewer: ["metadata.read", "notifications.read"] as Permission[],
};

export function assertGrantSubset(actor: ReadonlySet<Permission>, requested: readonly Permission[]) {
	if (requested.some((permission) => !actor.has(permission))) throw new AppError("grant_escalation", 403, "You cannot grant permissions you do not hold");
}
