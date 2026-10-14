import test from "node:test";
import assert from "node:assert/strict";
import { authFixture, fixtureConfig } from "../helpers/auth-fixtures.ts";
import { createAuth } from "../../packages/domain/src/auth-runtime.ts";
import { seedPreviewDemo } from "../../packages/domain/src/preview-demo.ts";

test("U320 preview seed provisions a repeatable admitted demo owner and project", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const identity = createAuth(f.pool, config);
		try {
			await assert.rejects(seedPreviewDemo(f.pool, config, identity, { IS_PREVIEW: "true", NODE_ENV: "production" }), /only available in disposable previews/);
			assert.equal((await f.db.query('SELECT count(*)::int AS count FROM auth."user"')).rows[0].count, 0);
			const env = { IS_PREVIEW: "true", NODE_ENV: "development" };
			await seedPreviewDemo(f.pool, config, identity, env);
			await seedPreviewDemo(f.pool, config, identity, env);
			const users = (await f.db.query('SELECT id,email,"emailVerified" FROM auth."user"')).rows;
			assert.equal(users.length, 1);
			assert.equal(users[0].email, "reviewer@preview.payloadbay.test");
			assert.equal(users[0].emailVerified, true);
			assert.equal((await f.db.query("SELECT bootstrap_state FROM payloadbay.installation")).rows[0].bootstrap_state, "complete");
			assert.equal((await f.db.query("SELECT active FROM payloadbay.admission WHERE user_id=$1", [users[0].id])).rows[0].active, true);
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.workspace")).rows[0].count, 1);
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.project")).rows[0].count, 1);
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.endpoint")).rows[0].count, 1);
			await identity.api.sendVerificationOTP({ body: { email: users[0].email, type: "sign-in" } });
			assert.equal((await f.db.query("SELECT count(*)::int AS count FROM payloadbay.platform_job WHERE kind='otp_mail'")).rows[0].count, 1, "reviewers can use real queued OTP email without a maintainer account");
		} finally {
			await identity.close();
		}
	});
});

import { nextFixture } from "../helpers/next-fixture.ts";

test("U321 preview warning is shown by runtime mode and absent outside previews", async () => {
	await nextFixture(
		async (f) => {
			const html = await (await fetch(f.url + "/login")).text();
			assert.match(html, /Disposable PR preview/);
			assert.match(html, /Do not use production credentials or sensitive data/);
		},
		{ preview: true },
	);
	await nextFixture(async (f) => {
		const html = await (await fetch(f.url + "/login")).text();
		assert.doesNotMatch(html, /Disposable PR preview/);
	});
});

import { setGrant } from "../../packages/domain/src/membership.ts";
import { rolePermissions } from "../../packages/domain/src/authorization.ts";

test("U322 preview reviewer cannot be locked out by adding another owner then demoting the demo account", async () => {
	await authFixture(async (f) => {
		const config = fixtureConfig(f);
		const identity = createAuth(f.pool, config);
		const previous = process.env.IS_PREVIEW;
		try {
			await seedPreviewDemo(f.pool, config, identity, { IS_PREVIEW: "true", NODE_ENV: "development" });
			const owner = (await f.db.query('SELECT id FROM auth."user" WHERE email=$1', ["reviewer@preview.payloadbay.test"])).rows[0].id;
			const instance = (await f.db.query("SELECT id FROM payloadbay.installation")).rows[0].id;
			const other = (await identity.api.createUser({ body: { email: "other@preview.payloadbay.test", name: "Other Reviewer" } })).user;
			await f.db.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,$2,true)", [instance, other.id]);
			const scope = { type: "instance" as const, id: instance };
			await setGrant(
				f.pool,
				{ userId: owner },
				{
					scope,
					userId: other.id,
					role: "owner",
					permissions: rolePermissions.owner,
					expectedVersion: null,
				},
			);
			const version = (await f.db.query("SELECT version FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type='instance'", [owner])).rows[0].version;
			process.env.IS_PREVIEW = "true";
			await assert.rejects(
				setGrant(
					f.pool,
					{ userId: owner },
					{
						scope,
						userId: owner,
						role: "viewer",
						permissions: rolePermissions.viewer,
						expectedVersion: version,
					},
				),
				/Preview reviewer access cannot be removed/,
			);
		} finally {
			if (previous === undefined) delete process.env.IS_PREVIEW;
			else process.env.IS_PREVIEW = previous;
			await identity.close();
		}
	});
});
