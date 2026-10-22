import test from "node:test";
import assert from "node:assert/strict";
import { authFixture } from "../helpers/auth-fixtures.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { getIngressPolicy, saveIngressPolicy, checkIngressPolicy, testIngressPolicy } from "../../packages/domain/src/ingress-policy.ts";
import { ingressPolicy, ingressRateRule, requestCondition, newCondition, newConditionGroup, conditionNodes, matchesCondition, formatCondition, evaluateFilters, filterTemplates, operatorsFor, protectionTestInput, type RequestCondition, type ProtectionRequest } from "../../packages/contracts/src/ingress-policy.ts";
import { ingressRateState, reserveIngressRate } from "../../packages/contracts/src/ingress-rate.ts";

const request: ProtectionRequest = {
	method: "POST",
	path: "/hooks/purchase",
	headers: { "content-type": "application/json", "x-event": "Purchase.Created" },
	bodySize: 128,
};

const leaf = (input: Partial<Extract<RequestCondition, { kind: "condition" }>> = {}): RequestCondition => ({
	...newCondition(),
	kind: "condition",
	field: "header",
	header: "x-event",
	operator: "equals",
	value: "Purchase.Created",
	ignoreCase: false,
	...input,
});

const group = (join: "all" | "any", children: RequestCondition[], negate = false): RequestCondition => ({
	id: crypto.randomUUID(),
	kind: "group",
	join,
	negate,
	children,
});

const rate = (algorithm: "fixed" | "rolling" | "token_bucket", extra: Record<string, unknown> = {}) =>
	ingressRateRule.parse({
		id: crypto.randomUUID(),
		name: "Quota",
		enabled: true,
		algorithm,
		requests: 2,
		windowSeconds: 60,
		burst: 2,
		...extra,
	});

const filter = (condition: RequestCondition, action: "block" | "skip" = "block", name = "Filter") => ({
	id: crypto.randomUUID(),
	name,
	enabled: true,
	action,
	condition,
});

test("condition operators, groups and preview agree on request semantics", () => {
	for (const [operator, value, expected] of [
		["equals", "Purchase.Created", true],
		["not_equals", "Purchase.Created", false],
		["contains", "created", false],
		["not_contains", "Other", true],
		["starts_with", "Purchase.", true],
		["not_starts_with", "Purchase.", false],
		["ends_with", ".Created", true],
		["not_ends_with", ".Created", false],
		["wildcard", "Purchase.*", true],
		["not_wildcard", "*.Deleted", true],
		["regex", "Created$", true],
		["not_regex", "^Created", true],
		["in", ["Purchase.Created", "Other"], true],
		["not_in", ["Purchase.Created"], false],
		["present", undefined, true],
		["missing", undefined, false],
	] as const) {
		const condition = requestCondition.parse(leaf({ operator, value: typeof value === "string" || value === undefined ? value : [...value] }));
		assert.equal(matchesCondition(condition, request), expected, operator);
		assert.equal(matchesCondition(condition, { ...request, headers: {} }), operator.startsWith("not_") || operator === "missing", operator + " on missing header");
		assert.ok(formatCondition(condition).includes("headers["));
	}

	for (const operator of ["equals", "not_equals", "gt", "gte", "lt", "lte"] as const) {
		assert.equal(
			matchesCondition(
				requestCondition.parse(
					leaf({
						field: "body_size",
						header: undefined,
						operator,
						value: 128,
					}),
				),
				request,
			),
			["equals", "gte", "lte"].includes(operator),
		);
	}

	for (const field of ["method", "path", "content_type"] as const) {
		assert.equal(matchesCondition(requestCondition.parse(leaf({ field, header: undefined, value: field === "method" ? "POST" : field === "path" ? "/hooks/purchase" : "application/json" })), request), true);
	}

	assert.equal(matchesCondition(requestCondition.parse(leaf({ value: "purchase.created", ignoreCase: true })), request), true);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "in", value: ["PURCHASE.CREATED"], ignoreCase: true })), request), true);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "present", value: undefined })), { ...request, headers: { "x-event": "" } }), true);
	const nested = group("all", [leaf({ operator: "present" }), group("any", [leaf({ value: "Other" }), leaf({ operator: "regex", value: "^Purchase\\." })])]);
	assert.equal(matchesCondition(requestCondition.parse(nested), request), true);
	assert.equal(matchesCondition(group("all", [nested], true), request), false);
	assert.match(formatCondition(group("any", [nested], true)), /^NOT \(/);
	assert.ok(conditionNodes(nested).length > 3);
	assert.ok(operatorsFor("body_size").includes("gte"));
	assert.ok(!operatorsFor("body_size").includes("regex"));
	assert.ok(!operatorsFor("method").includes("present"));
	assert.equal(evaluateFilters(ingressPolicy.parse({ enabled: true, rules: [filter(leaf()), filter(leaf(), "skip")] }), request).action, "block");
	assert.equal(evaluateFilters(ingressPolicy.parse({ enabled: true, rules: [filter(leaf(), "skip")] }), request).action, "skip");
	assert.equal(evaluateFilters(ingressPolicy.parse({ enabled: true, rules: [{ ...filter(leaf()), enabled: false }] }), request).action, "continue");
});

