import test, { after } from "node:test";
import assert from "node:assert/strict";
import { authFixture, identity, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { seedScope } from "../helpers/domain-fixtures.ts";
import { stopFixtures } from "../../scripts/tests/fixtures.ts";

after(stopFixtures);

test("U169 active condition reconciles one durable incident", async () => {
	const { reconcileRuntimeNotice } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		const first = await reconcileRuntimeNotice(pool, scope.installation, "runc");
		assert.ok(first?.id, "runtime condition must create durable incident");
		await new Promise((resolve) => setTimeout(resolve, 10));
		const second = await reconcileRuntimeNotice(pool, scope.installation, "runc");
		assert.equal(second.id, first.id);
		assert.equal(Number((await db.query("SELECT count(*) FROM payloadbay.notification_incident")).rows[0].count), 1);
		assert.equal(first.severity, "warning");
		assert.equal(first.redacted_data.configuredMode, "runc");
		assert.equal(first.redacted_data.hostAttestation, "not-verified");
		assert.ok(new Date(second.last_seen).getTime() >= new Date(first.last_seen).getTime());
	});
});

test("U172 per user dismissal survives condition reconciliation", async () => {
	const { reconcileRuntimeNotice, listNotifications, dismissNotification } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'other-admin')", [scope.installation]);
		for (const user of ["fixture-owner", "other-admin"]) await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'instance',$2,'custom',ARRAY['notifications.read','settings.manage'])", [user, scope.installation]);
		const incident = await reconcileRuntimeNotice(pool, scope.installation, "runc");
		const parent = { type: "instance" as const, id: scope.installation };
		assert.equal((await listNotifications(pool, { userId: "fixture-owner" }, parent)).length, 1);
		await dismissNotification(pool, { userId: "fixture-owner" }, incident.id);
		await reconcileRuntimeNotice(pool, scope.installation, "runc");
		assert.equal((await listNotifications(pool, { userId: "fixture-owner" }, parent)).length, 0, "dismissed notice must stay hidden");
		assert.equal((await listNotifications(pool, { userId: "other-admin" }, parent)).length, 1);
	});
});

test("U173 runsc configuration resolves advice without host attestation", async () => {
	const { reconcileRuntimeNotice } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		const incident = await reconcileRuntimeNotice(pool, scope.installation, "runc");
		await reconcileRuntimeNotice(pool, scope.installation, "runsc");
		const row = (await db.query("SELECT * FROM payloadbay.notification_incident WHERE id=$1", [incident.id])).rows[0];
		assert.equal(row.status, "resolved", "runsc mode must resolve ordinary Docker advice");
		assert.ok(row.resolved_at);
		assert.equal(row.redacted_data.hostAttestation, "not-verified");
		assert.equal(Number((await db.query("SELECT count(*) FROM payloadbay.notification_incident")).rows[0].count), 1);
	});
});

test("U171 project administrator cannot inspect instance runtime advice", async () => {
	const { reconcileRuntimeNotice, listNotifications } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','settings.manage'])", [scope.project]);
		await reconcileRuntimeNotice(pool, scope.installation, "runc");
		await assert.rejects(listNotifications(pool, { userId: "fixture-owner" }, { type: "instance", id: scope.installation }), { code: "forbidden" });
		assert.deepEqual(await listNotifications(pool, { userId: "fixture-owner" }, { type: "project", id: scope.project }), []);
	});
});

test("U178 opt-in threshold counts failed operations rather than retries", async () => {
	const module = await import("../../packages/domain/src/notification-rules.ts").catch(() => ({ createNotificationRule: undefined, evaluateFailureRules: undefined }));
	assert.equal(typeof module.evaluateFailureRules, "function", "Opt-in failure evaluator must exist");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		const { seedEvent } = await import("../helpers/domain-fixtures.ts");
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','notifications.rules.manage'])", [scope.project]);
		const event = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;

		const operation = async (id: string, retries: number) => {
			await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,state,generation) VALUES($1,$2,'fixture','{}','failed',1)", [execution, id]);
			for (let i = 0; i < retries; i++) await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,ended_at,status_code) VALUES($1,$2,$3,1,clock_timestamp(),500)", [execution, id, i + 1]);
		};

		await operation("first", 3);
		assert.deepEqual(await module.evaluateFailureRules!(pool), [], "Failures alone must not create default notifications");
		await module.createNotificationRule!(pool, { userId: "fixture-owner" }, scope.project, {
			enabled: true,
			count: 2,
			windowSeconds: 60,
			endpointId: scope.endpoint,
			recoveryPolicy: "window",
		});
		assert.deepEqual(await module.evaluateFailureRules!(pool), [], "Three retries of one operation count once");
		await operation("second", 1);
		const incidents = await module.evaluateFailureRules!(pool);
		assert.equal(incidents.length, 1);
		assert.equal(incidents[0].redacted_data.observedCount, 2);
		assert.equal((await module.evaluateFailureRules!(pool))[0].id, incidents[0].id);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n, 1);
	});
});

