import type { Client, PoolClient } from "pg";

export async function seedScope(db: Client | PoolClient) {
	const installation = (await db.query("INSERT INTO payloadbay.installation DEFAULT VALUES RETURNING id")).rows[0].id;
	await db.query("INSERT INTO payloadbay.admission(installation_id,user_id) VALUES($1,$2)", [installation, "fixture-owner"]);
	const organization = (await db.query("INSERT INTO payloadbay.organization(installation_id,name,slug,owner_user_id) VALUES($1,'Fixture organization','fixture','fixture-owner') RETURNING id", [installation])).rows[0].id;
	const workspace = (await db.query("INSERT INTO payloadbay.workspace(installation_id,organization_id,name,slug,owner_user_id) VALUES($1,$2,'Fixture','fixture','fixture-owner') RETURNING id", [installation, organization])).rows[0].id;
	const project = (await db.query("INSERT INTO payloadbay.project(workspace_id,name,slug,owner_user_id) VALUES($1,'Fixture','fixture','fixture-owner') RETURNING id", [workspace])).rows[0].id;
	const endpoint = (await db.query("INSERT INTO payloadbay.endpoint(project_id,name,slug,ingress_key) VALUES($1,'Fixture','fixture',gen_random_uuid()::text) RETURNING id", [project])).rows[0].id;

	const revision = async (stage: string) => (await db.query("INSERT INTO payloadbay.stage_revision(stage,body,body_digest,sdk_version,bundle,bundle_digest,source_map) VALUES($1,'return ctx.complete();','fixture','1','fixture','fixture','{}') RETURNING id", [stage])).rows[0].id;

	const publication = (await db.query("INSERT INTO payloadbay.publication(endpoint_id,ingress_revision_id,processing_revision_id,dependency_digest,created_by) VALUES($1,$2,$3,'fixture','fixture-owner') RETURNING id", [endpoint, await revision("ingress"), await revision("processing")])).rows[0].id;
	await db.query("UPDATE payloadbay.endpoint SET active_publication_id=$1 WHERE id=$2", [publication, endpoint]);

	return {
		installation,
		organization,
		workspace,
		project,
		endpoint,
		publication,
	};
}

export async function seedEvent(db: Client | PoolClient, scope: { endpoint: string; publication: string }) {
	return (await db.query("INSERT INTO payloadbay.event(endpoint_id,publication_id,original_body,headers,content_type,accepted_body) VALUES($1,$2,$3,'{}','application/octet-stream',$3) RETURNING id", [scope.endpoint, scope.publication, Buffer.from([0, 255, 42])])).rows[0].id as string;
}
