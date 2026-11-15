import { z } from "zod";

export const smtpSchema = z
	.object({
		host: z.string().min(1),
		port: z.number().int().min(1).max(65535),
		secure: z.boolean(),
		user: z.string().min(1).optional(),
		password: z.string().min(1).optional(),
		from: z.string().min(1),
	})
	.superRefine((value, ctx) => {
		if (Boolean(value.user) !== Boolean(value.password)) ctx.addIssue({ code: "custom", message: "SMTP authentication requires user and password" });
	});