test("U170 disabled rules resolve incidents without deleting history", async () => {
	const module = await import("../../packages/domain/src/notification-rules.ts");
	assert.equal(typeof module.updateNotificationRule, "function", "Versioned rule updates must exist");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.rules.manage','notifications.read'])", [scope.project]);
		const { seedEvent } = await import("../helpers/domain-fixtures.ts");
		const event = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'main','fixture','{}',1)", [execution]);
		await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,ended_at,status_code) VALUES($1,'main',1,1,clock_timestamp(),500)", [execution]);
		const actor = { userId: "fixture-owner" };
		const rule = await module.createNotificationRule(pool, actor, scope.project, { enabled: true, count: 1, windowSeconds: 60 });
		const first = (await module.evaluateFailureRules(pool))[0];
		assert.ok(first.id);
		const updated = await module.updateNotificationRule(pool, actor, String(rule.id), 1, { enabled: false });
		assert.equal(updated.version, 2);
		assert.equal(updated.count, 1);
		assert.equal(updated.windowSeconds, 60);
		await assert.rejects(module.updateNotificationRule(pool, actor, String(rule.id), 1, { count: 2 }), { code: "version_conflict" });
		assert.deepEqual(await module.evaluateFailureRules(pool), []);
		const history = (await db.query("SELECT * FROM payloadbay.notification_incident WHERE id=$1", [first.id])).rows[0];
		assert.equal(history.status, "resolved");
		assert.ok(history.resolved_at);
		await module.updateNotificationRule(pool, actor, String(rule.id), 2, { enabled: true });
		const second = (await module.evaluateFailureRules(pool))[0];
		assert.notEqual(second.id, first.id);
		assert.equal(second.generation, 2);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n, 2);
	});
});

test("U174 trusted notification producer fires at the first matching failure", async () => {
	const module = await import("../../apps/worker/src/notifications.ts").catch(() => ({ startNotificationProducer: undefined }));
	assert.equal(typeof module.startNotificationProducer, "function", "Trusted notification producer must exist");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.rules.manage'])", [scope.project]);
		const { createNotificationRule } = await import("../../packages/domain/src/notification-rules.ts");
		await createNotificationRule(pool, { userId: "fixture-owner" }, scope.project, {
			enabled: true,
			count: 1,
			windowSeconds: 60,
			endpointId: scope.endpoint,
		});
		const { seedEvent } = await import("../helpers/domain-fixtures.ts");
		const event = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'main','fixture','{}',1)", [execution]);
		const producer = module.startNotificationProducer!(pool, { intervalMs: 20 });
		try {
			await new Promise((resolve) => setTimeout(resolve, 60));
			assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n, 0);
			await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,ended_at,status_code) VALUES($1,'main',1,1,clock_timestamp(),503)", [execution]);
			let found = false;
			for (let i = 0; i < 100; i++) {
				if ((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n === 1) {
					found = true;
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 20));
			}

			assert.ok(found, "First matching failure must produce a durable incident");
			await new Promise((resolve) => setTimeout(resolve, 60));
			assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n, 1);
		} finally {
			await producer.stop();
		}
	});
});

test("U313 SMTP subscriptions require current scoped notification access", async () => {
	const { setNotificationSubscription } = await import("../../packages/domain/src/notification-subscriptions.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read'])", [scope.project]);
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'unrelated-reader')", [scope.installation]);
		const rule = (await db.query("INSERT INTO payloadbay.notification_rule(project_id,count,window_seconds,signal,severity,recovery_policy) VALUES($1,1,60,'failed_operation','warning','manual') RETURNING id", [scope.project])).rows[0];
		const owner = { userId: "fixture-owner" };
		assert.deepEqual(await setNotificationSubscription(pool, owner, rule.id, { enabled: true }), { ruleId: rule.id, channel: "smtp", enabled: true });
		await assert.rejects(setNotificationSubscription(pool, { userId: "unrelated-reader" }, rule.id, { enabled: true }), { code: "forbidden" });
		await assert.rejects(setNotificationSubscription(pool, owner, rule.id, { enabled: true, userId: "unrelated-reader" }), { code: "invalid_input" });
		assert.deepEqual((await db.query("SELECT user_id,channel,enabled FROM payloadbay.notification_subscription")).rows, [{ user_id: "fixture-owner", channel: "smtp", enabled: true }]);
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.notification_dispatch")).rows[0].count, 0, "Opting in alone cannot create an email job");
	});
});

type NotificationMailFixtureData = Parameters<Parameters<typeof authFixture>[0]>[0] & {
	scope: Awaited<ReturnType<typeof seedScope>>;
	rule: { id: string; version: number };
	incident: { id: string; generation: number };
	owner: { userId: string };
};

async function notificationMailFixture(run: (fixture: NotificationMailFixtureData) => Promise<void>) {
	const { createNotificationRule } = await import("../../packages/domain/src/notification-rules.ts");
	const { setNotificationSubscription } = await import("../../packages/domain/src/notification-subscriptions.ts");
	const { reconcileCondition } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async (fixture) => {
		const scope = await seedScope(fixture.db);
		await identity(fixture.db, "fixture-owner");
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','notifications.rules.manage'])", [scope.project]);
		const owner = { userId: "fixture-owner" };
		const rule = await createNotificationRule(fixture.pool, owner, scope.project, { enabled: true, count: 1, windowSeconds: 60 });
		await setNotificationSubscription(fixture.pool, owner, rule.id, { enabled: true });
		const incident = await reconcileCondition(fixture.pool, {
			key: "failure-rule:" + rule.id,
			revision: String(rule.version),
			kind: "delivery.failure-threshold",
			scope: { type: "project", id: scope.project },
			subject: "Delivery failure threshold reached",
			severity: "warning",
			active: true,
			data: {
				ruleId: rule.id,
				observedCount: 1,
				threshold: 1,
				windowSeconds: 60,
			},
		});
		await run({
			...fixture,
			scope,
			rule,
			incident,
			owner,
		});
	});
}