test("condition validation rejects unsafe patterns, invalid shapes and excessive nesting", () => {
	for (const value of ["(?=lookahead)", "(a)\\1", "[", "a".repeat(257), "a{1000}a{1000}a{1000}a{1000}a{1000}"]) assert.equal(requestCondition.safeParse(leaf({ operator: "regex", value })).success, false, value);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "regex", value: "(a+)+$" })), { ...request, headers: { "x-event": "a".repeat(8192) + "!" } }), false);
	for (const value of ["a**", "a\\x"]) assert.equal(requestCondition.safeParse(leaf({ operator: "wildcard", value })).success, false);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "wildcard", value: "a\\*b" })), { ...request, headers: { "x-event": "a*b" } }), true);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "wildcard", value: "a\\\\b" })), { ...request, headers: { "x-event": "a\\b" } }), true);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "wildcard", value: "purchase.*", ignoreCase: true })), request), true);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "wildcard", value: "Created" })), request), false);
	assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "regex", value: "purchase", ignoreCase: true })), request), true);
	for (let index = 0; index < 130; index++) assert.equal(matchesCondition(requestCondition.parse(leaf({ operator: "regex", value: "^event" + index + "$" })), request), false);
	let nested = leaf();
	for (let depth = 0; depth < 6; depth++) nested = group("all", [nested]);
	assert.equal(requestCondition.safeParse(nested).success, false);
	const repeated = leaf();
	assert.equal(requestCondition.safeParse(group("all", [repeated, repeated])).success, false);
	const wide = group(
		"all",
		Array.from({ length: 8 }, () =>
			group(
				"all",
				Array.from({ length: 8 }, () => leaf()),
			),
		),
	);
	assert.equal(requestCondition.safeParse(wide).success, false);
	for (const condition of [leaf({ header: "invalid\nheader" }), leaf({ header: undefined }), leaf({ field: "body_size", value: "128" }), leaf({ operator: "in", value: "single" }), leaf({ field: "method", operator: "present" }), leaf({ operator: "regex", value: "" })]) assert.equal(requestCondition.safeParse(condition).success, false);
	const oversizedRules = Array.from({ length: 12 }, () =>
		filter(
			group(
				"all",
				Array.from({ length: 8 }, () =>
					group(
						"all",
						Array.from({ length: 6 }, () => leaf()),
					),
				),
			),
		),
	);
	assert.equal(ingressPolicy.safeParse({ rules: oversizedRules }).success, false);
	assert.equal(protectionTestInput.safeParse({ policy: {}, request: { ...request, path: "/?query=unsupported" } }).success, false);
	assert.equal(newConditionGroup().join, "all");
	for (const template of filterTemplates) {
		const rule = template.create();
		assert.ok(ingressPolicy.safeParse({ enabled: true, rules: [rule] }).success);
		assert.equal(evaluateFilters(ingressPolicy.parse({ enabled: true, rules: [rule] }), { ...request, headers: template.id === "browser-navigation" ? { "sec-fetch-dest": "document" } : { "user-agent": "Chrome/123" } }).action, "block");
	}
});

