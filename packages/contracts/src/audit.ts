import { z } from "zod";
import { middlewareScope } from "./code.ts";

export const auditPageSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			actor: z.string(),
			operation: z.string(),
			scope: middlewareScope,
			resourceId: z.string().nullable(),
			createdAt: z.iso.datetime(),
		}),
	),
	nextCursor: z.string().nullable(),
});

export type AuditPage = z.infer<typeof auditPageSchema>;