test("U314 active incident email dispatch is durable and deduplicated", async () => {
	const { queueIncidentNotifications } = await import("../../packages/domain/src/notification-dispatch.ts");
	await notificationMailFixture(async (fixture) => {
		await identity(fixture.db, "unrelated-reader");
		await fixture.db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'unrelated-reader')", [fixture.scope.installation]);
		await fixture.db.query("INSERT INTO payloadbay.notification_subscription(rule_id,user_id,channel,enabled) VALUES($1,'unrelated-reader','smtp',true)", [fixture.rule.id]);
		const encryptionKey = fixtureConfig(fixture).encryptionKey;
		assert.equal(await queueIncidentNotifications(fixture.pool, fixture.incident.id, encryptionKey), 1, "Only opted-in authorized recipients get a mail job");
		const repeats = await Promise.all(Array.from({ length: 4 }, () => queueIncidentNotifications(fixture.pool, fixture.incident.id, encryptionKey)));
		assert.deepEqual(repeats, [0, 0, 0, 0]);
		const dispatches = (await fixture.db.query("SELECT * FROM payloadbay.notification_dispatch WHERE state='queued'")).rows;
		assert.equal(dispatches.length, 1);
		assert.equal(dispatches[0].user_id, "fixture-owner");
		const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE id=$1", [dispatches[0].platform_job_id])).rows[0];
		assert.equal(job.kind, "notification_mail");
		const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
		const queuedPayload = decryptPrivate<Record<string, unknown>>(job.encrypted_payload, encryptionKey);
		assert.deepEqual({ incidentId: queuedPayload.incidentId, incidentGeneration: queuedPayload.incidentGeneration, userId: queuedPayload.userId }, { incidentId: fixture.incident.id, incidentGeneration: fixture.incident.generation, userId: "fixture-owner" });
		assert.ok(queuedPayload.channelSnapshot, "Queue-time channel and branding are pinned");
		assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count, 1);
	});
});

test("U315 opted-in authorized recipient receives an SMTP incident summary", async () => {
	const { queueIncidentNotifications } = await import("../../packages/domain/src/notification-dispatch.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	await notificationMailFixture(async (fixture) => {
		const before = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
		const previousIds = new Set(before.messages.map((message: { ID: string }) => message.ID));
		const config = fixtureConfig(fixture);
		await fixture.db.query("UPDATE payloadbay.notification_incident SET redacted_data=redacted_data||$2::jsonb WHERE id=$1", [fixture.incident.id, JSON.stringify({ payload: "private-webhook-payload", secret: "fixture-private-secret" })]);
		await queueIncidentNotifications(fixture.pool, fixture.incident.id, config.encryptionKey);
		const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0];
		await platformJobTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
		assert.equal((await fixture.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0].state, "succeeded", "Notification mail must use the real SMTP worker path");
		let delivered: { ID: string; Subject: string; To: { Address: string }[] } | undefined;
		for (let attempt = 0; attempt < 50 && !delivered; attempt++) {
			const mailbox = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
			delivered = mailbox.messages.find((message: { ID: string; Subject: string; To: { Address: string }[] }) => !previousIds.has(message.ID) && message.Subject === "Delivery failure threshold reached" && message.To.some((recipient) => recipient.Address === "fixture-owner@example.test"));
			if (!delivered) await new Promise((resolve) => setTimeout(resolve, 100));
		}

		assert.ok(delivered, "Mailpit must receive the incident summary");
		const message = await (await fetch(fixture.mailUrl + "/api/v1/message/" + delivered.ID)).json();
		assert.match(message.Text, new RegExp("/projects/" + fixture.scope.project + "/notifications"));
		assert.ok(!message.Text.includes("private-webhook-payload"));
		assert.ok(!message.Text.includes("fixture-private-secret"));
		await platformJobTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
		assert.equal((await fixture.db.query("SELECT state FROM payloadbay.notification_dispatch WHERE platform_job_id=$1", [job.id])).rows[0].state, "sent");
	});
});

test("U179 revoked access prevents already queued notification email", async () => {
	const { queueIncidentNotifications } = await import("../../packages/domain/src/notification-dispatch.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	for (const revocation of ["grant", "admission"]) {
		await notificationMailFixture(async (fixture) => {
			const config = fixtureConfig(fixture);
			await queueIncidentNotifications(fixture.pool, fixture.incident.id, config.encryptionKey);
			const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0];
			const before = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
			if (revocation === "grant") await fixture.db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY[]::text[] WHERE user_id='fixture-owner'");
			else await fixture.db.query("UPDATE payloadbay.admission SET active=false WHERE user_id='fixture-owner'");
			await platformJobTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
			const current = (await fixture.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [job.id])).rows[0];
			assert.equal(current.state, "expired", "Revoked recipients must not receive queued email");
			const after = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
			assert.equal(after.total, before.total, "No SMTP receipt is created after access revocation");
			assert.equal((await fixture.db.query("SELECT state FROM payloadbay.notification_dispatch WHERE platform_job_id=$1", [job.id])).rows[0].state, "skipped");
		});
	}
});

test("U316 continuous failure producer queues opted-in SMTP notifications", async () => {
	const { startNotificationProducer } = await import("../../apps/worker/src/notifications.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	const { createRequire } = await import("node:module");
	const { run } = createRequire(new URL("../../apps/worker/package.json", import.meta.url))("graphile-worker") as typeof import("../../apps/worker/node_modules/graphile-worker");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await notificationMailFixture(async (fixture) => {
		const config = fixtureConfig(fixture);
		const event = await seedEvent(fixture.db, fixture.scope);
		const execution = (await fixture.db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, fixture.scope.endpoint, fixture.scope.publication])).rows[0].id;
		await fixture.db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,generation) VALUES($1,'first-failure','fixture','{}',1)", [execution]);
		await fixture.db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,ended_at,status_code) VALUES($1,'first-failure',1,1,clock_timestamp(),500)", [execution]);
		const runner = await run({
			pgPool: fixture.pool,
			noHandleSignals: true,
			pollInterval: 50,
			parsedCronItems: [],
			concurrency: 1,
			taskList: { platform_job: platformJobTask(fixture.pool, config) },
		});
		const producer = startNotificationProducer(fixture.pool, { intervalMs: 20, encryptionKey: config.encryptionKey });
		try {
			let sent = false;
			for (let attempt = 0; attempt < 50 && !sent; attempt++) {
				sent = (await fixture.db.query("SELECT count(*)::int AS count FROM payloadbay.notification_dispatch WHERE state='sent'")).rows[0].count === 1;
				if (!sent) await new Promise((resolve) => setTimeout(resolve, 100));
			}

			assert.ok(sent, "Continuous producer must dispatch the first configured failure through SMTP");
			await new Promise((resolve) => setTimeout(resolve, 100));
			assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0].count, 1);
			assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM payloadbay.notification_incident")).rows[0].count, 1);
		} finally {
			await producer.stop();
			await runner.stop();
		}
	});
});

