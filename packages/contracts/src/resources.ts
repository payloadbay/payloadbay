import { z } from "zod";
import { permissions } from "./permissions.ts";

export const scopeSchema = z.object({ type: z.enum(["instance", "organization", "workspace", "project"]), id: z.uuid() }).strict();

export const resourceInput = z.object({ parentId: z.uuid(), name: z.string().trim().min(1).max(100), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/) }).strict();

export const tokenInput = z
	.object({
		scope: scopeSchema,
		name: z.string().trim().min(1).max(100),
		permissions: z.array(z.enum(permissions)).max(permissions.length),
		expiresAt: z.iso.datetime(),
	})
	.strict();

export const grantInput = z
	.object({
		scope: scopeSchema,
		userId: z.string().min(1).max(256),
		role: z.enum(["owner", "admin", "operator", "viewer", "custom"]),
		permissions: z.array(z.enum(permissions)).max(permissions.length),
	})
	.strict();
