import { z } from "zod";
import { apiRequestSchemas, versionedOperations } from "./api-request-schemas.ts";
import { errorEnvelope } from "./api.ts";
import { apiOperations } from "./api-operations.ts";
import { configuredInstallationSettingsSchema, installationHealthSchema } from "./installation.ts";
import { auditPageSchema } from "./audit.ts";
import { jobAdministrationSchema } from "./jobs.ts";
import { apiQuerySchemas } from "./api-query-schemas.ts";

type Operation = {
	operationId: string;
	summary: string;
	tags: string[];
	security: ({ apiToken: never[] } | { session: never[] })[];
	parameters: {
		in: string;
		name: string;
		required: boolean;
		schema: unknown;
		style?: "form";
		explode?: boolean;
	}[];
	requestBody?: unknown;
	responses: Record<string, unknown>;
};

const names: Record<string, string> = {
	bootstrap: "Installation setup",
	changes: "Live updates",
	"delivery-attempts": "Delivery attempts",
	destinations: "Destinations",
	"email-settings": "Email settings",
	endpoints: "Ingress routes",
	events: "Events and replay",
	invitations: "Invitations",
	jobs: "Jobs and queues",
	audit: "Audit log",
	installation: "Installation",
	health: "Installation health",
	me: "Current user",
	members: "Members",
	middleware: "Middleware",
	"notification-channels": "Notification modules",
	"notification-rules": "Notification rules",
	notifications: "Notifications",
	onboarding: "Customer onboarding",
	organizations: "Organizations",
	overview: "Traffic overview",
	projects: "Projects",
	secrets: "Secrets",
	"shared-code": "Shared helpers",
	tokens: "API tokens",
	workspaces: "Workspaces",
};

function parameterSchema(name: string, method: string) {
	if (name === "stage") return z.enum(["ingress", "processing"]);
	if (name === "token") return z.string().regex(/^[A-Za-z0-9_-]{43}$/);
	if (name === "channelId" && method !== "patch") return z.union([z.uuid(), z.literal("smtp")]);

	return z.uuid();
}

/** Public contract only: no installation credentials or tenant records. */
export function openApiDocument() {
	const paths: Record<string, Record<string, Operation>> = {};
	for (const [method, path] of apiOperations) {
		const resource = path.split("/")[3];
		const label = names[resource];
		const publicOperation = path === "/api/v1/bootstrap" || path === "/api/v1/invitations/token/{token}";
		const operation: Operation = {
			operationId: method + path.replace(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) => next?.toUpperCase() ?? ""),
			summary: `${method.toUpperCase()} ${path.slice(7)}`,
			tags: [label],
			security: publicOperation ? [] : [{ apiToken: [] }, { session: [] }],
			parameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
				in: "path",
				name: match[1],
				required: true,
				schema: z.toJSONSchema(parameterSchema(match[1], method), { target: "draft-2020-12" }),
			})),
			responses: {
				"200": { description: "Operation completed. Visibility and returned fields depend on the caller's permissions." },
				default: { description: "Request rejected with a safe error envelope.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
			},
		};
		const query = method === "get" ? apiQuerySchemas[path] : undefined;
		if (query) {
			const input = z.toJSONSchema(query, { target: "draft-2020-12", io: "input" });
			const output = z.toJSONSchema(query, { target: "draft-2020-12", io: "output" });
			for (const [name, schema] of Object.entries(output.properties ?? {}))
				operation.parameters.push({
					in: "query",
					name,
					required: input.required?.includes(name) ?? false,
					schema,
					style: "form",
					explode: true,
				});
		}

		const key = `${method} ${path}`;
		const input = apiRequestSchemas[key];
		if (input) operation.requestBody = { required: true, content: { "application/json": { schema: z.toJSONSchema(input, { target: "draft-2020-12", io: "input" }) } } };
		if (versionedOperations.has(key) || key === "put /api/v1/members")
			operation.parameters.push({
				in: "header",
				name: "if-match",
				required: versionedOperations.has(key),
				schema: { type: "string", pattern: '^"[1-9][0-9]*"$', examples: ['"1"'] },
			});
		if (path.endsWith("/replay") && method === "post")
			operation.parameters.push({
				in: "header",
				name: "idempotency-key",
				required: true,
				schema: {
					type: "string",
					minLength: 1,
					maxLength: 128,
					pattern: "^[^\\u0000-\\u001f]+$",
				},
			});

		if (method === "get" && path === "/api/v1/installation/settings") operation.responses["200"] = { description: "Instance settings.manage required. Configuration projection with editable OAuth client metadata; stored client secrets are excluded. SMTP remains deployment-managed.", content: { "application/json": { schema: z.toJSONSchema(configuredInstallationSettingsSchema, { target: "draft-2020-12" }) } } };
		if (method === "get" && path === "/api/v1/health") operation.responses["200"] = { description: "Instance settings.manage required. Database/schema and bounded executor probe; worker/SMTP delivery and host isolation are not attested.", content: { "application/json": { schema: z.toJSONSchema(installationHealthSchema, { target: "draft-2020-12" }) } } };
		if (method === "get" && path === "/api/v1/audit") operation.responses["200"] = { description: "audit.read required on the requested scope. Instance audit contains only platform actions; customer scope audit includes its descendants. Stored diffs are excluded.", content: { "application/json": { schema: z.toJSONSchema(auditPageSchema, { target: "draft-2020-12" }) } } };
		if (method === "get" && path === "/api/v1/jobs") operation.responses["200"] = { description: "Instance jobs.read required. Bounded platform-job metadata and currently due, unpaused processing backlog by priority. Queue ages are not provider acknowledgement latency.", content: { "application/json": { schema: z.toJSONSchema(jobAdministrationSchema, { target: "draft-2020-12" }) } } };
		if (method === "get" && path === "/api/v1/changes") operation.responses["200"] = { description: "Authorized durable change references and heartbeat comments. Reconnect with Last-Event-ID; an expired cursor requests an HTTP resync. Private payload bytes are never broadcast.", content: { "text/event-stream": { schema: { type: "string" } } } };
		if (method === "delete" && ["/api/v1/secrets/{secretId}", "/api/v1/tokens"].includes(path)) {
			delete operation.responses["200"];
			operation.responses["204"] = { description: "Revoked successfully. No response body." };
		}

		(paths[path] ??= {})[method] = operation;
	}

	return {
		openapi: "3.1.0",
		info: { title: "Payload Bay API", version: "0.1.0-alpha", description: "Installation-local API. Tokens retain their scope and intersect the user's current permissions. Cookie-authenticated commands require the same-origin Origin and x-payloadbay-csrf: 1 headers. Webhook ingress uses the separately configured receiving URL; the published script decides its HTTP behavior. Identity/passkey routes are provided by Better Auth under /api/auth." },
		servers: [{ url: "/" }],
		components: {
			securitySchemes: {
				apiToken: { type: "http", scheme: "bearer", description: "A scoped Payload Bay API token. Permissions are intersected with the current user grants." },
				session: {
					type: "apiKey",
					in: "cookie",
					name: "better-auth.session_token",
					description: "The current browser session. HTTPS deployments use Better Auth's secure cookie prefix. Commands also require the same-origin Origin and x-payloadbay-csrf: 1 headers.",
				},
			},
			schemas: { Error: z.toJSONSchema(errorEnvelope, { target: "draft-2020-12" }) },
		},
		paths,
	};
}
