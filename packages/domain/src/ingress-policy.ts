import type { Pool, PoolClient } from "pg";
import type { Actor, ScopeRef } from "./authorization.ts";
import { transaction } from "./db.ts";
import { endpointFor } from "./endpoints.ts";
import { requirePermission, dataAncestry, actorPermissions } from "./membership.ts";
import { appendChange } from "./changes.ts";
import { encryptPrivate, decryptPrivate } from "./private-crypto.ts";
import { ingressPolicy, ingressPolicyUpdate, protectionScope, protectionTestInput, evaluateFilters, matchesCondition, type ProtectionScope, type ProtectionRequest, type IngressRateRule } from "../../contracts/src/ingress-policy.ts";
import { ingressRateState, reserveIngressRate, type IngressRateState } from "../../contracts/src/ingress-rate.ts";
import { AppError } from "../../contracts/src/errors.ts";

type PolicyRow = {
	id: string;
	organization_id: string | null;
	workspace_id: string | null;
	project_id: string | null;
	endpoint_id: string | null;
	version: number;
	encrypted_policy: Buffer;
};

const ownerColumns = {
	organization: "organization_id",
	workspace: "workspace_id",
	project: "project_id",
	endpoint: "endpoint_id",
} as const;

function ownerOf(row: PolicyRow): ProtectionScope {
	const type = (Object.keys(ownerColumns) as ProtectionScope["type"][]).find((type) => row[ownerColumns[type]]);
	if (!type) throw Error("invalid_protection_owner");

	return { type, id: row[ownerColumns[type]]! };
}

async function authorizedScope(db: Pool | PoolClient, actor: Actor, input: ProtectionScope) {
	const scope = protectionScope.parse(input);
	let permissionScope: ScopeRef;
	if (scope.type === "endpoint") permissionScope = { type: "project", id: (await endpointFor(db, actor, scope.id, "endpoints.configure")).endpoint.project_id };
	else {
		permissionScope = { type: scope.type, id: scope.id };
		await requirePermission(db, actor, permissionScope, "endpoints.configure");
	}

	const ancestry: ProtectionScope[] = (await dataAncestry(db, permissionScope)).filter((item) => item.type !== "instance") as ProtectionScope[];
	if (scope.type === "endpoint") ancestry.push(scope);

	return { scope, ancestry, permissionScope };
}

async function loadPolicies(db: Pool | PoolClient, ancestry: ProtectionScope[], lock = false): Promise<PolicyRow[]> {
	if (!ancestry.length) return [];

	return (
		await db.query(
			`SELECT * FROM payloadbay.ingress_policy WHERE organization_id=$1 OR workspace_id=$2 OR project_id=$3 OR endpoint_id=$4 ORDER BY CASE WHEN organization_id IS NOT NULL THEN 0 WHEN workspace_id IS NOT NULL THEN 1 WHEN project_id IS NOT NULL THEN 2 ELSE 3 END,id${lock ? " FOR SHARE" : ""}`,
			["organization", "workspace", "project", "endpoint"].map((type) => ancestry.find((item) => item.type === type)?.id ?? null),
		)
	).rows;
}

async function resourceName(db: Pool | PoolClient, scope: ProtectionScope): Promise<string> {
	return (await db.query(`SELECT name FROM payloadbay.${scope.type} WHERE id=$1`, [scope.id])).rows[0]?.name ?? scope.type;
}

