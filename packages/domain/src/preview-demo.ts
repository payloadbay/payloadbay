import type { Pool } from "pg";
import type { ServerConfig } from "./config.ts";
import type { createAuth } from "./auth-runtime.ts";
import { bootstrapOwner } from "./bootstrap.ts";
import { createResource } from "./resources.ts";
import { createDestination } from "./destinations.ts";
import { unverifiedTemplate } from "../../script-sdk/src/templates/unverified.ts";
import { createEndpoint } from "./endpoints.ts";
import { previewReviewerEmail } from "./preview.ts";

/** Synthetic demo provisioning, intentionally unavailable in operator production mode. */
export async function seedPreviewDemo(pool: Pool, config: ServerConfig, identity: ReturnType<typeof createAuth>, env: Record<string, string | undefined> = process.env) {
	if (env.IS_PREVIEW !== "true" || env.NODE_ENV !== "development") throw Error("Demo seeding is only available in disposable previews");
	const db = await pool.connect();
	try {
		await db.query("SELECT pg_advisory_lock(hashtext('payloadbay:preview-seed:v1'))");
		const installation = (await db.query("SELECT id,bootstrap_state FROM payloadbay.installation WHERE singleton")).rows[0];
		let user = (await db.query('SELECT id FROM auth."user" WHERE email=$1', [previewReviewerEmail])).rows[0];
		if (installation?.bootstrap_state === "complete") {
			const demoOwner = user && (await db.query("SELECT 1 FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type='instance' AND scope_id=$2 AND role_preset='owner'", [user.id, installation.id])).rowCount;
			if (!demoOwner) throw Error("Preview seeding will not overwrite an existing operator installation");
		}

		if (!user) user = (await identity.api.createUser({ body: { email: previewReviewerEmail, name: "Preview Reviewer" } })).user;
		// This fixed synthetic identity belongs to a disposable demo, not an external mailbox.
		await db.query('UPDATE auth."user" SET "emailVerified"=true WHERE id=$1', [user.id]);
		const instance = installation?.bootstrap_state === "complete" ? installation : await bootstrapOwner(pool, { userId: user.id, providedSecret: config.bootstrapSecret, expectedSecret: config.bootstrapSecret });
		const installationId = instance.id ?? instance.installationId;
		const actor = { userId: user.id };
		let workspace = (await db.query("SELECT id FROM payloadbay.workspace WHERE installation_id=$1 AND slug='preview-demo'", [installationId])).rows[0];
		if (!workspace)
			workspace = await createResource(pool, actor, {
				type: "workspace",
				parentId: installationId,
				name: "Preview Demo",
				slug: "preview-demo",
			});
		let project = (await db.query("SELECT id FROM payloadbay.project WHERE workspace_id=$1 AND slug='webhook-playground'", [workspace.id])).rows[0];
		if (!project)
			project = await createResource(pool, actor, {
				type: "project",
				parentId: workspace.id,
				name: "Webhook Playground",
				slug: "webhook-playground",
			});
		if (!(await db.query("SELECT 1 FROM payloadbay.destination WHERE project_id=$1 AND name='Demo receiver'", [project.id])).rowCount) {
			await createDestination(pool, actor, {
				projectId: project.id,
				name: "Demo receiver",
				url: new URL("/api/preview/receiver", config.publicUrl).href,
				isDefault: true,
			});
		}

		if (!(await db.query("SELECT 1 FROM payloadbay.endpoint WHERE project_id=$1 AND slug='sample-webhook'", [project.id])).rowCount) {
			const endpoint = await createEndpoint(pool, actor, { projectId: project.id, name: "Sample Webhook", slug: "sample-webhook" });
			await db.query("UPDATE payloadbay.draft SET body=$2 WHERE endpoint_id=$1 AND stage='ingress'", [endpoint.id, unverifiedTemplate.body]);
		}
	} finally {
		await db.query("SELECT pg_advisory_unlock(hashtext('payloadbay:preview-seed:v1'))").catch(() => {});
		db.release();
	}
}