test("token, strict rolling and fixed quotas handle refill, boundaries and backward clock movement", () => {
	for (const algorithm of ["token_bucket", "rolling", "fixed"] as const) {
		const config = rate(algorithm);
		const first = reserveIngressRate(config, null, 1000);
		const second = reserveIngressRate(config, first.state, 2000);
		const denied = reserveIngressRate(config, second.state, 3000);
		assert.equal(first.allowed, true);
		assert.equal(second.allowed, true);
		assert.equal(denied.allowed, false);
		assert.ok(denied.retryAfter > 0);
		assert.ok(ingressRateState.safeParse(denied.state).success);
		assert.equal(reserveIngressRate(config, second.state, 0).allowed, false);
		assert.equal(reserveIngressRate(config, second.state, 62000).allowed, true);
	}

	const bucket = rate("token_bucket", { requests: 60, burst: 2 });
	const empty = reserveIngressRate(bucket, reserveIngressRate(bucket, null, 0).state, 0).state;
	assert.equal(reserveIngressRate(bucket, empty, 500).allowed, false);
	assert.equal(reserveIngressRate(bucket, empty, 1000).allowed, true);
	const rolling = rate("rolling");
	const one = reserveIngressRate(rolling, null, 0).state;
	const two = reserveIngressRate(rolling, one, 59000).state;
	assert.equal(reserveIngressRate(rolling, two, 60000).allowed, true);
	const next = reserveIngressRate(rolling, two, 60000).state;
	assert.equal(reserveIngressRate(rolling, next, 60001).allowed, false);
	assert.equal(ingressRateState.safeParse({ kind: "rolling", timestamps: [NaN] }).success, false);
	assert.equal(ingressRateState.safeParse({ kind: "token_bucket", updatedAt: 0, tokens: Infinity }).success, false);
});

test("scoped protection preserves organization authority and redacts inherited values", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'custom',ARRAY['endpoints.configure'])", [scope.organization]);
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'project-admin'),($1,'platform-staff')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('project-admin','project',$1,'custom',ARRAY['endpoints.configure']),('platform-staff','instance',$2,'custom',ARRAY['settings.manage'])", [scope.project, scope.installation]);
		const owner = { userId: "fixture-owner" };
		const parent = { type: "organization" as const, id: scope.organization };
		const child = { type: "endpoint" as const, id: scope.endpoint };
		const privateRule = filter(leaf({ header: "x-provider-token", value: "fixture-private-parent-condition" }), "block", "Organization block");
		const policy = ingressPolicy.parse({ enabled: true, rules: [privateRule] });
		assert.equal((await getIngressPolicy(pool, owner, parent, "fixture-key")).version, 0);
		await saveIngressPolicy(pool, owner, parent, { expectedVersion: 0, policy }, "fixture-key");
		const exception = ingressPolicy.parse({ enabled: true, rules: [filter(leaf({ header: "x-provider-token", value: "fixture-private-parent-condition" }), "skip", "Local exception")] });
		for (const current of [{ type: "workspace" as const, id: scope.workspace }, { type: "project" as const, id: scope.project }, child]) await saveIngressPolicy(pool, owner, current, { expectedVersion: 0, policy: exception }, "fixture-key");
		const blocked = await checkIngressPolicy(pool, scope.endpoint, { ...request, headers: { "x-provider-token": "fixture-private-parent-condition" } }, "fixture-key");
		assert.equal(blocked?.status, 403);
		assert.equal(blocked?.reason.scope.type, "organization");
		assert.equal(await checkIngressPolicy(pool, scope.endpoint, request, "fixture-key"), null);
		const summary = await getIngressPolicy(pool, { userId: "project-admin" }, child, "fixture-key");
		assert.equal(summary.inherited.length, 3);
		assert.equal(summary.inherited[0].editable, false);
		assert.equal(JSON.stringify(summary.inherited).includes("fixture-private-parent-condition"), false);
		assert.equal((await getIngressPolicy(pool, owner, child, "fixture-key")).inherited[0].editable, true);
		await assert.rejects(getIngressPolicy(pool, { userId: "project-admin" }, parent, "fixture-key"), { code: "forbidden" });
		await assert.rejects(saveIngressPolicy(pool, { userId: "platform-staff" }, parent, { expectedVersion: 1, policy }, "fixture-key"), { code: "forbidden" });
		await assert.rejects(saveIngressPolicy(pool, owner, parent, { expectedVersion: 0, policy }, "fixture-key"), { code: "version_conflict" });
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'other-owner')", [scope.installation]);
		const other = (await db.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,'Other','other','other-owner') RETURNING id", [scope.installation])).rows[0].id;
		await assert.rejects(getIngressPolicy(pool, owner, { type: "organization", id: other }, "fixture-key"), { code: "forbidden" });
		const before = (await db.query("SELECT count(*)::int AS n FROM payloadbay.ingress_rate_bucket")).rows[0].n;
		const simulation = await testIngressPolicy(pool, owner, child, { policy: exception, request: { ...request, headers: { "x-provider-token": "fixture-private-parent-condition" } } }, "fixture-key");
		assert.equal(simulation.blocked, true);
		assert.equal(simulation.results[0].scope.type, "organization");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.ingress_rate_bucket")).rows[0].n, before);
		assert.equal(JSON.stringify((await db.query("SELECT redacted_diff FROM payloadbay.audit WHERE operation='request.protection_changed'")).rows).includes("fixture-private-parent-condition"), false);
		const corrupted = Buffer.from([0]);
		await db.query("UPDATE payloadbay.ingress_policy SET encrypted_policy=$1 WHERE organization_id=$2", [corrupted, scope.organization]);
		await assert.rejects(checkIngressPolicy(pool, scope.endpoint, request, "fixture-key"));
	});
});