export async function getIngressPolicy(pool: Pool, actor: Actor, input: ProtectionScope, encryptionKey: string) {
	const { scope, ancestry } = await authorizedScope(pool, actor, input);
	const rows = await loadPolicies(pool, ancestry);
	const own = rows.find((row) => row[ownerColumns[scope.type]] === scope.id);
	const inherited = [];
	for (const row of rows.filter((row) => row !== own)) {
		const parent = ownerOf(row);
		const policy = ingressPolicy.parse(decryptPrivate(row.encrypted_policy, encryptionKey));
		const editable = (await actorPermissions(pool, actor, parent as ScopeRef)).has("endpoints.configure");
		inherited.push({
			scope: parent,
			name: await resourceName(pool, parent),
			version: row.version,
			enabled: policy.enabled,
			defaultAction: policy.defaultAction,
			rules: policy.rules.map(({ id, name, enabled, action }) => ({
				id,
				name,
				enabled,
				action,
			})),
			rateLimits: policy.rateLimits.map(({ id, name, enabled }) => ({ id, name, enabled })),
			editable,
		});
	}

	return {
		scope,
		name: await resourceName(pool, scope),
		version: own?.version ?? 0,
		policy: own ? ingressPolicy.parse(decryptPrivate(own.encrypted_policy, encryptionKey)) : ingressPolicy.parse({}),
		inherited,
	};
}

export async function saveIngressPolicy(pool: Pool, actor: Actor, input: ProtectionScope, value: unknown, encryptionKey: string) {
	const data = ingressPolicyUpdate.parse(value);
	await transaction(pool, async (db) => {
		const { scope, permissionScope } = await authorizedScope(db, actor, input);
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["protection-config:" + scope.type + ":" + scope.id]);
		const column = ownerColumns[scope.type];
		const existing = (await db.query(`SELECT id,version FROM payloadbay.ingress_policy WHERE ${column}=$1 FOR UPDATE`, [scope.id])).rows[0];
		if ((existing?.version ?? 0) !== data.expectedVersion) throw new AppError("version_conflict", 409, "Request protection changed; reload before saving");
		const version = data.expectedVersion + 1;
		const row = (await db.query(`INSERT INTO payloadbay.ingress_policy(${column},version,encrypted_policy) VALUES($1,$2,$3) ON CONFLICT(${column}) DO UPDATE SET version=EXCLUDED.version,encrypted_policy=EXCLUDED.encrypted_policy RETURNING id`, [scope.id, version, encryptPrivate(data.policy, encryptionKey)])).rows[0];
		await db.query("DELETE FROM payloadbay.ingress_rate_bucket WHERE policy_id=$1", [row.id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'request.protection_changed',$4,$5)", [
			actor.userId,
			permissionScope.type,
			permissionScope.id,
			scope.id,
			JSON.stringify({
				enabled: data.policy.enabled,
				ruleCount: data.policy.rules.length,
				rateLimitCount: data.policy.rateLimits.length,
				version,
			}),
		]);
		await appendChange(db, { scope: permissionScope, kind: "configuration.changed", resourceId: scope.id });
	});

	return getIngressPolicy(pool, actor, input, encryptionKey);
}

export async function testIngressPolicy(pool: Pool, actor: Actor, input: ProtectionScope, value: unknown, encryptionKey: string) {
	const { policy, request } = protectionTestInput.parse(value);
	const { scope, ancestry } = await authorizedScope(pool, actor, input);
	const rows = await loadPolicies(pool, ancestry.slice(0, -1));
	const policies = [...rows.map((row) => ({ scope: ownerOf(row), policy: ingressPolicy.parse(decryptPrivate(row.encrypted_policy, encryptionKey)) })), { scope, policy }];
	const results = [];
	for (const item of policies) {
		const result = evaluateFilters(item.policy, request);
		results.push({
			scope: item.scope,
			...result,
			rateRules: result.action === "block" ? [] : item.policy.rateLimits.filter((rule) => rule.enabled && (!rule.condition || matchesCondition(rule.condition, request))).map(({ id, name }) => ({ id, name })),
		});
		if (result.action === "block") break;
	}

	return { blocked: results.some((result) => result.action === "block"), results };
}

export type ProtectionBlock = { status: 403 | 429; retryAfter?: number; reason: { kind: "filter" | "rate_limit"; scope: ProtectionScope; rule: { id: string; name: string } | null } };

