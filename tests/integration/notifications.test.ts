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
	const { queueIncidentEmail } = await import("../../packages/domain/src/notification-mail.ts");
	await notificationMailFixture(async (fixture) => {
		await identity(fixture.db, "unrelated-reader");
		await fixture.db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,'unrelated-reader')", [fixture.scope.installation]);
		await fixture.db.query("INSERT INTO payloadbay.notification_subscription(rule_id,user_id,channel,enabled) VALUES($1,'unrelated-reader','smtp',true)", [fixture.rule.id]);
		const encryptionKey = fixtureConfig(fixture).encryptionKey;
		assert.equal(await queueIncidentEmail(fixture.pool, fixture.incident.id, encryptionKey), 1, "Only opted-in authorized recipients get a mail job");
		const repeats = await Promise.all(Array.from({ length: 4 }, () => queueIncidentEmail(fixture.pool, fixture.incident.id, encryptionKey)));
		assert.deepEqual(repeats, [0, 0, 0, 0]);
		const dispatches = (await fixture.db.query("SELECT * FROM payloadbay.notification_dispatch WHERE state='queued'")).rows;
		assert.equal(dispatches.length, 1);
		assert.equal(dispatches[0].user_id, "fixture-owner");
		const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE id=$1", [dispatches[0].platform_job_id])).rows[0];
		assert.equal(job.kind, "notification_mail");
		const { decryptPrivate } = await import("../../packages/domain/src/private-crypto.ts");
		assert.deepEqual(decryptPrivate(job.encrypted_payload, encryptionKey), { incidentId: fixture.incident.id, incidentGeneration: fixture.incident.generation, userId: "fixture-owner" });
		assert.equal((await fixture.db.query("SELECT count(*)::int AS count FROM graphile_worker.jobs")).rows[0].count, 1);
	});
});

test("U315 opted-in authorized recipient receives an SMTP incident summary", async () => {
	const { queueIncidentEmail } = await import("../../packages/domain/src/notification-mail.ts");
	const { mailTask } = await import("../../apps/worker/src/tasks/mail.ts");
	await notificationMailFixture(async (fixture) => {
		const before = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
		const previousIds = new Set(before.messages.map((message: { ID: string }) => message.ID));
		const config = fixtureConfig(fixture);
		await fixture.db.query("UPDATE payloadbay.notification_incident SET redacted_data=redacted_data||$2::jsonb WHERE id=$1", [fixture.incident.id, JSON.stringify({ payload: "private-webhook-payload", secret: "fixture-private-secret" })]);
		await queueIncidentEmail(fixture.pool, fixture.incident.id, config.encryptionKey);
		const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0];
		await mailTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
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
		await mailTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
		assert.equal((await fixture.db.query("SELECT state FROM payloadbay.notification_dispatch WHERE platform_job_id=$1", [job.id])).rows[0].state, "sent");
	});
});

test("U179 revoked access prevents already queued notification email", async () => {
	const { queueIncidentEmail } = await import("../../packages/domain/src/notification-mail.ts");
	const { mailTask } = await import("../../apps/worker/src/tasks/mail.ts");
	for (const revocation of ["grant", "admission"]) {
		await notificationMailFixture(async (fixture) => {
			const config = fixtureConfig(fixture);
			await queueIncidentEmail(fixture.pool, fixture.incident.id, config.encryptionKey);
			const job = (await fixture.db.query("SELECT * FROM payloadbay.platform_job WHERE kind='notification_mail'")).rows[0];
			const before = await (await fetch(fixture.mailUrl + "/api/v1/messages")).json();
			if (revocation === "grant") await fixture.db.query("UPDATE payloadbay.grant_record SET permissions=ARRAY[]::text[] WHERE user_id='fixture-owner'");
			else await fixture.db.query("UPDATE payloadbay.admission SET active=false WHERE user_id='fixture-owner'");
			await mailTask(fixture.pool, config)({ jobId: job.id, generation: job.generation });
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
	const { mailTask } = await import("../../apps/worker/src/tasks/mail.ts");
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
			taskList: { platform_job: mailTask(fixture.pool, config) },
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
