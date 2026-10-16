import { createHash, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { permissions } from "../../contracts/src/permissions.ts";

export async function bootstrapOwner(pool: Pool, input: { userId: string; providedSecret: string; expectedSecret: string }) {
	assertSetupSecret(input.providedSecret, input.expectedSecret);

	return transaction(pool, async (client) => {
		await client.query("INSERT INTO payloadbay.installation DEFAULT VALUES ON CONFLICT(singleton) DO NOTHING");
		const installation = (await client.query("SELECT * FROM payloadbay.installation WHERE singleton FOR UPDATE")).rows[0];
		if (installation.bootstrap_state === "complete") throw new AppError("already_configured", 409, "Instance setup is already complete");
		const user = (await client.query('SELECT "emailVerified" FROM auth."user" WHERE id=$1', [input.userId])).rows[0];
		if (!user?.emailVerified) throw new AppError("email_verification_required", 403, "Verify your email before completing setup");
		await client.query("INSERT INTO payloadbay.admission(installation_id,user_id,active) VALUES($1,$2,true) ON CONFLICT(installation_id,user_id) DO UPDATE SET active=true", [installation.id, input.userId]);
		await client.query("INSERT INTO payloadbay.grant_record(user_id,scope_type,scope_id,role_preset,permissions) VALUES($1,'instance',$2,'owner',$3)", [input.userId, installation.id, [...permissions]]);
		const organization = (await client.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,'My organization','default',$2) RETURNING id", [installation.id, input.userId])).rows[0];
		const workspace = (await client.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Default workspace','default',$3) RETURNING id", [installation.id, organization.id, input.userId])).rows[0];
		await client.query("UPDATE payloadbay.installation SET bootstrap_state='complete' WHERE id=$1", [installation.id]);
		await client.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation) VALUES($1,'instance',$2,'installation.bootstrap')", [input.userId, installation.id]);

		return {
			installationId: installation.id,
			userId: input.userId,
			organizationId: organization.id,
			workspaceId: workspace.id,
		};
	});
}

export function assertSetupSecret(providedSecret: string, expectedSecret: string) {
	if (!timingSafeEqual(createHash("sha256").update(providedSecret).digest(), createHash("sha256").update(expectedSecret).digest())) throw new AppError("invalid_setup_secret", 403, "Setup credentials are invalid");
}
