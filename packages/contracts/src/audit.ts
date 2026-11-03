import { z } from "zod";
import { middlewareScope } from "./code.ts";

export const auditPageSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			actor: z.string(),
			actorName: z.string().nullable(),
			operation: z.string(),
			scope: middlewareScope,
			resourceId: z.string().nullable(),
			resourceName: z.string().nullable(),
			scopeName: z.string().nullable(),
			createdAt: z.iso.datetime(),
		}),
	),
	nextCursor: z.string().nullable(),
});

export type AuditPage = z.infer<typeof auditPageSchema>;
