import type { Pool, PoolClient } from "pg";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry } from "./membership.ts";
import type { Actor } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { secretForUse } from "./secrets.ts";

export type DestinationInput = {
	projectId: string;
	name: string;
	url: string;
	method?: string;
	headers?: Record<string, string>;
	secretRefs?: { header: string; secretVersionId: string }[];
	concurrency?: number;
	isDefault?: boolean;
};

function configuration(input: DestinationInput) {
	let url: URL;
	try {
		url = new URL(input.url);
	} catch {
		throw new AppError("invalid_target", 400, "Provide an HTTP or HTTPS destination");
	}

	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new AppError("invalid_target", 400, "Provide an HTTP or HTTPS URL without embedded credentials");
	const method = input.method ?? "POST";
	if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) throw new AppError("invalid_method", 400, "Choose a supported HTTP method");
	if (!input.name.trim() || input.name.length > 100) throw new AppError("invalid_input", 400, "Provide a destination name");
	const concurrency = input.concurrency ?? 4;
	if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) throw new AppError("invalid_input", 400, "Choose concurrency from 1 to 64");
	let headers: Headers;
	try {
		headers = new Headers(input.headers);
	} catch {
		throw new AppError("invalid_headers", 400, "Provide valid HTTP headers");
	}

	return {
		url: url.toString(),
		method,
		headers: Object.fromEntries(headers),
		concurrency,
	};
}

export async function createDestination(pool: Pool, actor: Actor, input: DestinationInput) {
	const http = configuration(input);

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "project", id: input.projectId }, "destinations.configure");
		await db.query("SELECT id FROM payloadbay.project WHERE id=$1 FOR UPDATE", [input.projectId]);
		const ancestry = await scopeAncestry(db, { type: "project", id: input.projectId });
		for (const ref of input.secretRefs ?? []) {
			const secret = await secretForUse(db, actor, ref.secretVersionId);
			if (!ancestry.some((scope) => scope.type === secret.scope_type && scope.id === secret.scope_id)) throw new AppError("invalid_secret_binding", 400, "Secret is outside this project scope");
			try {
				new Headers({ [ref.header]: "value" });
			} catch {
				throw new AppError("invalid_headers", 400, "Choose a valid secret header");
			}
		}

		const hasDefault = (await db.query("SELECT id FROM payloadbay.destination WHERE project_id=$1 AND is_default", [input.projectId])).rowCount !== 0;
		const isDefault = input.isDefault ?? !hasDefault;
		if (isDefault) await db.query("UPDATE payloadbay.destination SET is_default=false,version=version+1 WHERE project_id=$1 AND is_default", [input.projectId]);
		const result = (await db.query("INSERT INTO payloadbay.destination(project_id,name,http_config,secret_refs,concurrency,is_default) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,version,is_default,concurrency", [input.projectId, input.name.trim(), JSON.stringify({ url: http.url, method: http.method, headers: http.headers }), JSON.stringify(input.secretRefs ?? []), http.concurrency, isDefault])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'destination.created',$3,$4)", [actor.userId, input.projectId, result.id, JSON.stringify({ resourceName: result.name })]);

		return result;
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("name_conflict", 409, "Destination name already exists in this project");
		throw error;
	});
}

export async function listDestinations(pool: Pool, actor: Actor, projectId: string) {
	await requirePermission(pool, actor, { type: "project", id: projectId }, "metadata.read");

	return (await pool.query("SELECT id,name,is_default,concurrency,version FROM payloadbay.destination WHERE project_id=$1 ORDER BY name,id LIMIT 200", [projectId])).rows;
}

export async function getDestination(pool: Pool | PoolClient, actor: Actor, id: string) {
	const row = (await pool.query("SELECT * FROM payloadbay.destination WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Destination unavailable");
	await requirePermission(pool, actor, { type: "project", id: row.project_id }, "destinations.configure");

	return {
		id: row.id,
		projectId: row.project_id,
		name: row.name,
		http: row.http_config,
		secretRefs: row.secret_refs,
		concurrency: row.concurrency,
		isDefault: row.is_default,
		version: row.version,
	};
}

export async function updateDestination(pool: Pool, actor: Actor, input: DestinationInput & { id: string; expectedVersion: number }) {
	const http = configuration(input);

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, { type: "project", id: input.projectId }, "destinations.configure");
		await db.query("SELECT id FROM payloadbay.project WHERE id=$1 FOR UPDATE", [input.projectId]);
		const row = (await db.query("SELECT * FROM payloadbay.destination WHERE id=$1 AND project_id=$2 FOR UPDATE", [input.id, input.projectId])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Destination unavailable");
		if (row.version !== input.expectedVersion) throw new AppError("version_conflict", 409, "Destination changed; reload before saving");
		const ancestry = await scopeAncestry(db, { type: "project", id: input.projectId });
		for (const ref of input.secretRefs ?? []) {
			const secret = await secretForUse(db, actor, ref.secretVersionId);
			if (!ancestry.some((scope) => scope.type === secret.scope_type && scope.id === secret.scope_id)) throw new AppError("invalid_secret_binding", 400, "Secret is outside this project scope");
			try {
				new Headers({ [ref.header]: "value" });
			} catch {
				throw new AppError("invalid_headers", 400, "Choose a valid secret header");
			}
		}

		if (input.isDefault) await db.query("UPDATE payloadbay.destination SET is_default=false,version=version+1 WHERE project_id=$1 AND id<>$2 AND is_default", [input.projectId, input.id]);
		const result = (await db.query("UPDATE payloadbay.destination SET name=$3,http_config=$4,secret_refs=$5,concurrency=$6,is_default=COALESCE($7,is_default),version=version+1 WHERE id=$1 AND project_id=$2 RETURNING id,name,version,is_default,concurrency", [input.id, input.projectId, input.name.trim(), JSON.stringify({ url: http.url, method: http.method, headers: http.headers }), JSON.stringify(input.secretRefs ?? []), http.concurrency, input.isDefault ?? null])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'destination.updated',$3,$4)", [actor.userId, input.projectId, result.id, JSON.stringify({ resourceName: result.name })]);

		return result;
	}).catch((error) => {
		if (error?.code === "23505") throw new AppError("name_conflict", 409, "Destination name already exists in this project");
		throw error;
	});
}

export async function deleteDestination(pool: Pool, actor: Actor, id: string, expectedVersion: number) {
	return transaction(pool, async (db) => {
		const existing = await getDestination(pool, actor, id);
		await db.query("SELECT id FROM payloadbay.project WHERE id=$1 FOR UPDATE", [existing.projectId]);
		const row = (await db.query("SELECT * FROM payloadbay.destination WHERE id=$1 FOR UPDATE", [id])).rows[0];
		if (!row) throw new AppError("not_found", 404, "Destination unavailable");
		if (row.version !== expectedVersion) throw new AppError("version_conflict", 409, "Destination changed; reload before deleting");
		const used = await db.query("SELECT 1 FROM payloadbay.publication WHERE destination_snapshot ? $1::text UNION ALL SELECT 1 FROM payloadbay.notification_rule WHERE destination_id=$1::uuid LIMIT 1", [id]);
		if (used.rowCount) throw new AppError("resource_in_use", 409, "This destination is referenced by a publication or notification rule. Its history must be preserved.");
		await db.query("DELETE FROM payloadbay.destination WHERE id=$1", [id]);
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,'project',$2,'destination.deleted',$3,$4)", [actor.userId, existing.projectId, id, JSON.stringify({ resourceName: row.name })]);

		return { deleted: true };
	});
}