test("shared and per-route quotas reserve atomically across scopes and concurrent senders", async () => {
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','organization',$1,'custom',ARRAY['endpoints.configure'])", [scope.organization]);
		const actor = { userId: "fixture-owner" };
		const org = { type: "organization" as const, id: scope.organization };
		const workspace = { type: "workspace" as const, id: scope.workspace };
		const project = { type: "project" as const, id: scope.project };
		const second = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Second','second','second-key') RETURNING id", [scope.project])).rows[0].id;
		const otherWorkspace = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Second','second','fixture-owner') RETURNING id", [scope.installation, scope.organization])).rows[0].id;
		const otherProject = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Second','second','fixture-owner') RETURNING id", [otherWorkspace])).rows[0].id;
		const third = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Third','third','third-key') RETURNING id", [otherProject])).rows[0].id;
		const orgRate = rate("token_bucket", { requests: 1, windowSeconds: 3600 });
		await saveIngressPolicy(pool, actor, org, { expectedVersion: 0, policy: ingressPolicy.parse({ rateLimits: [orgRate] }) }, "fixture-key");
		await saveIngressPolicy(pool, actor, workspace, { expectedVersion: 0, policy: ingressPolicy.parse({ rateLimits: [rate("fixed", { requests: 1, windowSeconds: 3600 })] }) }, "fixture-key");
		await saveIngressPolicy(pool, actor, project, { expectedVersion: 0, policy: ingressPolicy.parse({ rateLimits: [rate("rolling", { requests: 1, windowSeconds: 3600, groupBy: "route" })] }) }, "fixture-key");
		assert.equal(await checkIngressPolicy(pool, scope.endpoint, request, "fixture-key"), null);
		assert.equal((await checkIngressPolicy(pool, second, request, "fixture-key"))?.reason.scope.type, "workspace");
		assert.equal(await checkIngressPolicy(pool, third, request, "fixture-key"), null, "a child denial must not consume the organization token");
		assert.equal((await checkIngressPolicy(pool, third, request, "fixture-key"))?.reason.scope.type, "organization");
		await saveIngressPolicy(pool, actor, org, { expectedVersion: 1, policy: ingressPolicy.parse({}) }, "fixture-key");
		await saveIngressPolicy(pool, actor, workspace, { expectedVersion: 1, policy: ingressPolicy.parse({}) }, "fixture-key");
		assert.equal(await checkIngressPolicy(pool, second, request, "fixture-key"), null, "a separate route has its own rolling counter");
		assert.equal((await checkIngressPolicy(pool, scope.endpoint, request, "fixture-key"))?.reason.scope.type, "project");
		await db.query("UPDATE payloadbay.ingress_rate_bucket SET state=jsonb_build_object('kind','rolling','timestamps',jsonb_build_array(floor(extract(epoch FROM clock_timestamp())*1000)-3600001)) WHERE endpoint_id=$1", [scope.endpoint]);
		assert.equal(await checkIngressPolicy(pool, scope.endpoint, request, "fixture-key"), null);
		await saveIngressPolicy(pool, actor, project, { expectedVersion: 1, policy: ingressPolicy.parse({}) }, "fixture-key");
		await saveIngressPolicy(pool, actor, org, { expectedVersion: 2, policy: ingressPolicy.parse({ rateLimits: [orgRate] }) }, "fixture-key");
		const results = await Promise.all(Array.from({ length: 12 }, () => checkIngressPolicy(pool, third, request, "fixture-key")));
		assert.equal(results.filter((result) => result === null).length, 2);
		assert.equal(results.filter((result) => result?.status === 429).length, 10);
		assert.ok(results.some((result) => (result?.retryAfter ?? 0) > 0));
		await assert.rejects(checkIngressPolicy(pool, crypto.randomUUID(), request, "fixture-key"), { code: "ingress_unavailable" });
	});
});
