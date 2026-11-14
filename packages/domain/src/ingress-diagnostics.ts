import type { PoolClient } from "pg";

export async function reserveIngressDiagnostic(db: PoolClient, organizationId: string, bodyBytes: number, headers: Record<string, string>, metadata: unknown) {
	await db.query(
		`WITH needed AS MATERIALIZED(SELECT $1::uuid AS id WHERE NOT EXISTS(SELECT 1 FROM payloadbay.ingress_diagnostic_budget WHERE organization_id=$1))
 INSERT INTO payloadbay.ingress_diagnostic_budget(organization_id,record_count,byte_count)
 SELECT needed.id,history.n,history.bytes FROM needed CROSS JOIN LATERAL (
 SELECT count(e.id) AS n,coalesce(sum(octet_length(e.original_body)+octet_length(e.headers::text)+octet_length(e.metadata::text)+1024),0) AS bytes
 FROM payloadbay.event e JOIN payloadbay.endpoint ep ON ep.id=e.endpoint_id JOIN payloadbay.project p ON p.id=ep.project_id JOIN payloadbay.workspace w ON w.id=p.workspace_id
 WHERE w.organization_id=needed.id AND e.ingress_outcome<>'accept') history ON CONFLICT DO NOTHING`,
		[organizationId],
	);
	const reserved = await db.query(
		`UPDATE payloadbay.ingress_diagnostic_budget SET record_count=record_count+1,byte_count=byte_count+$2::int+octet_length($3::jsonb::text)+octet_length($4::jsonb::text)+1024
 WHERE organization_id=$1 AND record_count<1000 AND byte_count+$2::int+octet_length($3::jsonb::text)+octet_length($4::jsonb::text)+1024<=16777216 RETURNING organization_id`,
		[organizationId, bodyBytes, JSON.stringify(headers), JSON.stringify(metadata)],
	);

	if (reserved.rowCount !== 1) await db.query("UPDATE payloadbay.ingress_diagnostic_budget SET omitted_count=CASE WHEN omitted_count<9223372036854775807 THEN omitted_count+1 ELSE omitted_count END WHERE organization_id=$1", [organizationId]);

	return reserved.rowCount === 1;
}