test("workspace rules aggregate descendant failures and keep subscriptions scoped", async () => {
	const { createNotificationRule, evaluateFailureRules, listNotificationRules } = await import("../../packages/domain/src/notification-rules.ts");
	const { setNotificationSubscription, listNotificationPreferences } = await import("../../packages/domain/src/notification-subscriptions.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','workspace',$1,'custom',ARRAY['notifications.read','notifications.rules.manage'])", [scope.workspace]);
		const actor = { userId: "fixture-owner" };
		const workspace = { type: "workspace" as const, id: scope.workspace };
		const rule = await createNotificationRule(pool, actor, workspace, {
			enabled: true,
			count: 1,
			windowSeconds: 60,
			recoveryPolicy: "window",
		});
		assert.equal(rule.projectId, null);
		assert.equal(rule.workspaceId, scope.workspace);
		await assert.rejects(
			createNotificationRule(pool, actor, workspace, {
				enabled: true,
				count: 1,
				windowSeconds: 60,
				endpointId: scope.endpoint,
			}),
			{ code: "invalid_rule_scope" },
		);
		const event = await seedEvent(db, scope);
		const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, scope.endpoint, scope.publication])).rows[0].id;
		await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,state,generation) VALUES($1,'primary','fixture','{}','failed',1)", [execution]);
		await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,ended_at,status_code) VALUES($1,'primary',1,1,clock_timestamp(),503)", [execution]);
		const incidents = await evaluateFailureRules(pool);
		assert.equal(incidents.length, 1);
		assert.equal(incidents[0].scope_type, "workspace");
		assert.equal(incidents[0].scope_id, scope.workspace);
		await setNotificationSubscription(pool, actor, rule.id, { enabled: true });
		assert.equal((await listNotificationPreferences(pool, actor, workspace))[0].smtpEnabled, true);
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','notifications.rules.manage'])", [scope.project]);
		await assert.rejects(listNotificationRules(pool, actor, workspace), { code: "forbidden" });
		await assert.rejects(setNotificationSubscription(pool, actor, rule.id, { enabled: true }), { code: "forbidden" });
	});
});

test("instance notification channels fork built-ins into immutable custom versions", async () => {
	const { listNotificationChannels, getNotificationChannel, publishNotificationChannel } = await import("../../packages/domain/src/notification-channels.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const original = await getNotificationChannel(pool, actor, "smtp");
		assert.equal(original.builtin, true);
		assert.match(original.source, /NotificationContext/);
		const fork = await publishNotificationChannel(pool, actor, {
			name: "Our email",
			kind: "email",
			source: original.source,
			originKey: "smtp",
			compile,
		});
		assert.notEqual(fork.id, "smtp");
		const changed = await publishNotificationChannel(pool, actor, {
			id: fork.id,
			expectedVersion: fork.version,
			name: "Our email",
			kind: "email",
			source: original.source.replace("ctx.email(ctx.message)", 'ctx.email({...ctx.message,title:"Custom title"})'),
			compile,
		});
		assert.notEqual(changed.activeRevisionId, fork.activeRevisionId);
		assert.equal((await getNotificationChannel(pool, actor, "smtp")).source, original.source);
		assert.equal((await getNotificationChannel(pool, actor, fork.id, fork.activeRevisionId)).source, original.source);
		await assert.rejects(
			publishNotificationChannel(pool, actor, {
				id: fork.id,
				expectedVersion: fork.version,
				name: "Stale",
				kind: "email",
				source: original.source,
				compile,
			}),
			{ code: "version_conflict" },
		);
		assert.equal((await listNotificationChannels(pool, actor)).length, 2);
		await identity(db, "project-channel-admin");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'project-channel-admin')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('project-channel-admin','project',$1,'admin',$2)", [scope.project, permissions]);
		await assert.rejects(
			publishNotificationChannel(
				pool,
				{ userId: "project-channel-admin" },
				{
					name: "Escalated",
					kind: "email",
					source: original.source,
					compile,
				},
			),
			{ code: "forbidden" },
		);
	});
});

test("shared email rendering escapes content and provides a readable plain-text alternative", async () => {
	const { renderEmailMessage } = await import("../../packages/domain/src/email-renderer.tsx");
	const rendered = await renderEmailMessage(
		{
			subject: "Sign in",
			title: "Your code <unsafe>",
			paragraphs: ['Hello <img src=x onerror="alert(1)">'],
			code: "123456",
			action: { label: "Open dashboard", url: "https://example.test/" },
		},
		{
			name: "Payload Bay",
			accent: "#156FDE",
			footer: "Synthetic test",
			logoUrl: null,
		},
	);
	assert.ok(!rendered.html.includes("<img src=x"));
	assert.match(rendered.html, /&lt;unsafe&gt;/);
	assert.match(rendered.html, /123456/);
	assert.match(rendered.text, /123456/);
	assert.match(rendered.text, /https:\/\/example.test/);
	await assert.rejects(
		renderEmailMessage(
			{ subject: "Bad\r\nBcc:other@example.test", title: "Invalid", paragraphs: [] },
			{
				name: "Payload Bay",
				accent: "#156FDE",
				footer: "Test",
				logoUrl: null,
			},
		),
	);
});

