import { z } from "zod";
import { pageQuery } from "./api.ts";
import { scopeSchema } from "./resources.ts";
import { middlewareScope } from "./code.ts";
import { usageWindowInput } from "./usage.ts";

const scopeQuery = z.object({ scopeType: scopeSchema.shape.type, scopeId: scopeSchema.shape.id });
const states = z.array(z.enum(["queued", "running", "retry_wait", "succeeded", "failed_terminal", "reject", "respondOnly", "error", "accept", "delivered", "delivery_failed"])).optional();
const selection = z.object({
	projectId: z.uuid().optional(),
	workspaceId: z.uuid().optional(),
	endpointId: z.uuid().optional(),
	publicationId: z.uuid().optional(),
	state: states,
});
const events = selection.extend({ ...pageQuery.shape, view: z.enum(["requests", "attempts"]).default("requests") });

/** Recognized HTTP filters, reusing canonical scope, page and usage primitives. */
export const apiQuerySchemas: Record<string, z.ZodType> = {
	"/api/v1/changes": z.object({
		scopeType: z.enum(["instance", "workspace", "project", "accessible"]),
		scopeId: z.uuid(),
		after: z
			.string()
			.regex(/^[0-9]+$/)
			.optional(),
	}),
	"/api/v1/endpoints/{endpointId}/publications": z.object({ id: z.uuid().optional() }),
	"/api/v1/events": events,
	"/api/v1/events/replay-selection": selection,
	"/api/v1/invitations": scopeQuery,
	"/api/v1/members": scopeQuery,
	"/api/v1/middleware": z.object({ scopeType: middlewareScope.shape.type, scopeId: middlewareScope.shape.id }),
	"/api/v1/notification-channels/{channelId}": z.object({ revisionId: z.uuid().optional() }),
	"/api/v1/notifications": z.object({ scopeType: z.enum(["instance", "workspace", "project"]), scopeId: z.uuid() }),
	"/api/v1/organizations/{organizationId}/usage": usageWindowInput,
	"/api/v1/projects/{projectId}/events": events.omit({ projectId: true, workspaceId: true }),
	"/api/v1/projects": z.object({ workspaceId: z.uuid().optional() }),
	"/api/v1/secrets": scopeQuery,
	"/api/v1/shared-code": scopeQuery,
	"/api/v1/tokens": scopeQuery,
};
