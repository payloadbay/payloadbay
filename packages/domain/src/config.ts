import { z } from "zod";
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
	const oauth: Record<string, { clientId: string; clientSecret: string }> = {};
	for (const provider of ["GOOGLE", "GITHUB"]) {
		const clientId = env[provider + "_CLIENT_ID"];
		const clientSecret = env[provider + "_CLIENT_SECRET"];
		if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error("OAuth configuration is incomplete");
		if (clientId && clientSecret) oauth[provider.toLowerCase()] = { clientId, clientSecret };
	}

	return { smtp: smtp.data, oauth };
}

const httpUrl = z.string().refine((value) => {
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
});
const serverSchema = z.object({
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
	bodyLimit: z.coerce.number().int().min(1).max(1048576),
	headerLimit: z.coerce.number().int().min(1).max(16384),
	ingressDeadlineMs: z.coerce.number().int().min(100).max(10000),
	processingDeadlineMs: z.coerce.number().int().min(100).max(60000),
	httpTimeoutMs: z.coerce.number().int().min(100).max(30000),
	maxAttempts: z.coerce.number().int().min(1).max(20),
	otpRequestLimit: z.coerce.number().int().min(1).max(100),
});

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
		bodyLimit: env.PAYLOADBAY_BODY_LIMIT ?? 1048576,
		headerLimit: env.PAYLOADBAY_HEADER_LIMIT ?? 16384,
		ingressDeadlineMs: env.PAYLOADBAY_INGRESS_DEADLINE_MS ?? 2000,
		processingDeadlineMs: env.PAYLOADBAY_PROCESSING_DEADLINE_MS ?? 30000,
		httpTimeoutMs: env.PAYLOADBAY_HTTP_TIMEOUT_MS ?? 10000,
		maxAttempts: env.PAYLOADBAY_MAX_ATTEMPTS ?? 5,
		otpRequestLimit: env.PAYLOADBAY_OTP_REQUEST_LIMIT ?? 5,
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