test("queued notification delivery pins channel code and branding across later edits", async () => {
	const { publishNotificationChannel, getNotificationChannel } = await import("../../packages/domain/src/notification-channels.ts");
	const { snapshotNotificationChannel } = await import("../../packages/domain/src/email-settings.ts");
	const { runNotificationChannel } = await import("../../packages/domain/src/notification-runtime.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { execute } = await import("../../apps/executor/src/supervisor.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await authFixture(async (fixture) => {
		const scope = await seedScope(fixture.db);
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const builtin = await getNotificationChannel(fixture.pool, actor, "smtp");
		const channel = await publishNotificationChannel(fixture.pool, actor, {
			name: "Pinned email",
			kind: "email",
			source: builtin.source.replace("ctx.email(ctx.message)", 'ctx.email({...ctx.message,title:"Original title"})'),
			compile,
		});
		// Existing queue snapshots retain presentation when stored configuration changes.
		await fixture.db.query("INSERT INTO payloadbay.email_settings(installation_id,branding,updated_by) VALUES($1,$2,$3)", [
			scope.installation,
			JSON.stringify({
				name: "Original brand",
				accent: "#156FDE",
				footer: "Original footer",
				logoUrl: null,
			}),
			actor.userId,
		]);
		const snapshot = await snapshotNotificationChannel(fixture.pool, channel.id);
		await publishNotificationChannel(fixture.pool, actor, {
			id: channel.id,
			expectedVersion: channel.version,
			name: "Pinned email",
			kind: "email",
			source: builtin.source.replace("ctx.email(ctx.message)", 'ctx.email({...ctx.message,title:"Changed title"})'),
			compile,
		});
		await fixture.db.query("UPDATE payloadbay.email_settings SET branding=$1,version=version+1 WHERE installation_id=$2", [
			JSON.stringify({
				name: "Changed brand",
				accent: "#156FDE",
				footer: "Changed footer",
				logoUrl: null,
			}),
			scope.installation,
		]);
		const result = await runNotificationChannel(
			fixture.pool,
			snapshot,
			{
				kind: "channel.test",
				deliveryId: crypto.randomUUID(),
				attempt: 1,
				recipient: { email: "fixture@example.test" },
				message: { subject: "Test", title: "Input", paragraphs: [] },
			},
			fixtureConfig(fixture),
			{ run: execute },
		);
		assert.equal(result.kind, "email");
		if (result.kind === "email") assert.equal(result.message.title, "Original title");
		assert.equal(snapshot.branding.name, "Original brand");
	});
});

test("custom HTTP notification delivery uses the isolated executor and respects pause before send", async () => {
	const { publishNotificationChannel, updateNotificationChannel } = await import("../../packages/domain/src/notification-channels.ts");
	const { queueChannelTest } = await import("../../packages/domain/src/notification-testing.ts");
	const { platformJobTask } = await import("../../apps/worker/src/tasks/platform-job.ts");
	const { compileSource } = await import("../../packages/domain/src/executor-client.ts");
	const { executorFixture } = await import("../helpers/executor-fixture.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await authFixture(async (fixture) => {
		const scope = await seedScope(fixture.db);
		await identity(fixture.db, "fixture-owner");
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const executor = await executorFixture({ network: fixture.network, notificationHosts: ["http"] });
		try {
			const config = { ...fixtureConfig(fixture), executorUrl: executor.url };
			const actor = { userId: "fixture-owner" };
			const module = await publishNotificationChannel(fixture.pool, actor, {
				name: "Custom HTTP test",
				kind: "webhook",
				source: 'export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> { const response = await fetch("http://http:8080/notification", {method:"POST",body:JSON.stringify({title:ctx.message.title,attempt:ctx.attempt,deliveryId:ctx.deliveryId})}); return response.ok ? ctx.complete() : ctx.retry({reason:"HTTP failed"}); }',
				compile: (input) => compileSource(config, input),
			});
			const queued = await queueChannelTest(fixture.pool, actor, module.id, config);
			const job = (await fixture.db.query("SELECT generation FROM payloadbay.platform_job WHERE id=$1", [queued.jobId])).rows[0];
			await platformJobTask(fixture.pool, config)({ jobId: queued.jobId, generation: job.generation });
			assert.equal((await fixture.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [queued.jobId])).rows[0].state, "succeeded");
			const receipts = await (await fetch(fixture.httpUrl + "/receipts")).json();
			assert.equal(receipts.length, 1);
			const body = JSON.parse(Buffer.from(receipts[0].body, "base64").toString());
			assert.equal(body.deliveryId, queued.jobId);
			assert.equal(body.attempt, 1);
			const paused = await queueChannelTest(fixture.pool, actor, module.id, config);
			await updateNotificationChannel(fixture.pool, actor, module.id, { expectedVersion: module.version, enabled: false });
			await platformJobTask(fixture.pool, config)({ jobId: paused.jobId, generation: 1 });
			assert.equal((await fixture.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [paused.jobId])).rows[0].state, "expired");
			assert.equal((await (await fetch(fixture.httpUrl + "/receipts")).json()).length, 1);
			assert.equal((await (await fetch(fixture.mailUrl + "/api/v1/messages")).json()).total, 0, "HTTP notifications must not also send SMTP mail");
			const retrying = await publishNotificationChannel(fixture.pool, actor, {
				name: "Retry test",
				kind: "webhook",
				source: 'export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> { return ctx.attempt < 2 ? ctx.retry({reason:"Try again",delayMs:1}) : ctx.complete(); }',
				compile: (input) => compileSource(config, input),
			});
			const retryJob = await queueChannelTest(fixture.pool, actor, retrying.id, config);
			await platformJobTask(fixture.pool, config)({ jobId: retryJob.jobId, generation: 1 });
			const pending = (await fixture.db.query("SELECT state,generation,attempt_number FROM payloadbay.platform_job WHERE id=$1", [retryJob.jobId])).rows[0];
			assert.deepEqual(pending, { state: "queued", generation: 2, attempt_number: 1 });
			const scheduled = (await fixture.db.query("SELECT priority FROM graphile_worker.jobs WHERE key=$1", [`platform:${retryJob.jobId}:2`])).rows[0];
			assert.equal(scheduled.priority, 30, "Notification retries must not gain authentication-mail priority");
			await platformJobTask(fixture.pool, config)({ jobId: retryJob.jobId, generation: 2 });
			assert.equal((await fixture.db.query("SELECT state FROM payloadbay.platform_job WHERE id=$1", [retryJob.jobId])).rows[0].state, "succeeded");
		} finally {
			await executor.stop();
		}
	});
});

