import { z } from "zod";
import { installationPolicySettings } from "../../contracts/src/installation.ts";
import type { OAuthClient } from "../../contracts/src/oauth.ts";
import { smtpSchema } from "../../contracts/src/config.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { resolveBaseUrl } from "./base-url.ts";

export function readConfig(env: Record<string, string | undefined>) {
	if (env.SMTP_SECURE !== undefined && !["true", "false"].includes(env.SMTP_SECURE)) throw Error("SMTP TLS configuration is invalid");
	const smtp = smtpSchema.safeParse({
		host: env.SMTP_HOST,
		port: Number(env.SMTP_PORT),
		secure: env.SMTP_SECURE === "true",
		user: env.SMTP_USER || undefined,
		password: env.SMTP_PASSWORD || undefined,
		from: env.SMTP_FROM,
	});
	if (!smtp.success) throw new Error("SMTP configuration is incomplete or invalid");
	const oauth: Record<string, OAuthClient> = {};

	return { smtp: smtp.data, oauth };
}

const httpUrl = z.string().refine((value) => {
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
});
const serverSchema = z
	.object({
		databaseUrl: z.string().refine((value) => {
			try {
				return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
			} catch {
				return false;
			}
		}),
		publicUrl: httpUrl,
		authSecret: z.string().min(32),
		encryptionKey: z.string().min(32),
		bootstrapSecret: z.string().min(32),
		executorToken: z.string().min(32),
		brokerSecret: z.string().min(32),
		executorUrl: httpUrl,
		executorMode: z.enum(["runc", "runsc"]),
	})
	.extend(installationPolicySettings.shape);

export function readServerConfig(env: Record<string, string | undefined>) {
	let publicUrl: string;
	try {
		publicUrl = resolveBaseUrl(env).href.replace(/\/$/, "");
	} catch {
		throw new AppError("configuration_required", 503, "Server configuration requires attention");
	}

	const parsed = serverSchema.safeParse({
		databaseUrl: env.DATABASE_URL,
		publicUrl,
		authSecret: env.BETTER_AUTH_SECRET,
		encryptionKey: env.PAYLOADBAY_ENCRYPTION_KEY,
		bootstrapSecret: env.PAYLOADBAY_BOOTSTRAP_SECRET,
		executorToken: env.PAYLOADBAY_EXECUTOR_TOKEN,
		brokerSecret: env.PAYLOADBAY_BROKER_SECRET,
		executorUrl: env.EXECUTOR_URL ?? "http://executor:8080",
		executorMode: env.PAYLOADBAY_EXECUTOR_RUNTIME || "runc",
	});
	if (!parsed.success) throw new AppError("configuration_required", 503, "Server configuration requires attention");

	return { ...parsed.data, ...readConfig(env) };
}

export type ServerConfig = ReturnType<typeof readServerConfig>;

export function publicConfiguration(config: ServerConfig) {
	return {
		smtpConfigured: true,
		oauthProviders: Object.keys(config.oauth),
		executorMode: config.executorMode,
		limits: { body: config.bodyLimit, headers: config.headerLimit },
	};
}