/** All scopes admit atomically; child exceptions never skip parent filters or quotas. */
export async function checkIngressPolicy(pool: Pool, endpointId: string, request: ProtectionRequest, encryptionKey: string): Promise<ProtectionBlock | null> {
	return transaction(pool, async (db) => {
		const endpoint = (await db.query("SELECT e.project_id,p.workspace_id,w.organization_id FROM payloadbay.endpoint e JOIN payloadbay.project p ON p.id=e.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id WHERE e.id=$1", [endpointId])).rows[0];
		if (!endpoint) throw new AppError("ingress_unavailable", 404, "Ingress route unavailable");
		const rows = await loadPolicies(
			db,
			[
				{ type: "organization", id: endpoint.organization_id },
				{ type: "workspace", id: endpoint.workspace_id },
				{ type: "project", id: endpoint.project_id },
				{ type: "endpoint", id: endpointId },
			],
			true,
		);
		const reservations: {
			row: PolicyRow;
			scope: ProtectionScope;
			rule: IngressRateRule;
			key: string;
			prior?: IngressRateState | null;
			next?: IngressRateState;
		}[] = [];
		for (const row of rows) {
			const scope = ownerOf(row);
			const policy = ingressPolicy.parse(decryptPrivate(row.encrypted_policy, encryptionKey));
			const result = evaluateFilters(policy, request);
			if (result.action === "block") return { status: 403, reason: { kind: "filter", scope, rule: result.rule } };
			for (const rule of policy.rateLimits)
				if (rule.enabled && (!rule.condition || matchesCondition(rule.condition, request)))
					reservations.push({
						row,
						scope,
						rule,
						key: rule.groupBy === "route" ? endpointId : "shared",
					});
		}

		if (!reservations.length) return null;
		// Lock a deterministic order even when users reorder rules in another scope.
		for (const item of [...reservations].sort((a, b) => (a.row.id + a.rule.id + a.key).localeCompare(b.row.id + b.rule.id + b.key))) {
			await db.query("INSERT INTO payloadbay.ingress_rate_bucket(policy_id,rule_id,counter_key,endpoint_id,policy_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [item.row.id, item.rule.id, item.key, item.rule.groupBy === "route" ? endpointId : null, item.row.version]);
			const stored = (await db.query("SELECT policy_version,state FROM payloadbay.ingress_rate_bucket WHERE policy_id=$1 AND rule_id=$2 AND counter_key=$3 FOR UPDATE", [item.row.id, item.rule.id, item.key])).rows[0];
			item.prior = stored.policy_version === item.row.version && stored.state !== null ? ingressRateState.parse(stored.state) : null;
		}

		const now = Number((await db.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now")).rows[0].now);
		let blocked: ProtectionBlock | null = null;
		for (const item of reservations) {
			const reservation = reserveIngressRate(item.rule, item.prior ?? null, now);
			item.next = reservation.state;
			if (!reservation.allowed) {
				if (!blocked) blocked = { status: 429, retryAfter: reservation.retryAfter, reason: { kind: "rate_limit", scope: item.scope, rule: { id: item.rule.id, name: item.rule.name } } };
				else blocked.retryAfter = Math.max(blocked.retryAfter ?? 1, reservation.retryAfter);
			}
		}

		if (blocked) return blocked;
		await db.query(`UPDATE payloadbay.ingress_rate_bucket b SET policy_version=r.version,state=r.state FROM jsonb_to_recordset($1::jsonb) AS r(policy_id uuid,rule_id uuid,counter_key text,version integer,state jsonb) WHERE b.policy_id=r.policy_id AND b.rule_id=r.rule_id AND b.counter_key=r.counter_key`, [
			JSON.stringify(
				reservations.map((item) => ({
					policy_id: item.row.id,
					rule_id: item.rule.id,
					counter_key: item.key,
					version: item.row.version,
					state: item.next,
				})),
			),
		]);

		return null;
	});
}