test("custom channel subscriptions queue immutable code pins and deduplicate each recipient/channel", async () => {
	const { publishNotificationChannel, updateNotificationChannel } = await import("../../packages/domain/src/notification-channels.ts");
	const { setNotificationSubscription, listNotificationPreferences } = await import("../../packages/domain/src/notification-subscriptions.ts");
	const { queueIncidentNotifications } = await import("../../packages/domain/src/notification-dispatch.ts");
	const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
	const { compile } = await import("../../apps/executor/src/compiler.ts");
	const { permissions } = await import("../../packages/contracts/src/permissions.ts");
	await notificationMailFixture(async (fixture) => {
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [fixture.scope.installation, permissions]);
		const actor = { userId: "fixture-owner" };
		const channel = await publishNotificationChannel(fixture.pool, actor, {
			name: "Custom alerts",
			kind: "webhook",
			source: "export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> { return ctx.complete(); }",
			compile,
		});
		await setNotificationSubscription(fixture.pool, actor, fixture.rule.id, { channel: "smtp", enabled: false });
		await setNotificationSubscription(fixture.pool, actor, fixture.rule.id, { channel: channel.id, enabled: true, revisionId: channel.activeRevisionId });
		const changed = await publishNotificationChannel(fixture.pool, actor, {
			id: channel.id,
			expectedVersion: channel.version,
			name: "Changed alerts",
			kind: "webhook",
			source: "export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> { return ctx.fail({ reason: 'changed' }); }",
			compile,
		});
		await assert.rejects(setNotificationSubscription(fixture.pool, actor, fixture.rule.id, { channel: channel.id, enabled: true, revisionId: channel.activeRevisionId }), { code: "channel_version_changed" });

		const config = fixtureConfig(fixture);
		assert.equal(await queueIncidentNotifications(fixture.pool, fixture.incident.id, config.encryptionKey), 1);
		assert.equal(await queueIncidentNotifications(fixture.pool, fixture.incident.id, config.encryptionKey), 0);
		const dispatch = (await fixture.db.query("SELECT * FROM payloadbay.notification_dispatch")).rows[0];
		assert.equal(dispatch.channel, channel.id);
		const payload = decryptPrivate<{ channelSnapshot: { channelId: string; revisionId: string } }>((await fixture.db.query("SELECT encrypted_payload FROM payloadbay.platform_job WHERE id=$1", [dispatch.platform_job_id])).rows[0].encrypted_payload, config.encryptionKey);
		assert.equal(payload.channelSnapshot.channelId, channel.id);
		assert.equal(payload.channelSnapshot.revisionId, channel.activeRevisionId);
		assert.deepEqual((await listNotificationPreferences(fixture.pool, actor, fixture.scope.project))[0].channels, [channel.id]);
		await updateNotificationChannel(fixture.pool, actor, channel.id, { expectedVersion: changed.version, enabled: false });
		await setNotificationSubscription(fixture.pool, actor, fixture.rule.id, { channel: channel.id, enabled: false });
		assert.deepEqual((await listNotificationPreferences(fixture.pool, actor, fixture.scope.project))[0].channels, []);
	});
});

