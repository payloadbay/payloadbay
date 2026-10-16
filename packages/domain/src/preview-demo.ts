import type { Pool } from "pg";
import type { ServerConfig } from "./config.ts";
import type { createAuth } from "./auth-runtime.ts";
import { bootstrapOwner } from "./bootstrap.ts";
import { createResource } from "./resources.ts";
import { createDestination } from "./destinations.ts";
import { unverifiedHttpTemplate } from "../../script-sdk/src/templates/unverified.ts";
import { createSharedVersion } from "./shared-code.ts";
import { publish } from "./publication.ts";
import { receiveIngress } from "./ingress.ts";
import { execute } from "../../../apps/executor/src/supervisor.ts";
import { compile } from "../../../apps/executor/src/compiler.ts";
import { createEndpoint } from "./endpoints.ts";
import { previewReviewerEmail, previewProjectAccounts } from "./preview.ts";

import { rolePermissions } from "./authorization.ts";
import { setGrant } from "./membership.ts";

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
		if (!workspace) workspace = (await db.query("UPDATE payloadbay.workspace w SET name='Preview Demo',slug='preview-demo' FROM payloadbay.organization o WHERE w.organization_id=o.id AND w.installation_id=$1 AND o.slug='default' AND w.slug='default' RETURNING w.id", [installationId])).rows[0];
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
				name: "Demo integrations",
				slug: "webhook-playground",
			});
		if (!(await db.query("SELECT 1 FROM payloadbay.project WHERE workspace_id=$1 AND slug='admin-only'", [workspace.id])).rowCount) {
			await createResource(pool, actor, {
				type: "project",
				parentId: workspace.id,
				name: "Admin-only example",
				slug: "admin-only",
			});
		}

		for (const account of previewProjectAccounts) {
			let member = (await db.query('SELECT id FROM auth."user" WHERE email=$1', [account.email])).rows[0];
			if (!member) member = (await identity.api.createUser({ body: { email: account.email, name: account.name } })).user;
			await db.query('UPDATE auth."user" SET "emailVerified"=true WHERE id=$1', [member.id]);
			await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,$2) ON CONFLICT(installation_id,user_id) DO NOTHING", [installationId, member.id]);
			if (!(await db.query("SELECT 1 FROM payloadbay.grant_record WHERE user_id=$1 AND scope_type='project' AND scope_id=$2", [member.id, project.id])).rowCount) {
				await setGrant(pool, actor, {
					scope: { type: "project", id: project.id },
					userId: member.id,
					role: account.role,
					permissions: rolePermissions[account.role],
					expectedVersion: null,
				});
			}
		}

		if (!(await db.query("SELECT 1 FROM payloadbay.destination WHERE project_id=$1 AND name='Demo receiver'", [project.id])).rowCount) {
			await createDestination(pool, actor, {
				projectId: project.id,
				name: "Demo receiver",
				url: new URL("/api/preview/receiver", config.publicUrl).href,
				isDefault: true,
			});
		}

		if (!(await db.query("SELECT 1 FROM payloadbay.shared_module_revision WHERE scope_type='project' AND scope_id=$1 AND name='DemoHelpers'", [project.id])).rowCount) {
			await createSharedVersion(pool, actor, {
				scope: { type: "project", id: project.id },
				name: "DemoHelpers",
				source: 'export function describe(body: Uint8Array): string {\n\treturn "Received: " + new TextDecoder().decode(body).slice(0, 120);\n}\n',
				compile,
			});
		}

		let createdSample = false;
		if (!(await db.query("SELECT 1 FROM payloadbay.endpoint WHERE project_id=$1 AND slug='sample-webhook'", [project.id])).rowCount) {
			createdSample = true;
			const endpoint = await createEndpoint(pool, actor, { projectId: project.id, name: "Sample Webhook", slug: "sample-webhook" });
			await db.query("UPDATE payloadbay.draft SET body=$2 WHERE endpoint_id=$1 AND stage='ingress'", [endpoint.id, unverifiedHttpTemplate.source]);
		}

		const endpoint = (await db.query("SELECT id,ingress_key,config_version,active_publication_id FROM payloadbay.endpoint WHERE project_id=$1 AND slug='sample-webhook'", [project.id])).rows[0];
		if (createdSample && !endpoint.active_publication_id) {
			const drafts = (await db.query("SELECT stage,version FROM payloadbay.draft WHERE endpoint_id=$1", [endpoint.id])).rows;
			await publish(pool, actor, {
				endpointId: endpoint.id,
				expectedVersion: endpoint.config_version,
				draftVersions: Object.fromEntries(drafts.map((draft) => [draft.stage, draft.version])) as { ingress: number; processing: number },
				compile,
			});
		}

		const publication = (await db.query("SELECT effective_bindings FROM payloadbay.publication WHERE id=(SELECT active_publication_id FROM payloadbay.endpoint WHERE id=$1)", [endpoint.id])).rows[0];
		if (createdSample && (publication?.effective_bindings ?? []).length === 0 && !(await db.query("SELECT 1 FROM payloadbay.event WHERE endpoint_id=$1", [endpoint.id])).rowCount) {
			for (const type of ["demo.purchase.completed", "demo.account.created"]) {
				await receiveIngress(
					pool,
					{
						key: endpoint.ingress_key,
						method: "POST",
						url: new URL("/ingress/" + endpoint.ingress_key, config.publicUrl).href,
						headers: { "content-type": "application/json" },
						body: new TextEncoder().encode(JSON.stringify({ type, synthetic: true, source: "Payload Bay preview" })),
					},
					{ encryptionKey: config.encryptionKey, deadlineMs: 10000, run: execute },
				);
			}
		}
	} finally {
		await db.query("SELECT pg_advisory_unlock(hashtext('payloadbay:preview-seed:v1'))").catch(() => {});
		db.release();
	}
}