test("U168 U175 U176 U177 opt-in thresholds exclude other routes destinations and expired failures", async () => {
	const { createNotificationRule, evaluateFailureRules } = await import("../../packages/domain/src/notification-rules.ts");
	const { queueIncidentNotifications } = await import("../../packages/domain/src/notification-dispatch.ts");
	const { seedEvent } = await import("../helpers/domain-fixtures.ts");
	await authFixture(async (fixture) => {
		const { pool, db } = fixture;
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','notifications.rules.manage'])", [scope.project]);
		const destination = (await db.query("INSERT INTO payloadbay.destination(project_id,name,http_config) VALUES($1,'Selected','{}') RETURNING id", [scope.project])).rows[0].id;
		const otherDestination = (await db.query("INSERT INTO payloadbay.destination(project_id,name,http_config) VALUES($1,'Other','{}') RETURNING id", [scope.project])).rows[0].id;
		const otherEndpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Other route','other',gen_random_uuid()::text) RETURNING id", [scope.project])).rows[0].id;
		const otherPublication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) SELECT $1,ingress_revision_id,processing_revision_id,'fixture','fixture-owner' FROM payloadbay.publication WHERE id=$2 RETURNING id", [otherEndpoint, scope.publication])).rows[0].id;

		async function failure(endpoint: string, publication: string, destinationId: string, secondsAgo = 0) {
			const event = await seedEvent(db, { endpoint, publication });
			const execution = (await db.query("INSERT INTO payloadbay.execution(event_id,endpoint_id,publication_id) VALUES($1,$2,$3) RETURNING id", [event, endpoint, publication])).rows[0].id;
			await db.query("INSERT INTO payloadbay.managed_operation(execution_id,operation_id,input_digest,destination_snapshot,state,generation) VALUES($1,'main','fixture',$2,'failed',1)", [execution, JSON.stringify({ id: destinationId })]);
			await db.query("INSERT INTO payloadbay.delivery_attempt(execution_id,operation_id,execution_attempt,generation,started_at,ended_at,status_code) VALUES($1,'main',1,1,clock_timestamp()-(($2::int+1)*interval '1 second'),clock_timestamp()-($2::int*interval '1 second'),503)", [execution, secondsAgo]);
		}

		await failure(otherEndpoint, otherPublication, destination);
		await failure(scope.endpoint, scope.publication, otherDestination);
		assert.deepEqual(await evaluateFailureRules(pool), []);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_incident")).rows[0].n, 0, "Failures must not invent an implicit rule");
		await createNotificationRule(pool, { userId: "fixture-owner" }, scope.project, {
			enabled: true,
			count: 2,
			windowSeconds: 60,
			endpointId: scope.endpoint,
			destinationId: destination,
			recoveryPolicy: "window",
		});
		assert.deepEqual(await evaluateFailureRules(pool), [], "Other routes and destinations do not match this rule");
		await failure(scope.endpoint, scope.publication, destination);
		assert.deepEqual(await evaluateFailureRules(pool), [], "N-1 distinct operations must not trigger the rule");
		await failure(scope.endpoint, scope.publication, destination, 120);
		assert.deepEqual(await evaluateFailureRules(pool), [], "Expired failures do not fill the threshold");
		await failure(scope.endpoint, scope.publication, destination);
		const incidents = await evaluateFailureRules(pool);
		assert.equal(incidents.length, 1);
		assert.equal(incidents[0].redacted_data.observedCount, 2);
		assert.equal((await evaluateFailureRules(pool))[0].id, incidents[0].id);
		assert.equal(await queueIncidentNotifications(pool, incidents[0].id, fixtureConfig(fixture).encryptionKey), 0, "A rule does not create an implicit email subscription");
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.notification_dispatch")).rows[0].n, 0);
		assert.equal((await db.query("SELECT count(*)::int AS n FROM payloadbay.platform_job")).rows[0].n, 0);
	});
});

test("NC11 instance customization is unavailable even to instance owners until enterprise licensing exists", async () => {
	const { getEmailSettings, saveEmailSettings } = await import("../../packages/domain/src/email-settings.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['settings.manage'])", [scope.installation]);
		await identity(db, "settings-viewer");
		await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'settings-viewer')", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('settings-viewer','project',$1,'viewer',ARRAY['metadata.read'])", [scope.project]);
		const owner = { userId: "fixture-owner" };
		const defaults = await getEmailSettings(pool, owner, "https://alpha.example.test");
		assert.equal(defaults.version, 0);
		assert.equal(defaults.channelKey, "smtp");
		assert.equal(defaults.branding.logoUrl, "https://alpha.example.test/brand/payloadbay-email-logo.png");
		assert.deepEqual(Object.keys(defaults).sort(), ["branding", "channelKey", "version"]);
		await assert.rejects(getEmailSettings(pool, { userId: "settings-viewer" }), { status: 403 });
		const branding = {
			name: "Synthetic settings brand",
			accent: "#123456",
			footer: "Synthetic settings footer",
			logoUrl: null,
		};
		await assert.rejects(saveEmailSettings(pool, owner, { expectedVersion: 0, channelKey: "smtp", branding }), { code: "feature_unavailable", status: 403 });
		await assert.rejects(saveEmailSettings(pool, { userId: "settings-viewer" }, { expectedVersion: 0, channelKey: "smtp", branding }), { status: 403 });
		assert.equal((await db.query("SELECT count(*)::int AS count FROM payloadbay.email_settings")).rows[0].count, 0);
		assert.deepEqual(await getEmailSettings(pool, owner, "https://alpha.example.test"), defaults);
		await assert.rejects(getEmailSettings(pool, { userId: "settings-viewer" }), { status: 403 });
	});
});

test("CF04 authentication messages bypass even an already pinned custom channel", async () => {
	const { runNotificationChannel } = await import("../../packages/domain/src/notification-runtime.ts");
	const { defaultEmailBranding } = await import("../../packages/domain/src/email-settings.ts");
	await authFixture(async (fixture) => {
		const config = fixtureConfig(fixture);
		const scope = await seedScope(fixture.db);
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const { permissions } = await import("../../packages/contracts/src/permissions.ts");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'owner',$2)", [scope.installation, permissions]);
		const { publishNotificationChannel } = await import("../../packages/domain/src/notification-channels.ts");
		const { compile } = await import("../../apps/executor/src/compiler.ts");
		const { execute } = await import("../../apps/executor/src/supervisor.ts");
		const channel = await publishNotificationChannel(
			fixture.pool,
			{ userId: "fixture-owner" },
			{
				name: "Unsafe auth adapter",
				kind: "email",
				source: "return ctx.email({...ctx.message,title:'Custom code read '+ctx.message.code});",
				compile,
			},
		);
		for (const kind of ["auth.login-code", "auth.invitation"] as const) {
			let executed = false;
			const message = {
				subject: "Authentication",
				title: "Authentication",
				paragraphs: [],
				code: "123456",
				action: { label: "Accept", url: "https://example.test/invitation/private" },
			};
			const result = await runNotificationChannel(
				fixture.pool,
				{
					requestedKey: "smtp",
					channelId: channel.id,
					revisionId: channel.activeRevisionId,
					branding: defaultEmailBranding(),
				},
				{
					kind,
					message,
					recipient: { email: "customer@example.test" },
					deliveryId: "job",
					attempt: 1,
				},
				config,
				{
					run: async (options) => {
						executed = true;

						return execute(options);
					},
				},
			);
			assert.equal(executed, false);
			assert.deepEqual(result, { kind: "email", message: { ...message, paragraphs: [] } });
		}
	});
});

test("account notifications combine explicitly authorized resources and exclude unrelated customer incidents", async () => {
	const { listAccountNotifications, reconcileCondition, dismissNotification } = await import("../../packages/domain/src/notifications.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['notifications.read','settings.manage'])", [scope.installation]);
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read'])", [scope.project]);
		const platform = await reconcileCondition(pool, {
			key: "platform-test",
			revision: "v1",
			kind: "platform.test",
			scope: { type: "instance", id: scope.installation },
			subject: "Platform notice",
			severity: "info",
			active: true,
		});
		const project = await reconcileCondition(pool, {
			key: "project-test",
			revision: "v1",
			kind: "delivery.test",
			scope: { type: "project", id: scope.project },
			subject: "Project notice",
			severity: "warning",
			active: true,
		});
		await reconcileCondition(pool, {
			key: "workspace-test",
			revision: "v1",
			kind: "delivery.test",
			scope: { type: "workspace", id: scope.workspace },
			subject: "Private workspace notice",
			severity: "warning",
			active: true,
		});
		const actor = { userId: "fixture-owner" };
		assert.deepEqual(new Set((await listAccountNotifications(pool, actor)).map((notice) => notice.id)), new Set([platform.id, project.id]));
		await dismissNotification(pool, actor, platform.id);
		assert.deepEqual(
			(await listAccountNotifications(pool, actor)).map((notice) => notice.id),
			[project.id],
		);
		await db.query("DELETE FROM payloadbay.grant_record WHERE user_id='fixture-owner' AND scope_type='project'");
		assert.deepEqual(await listAccountNotifications(pool, actor), []);
	});
});

test("installation health reports worker heartbeats and SMTP connectivity without sending email", async () => {
	const { readInstallationHealth, probeSmtp } = await import("../../packages/domain/src/installation.ts");
	const { startWorkerHealth } = await import("../../apps/worker/src/health.ts");
	await authFixture(async (fixture) => {
		const scope = await seedScope(fixture.db);
		await fixture.db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		await fixture.db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','instance',$1,'custom',ARRAY['settings.manage'])", [scope.installation]);
		const config = fixtureConfig(fixture);
		const before = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
		const initial = await readInstallationHealth(fixture.pool, { userId: "fixture-owner" }, scope.installation, config);
		assert.equal(initial.worker, "not_seen");
		assert.equal(initial.smtp, "ready");
		const heartbeat = startWorkerHealth(fixture.pool, 25);
		try {
			const deadline = Date.now() + 3000;
			while (!(await fixture.db.query("SELECT worker_seen_at FROM payloadbay.installation WHERE worker_seen_at IS NOT NULL")).rowCount) {
				assert.ok(Date.now() < deadline, "Worker must record a heartbeat");
				await new Promise((resolve) => setTimeout(resolve, 20));
			}

			assert.equal((await readInstallationHealth(fixture.pool, { userId: "fixture-owner" }, scope.installation, config)).worker, "recent");
		} finally {
			await heartbeat.stop();
		}

		await fixture.db.query("UPDATE payloadbay.installation SET worker_seen_at=clock_timestamp()-interval '2 minutes'");
		assert.equal((await readInstallationHealth(fixture.pool, { userId: "fixture-owner" }, scope.installation, config)).worker, "not_seen");
		assert.equal(await probeSmtp({ smtp: { ...config.smtp, host: "127.0.0.1", port: 1 } }), "unavailable");
		const after = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
		assert.equal(after.total, before.total, "Connectivity checks do not send email");
	});
});

test("account notification pagination applies scoped token restrictions before its result limit", async () => {
	const { listAccountNotifications, reconcileCondition } = await import("../../packages/domain/src/notifications.ts");
	const { createToken, authenticateToken } = await import("../../packages/domain/src/tokens.ts");
	await authFixture(async ({ pool, db }) => {
		const scope = await seedScope(db);
		await db.query("UPDATE payloadbay.installation SET bootstrap_state='complete'");
		const sibling = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Sibling','sibling','fixture-owner') RETURNING id", [scope.workspace])).rows[0].id;
		await db.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES('fixture-owner','project',$1,'custom',ARRAY['notifications.read','tokens.manage']),('fixture-owner','project',$2,'custom',ARRAY['notifications.read'])", [scope.project, sibling]);
		const notice = await reconcileCondition(pool, {
			key: "scoped-project",
			revision: "1",
			kind: "fixture",
			scope: { type: "project", id: scope.project },
			subject: "Scoped project alert",
			severity: "warning",
			active: true,
		});
		await db.query("UPDATE payloadbay.notification_incident SET first_seen=clock_timestamp()-interval '1 hour' WHERE id=$1", [notice.id]);
		await db.query("INSERT INTO payloadbay.notification_incident(condition_key,revision,kind,scope_type,scope_id,subject,severity,status) SELECT 'sibling-'||n,'1','fixture','project',$1,'Sibling alert','info','active' FROM generate_series(1,210) n", [sibling]);
		const key = await createToken(
			pool,
			{ userId: "fixture-owner" },
			{
				scope: { type: "project", id: scope.project },
				name: "Scoped notifications",
				permissions: ["notifications.read"],
				expiresAt: new Date(Date.now() + 3600000),
			},
		);
		const actor = await authenticateToken(pool, key.secret);
		assert.ok(actor);
		assert.deepEqual(
			(await listAccountNotifications(pool, actor)).map((item) => item.id),
			[notice.id],
		);
	});
});
