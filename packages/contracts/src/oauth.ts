import { z } from "zod";

/** Built-in social providers in the pinned Better Auth runtime. */
export const oauthProviderNames = {
	apple: "Apple",
	atlassian: "Atlassian",
	cloudflare: "Cloudflare",
	cognito: "Amazon Cognito",
	discord: "Discord",
	dropbox: "Dropbox",
	facebook: "Facebook",
	figma: "Figma",
	github: "GitHub",
	gitlab: "GitLab",
	google: "Google",
	huggingface: "Hugging Face",
	kakao: "Kakao",
	kick: "Kick",
	line: "LINE",
	linear: "Linear",
	linkedin: "LinkedIn",
	microsoft: "Microsoft",
	naver: "Naver",
	notion: "Notion",
	paybin: "Paybin",
	paypal: "PayPal",
	polar: "Polar",
	railway: "Railway",
	reddit: "Reddit",
	roblox: "Roblox",
	salesforce: "Salesforce",
	slack: "Slack",
	spotify: "Spotify",
	tiktok: "TikTok",
	twitch: "Twitch",
	twitter: "X (Twitter)",
	vercel: "Vercel",
	vk: "VK",
	wechat: "WeChat",
	zoom: "Zoom",
} as const;

export type OAuthProvider = keyof typeof oauthProviderNames;

export const oauthProvider = z.enum(Object.keys(oauthProviderNames) as [OAuthProvider, ...OAuthProvider[]]);

export const oauthClient = z
	.object({
		clientId: z.string().trim().min(1).max(1024),
		clientSecret: z.string().min(1).max(4096).optional(),
		domain: z
			.string()
			.regex(/^[a-z0-9-]+\.auth(?:-fips)?\.[a-z0-9-]+\.amazoncognito\.com$/)
			.optional(),
		region: z
			.string()
			.regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/)
			.optional(),
		userPoolId: z
			.string()
			.regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d_[A-Za-z0-9]+$/)
			.optional(),
		tenantId: z
			.string()
			.regex(/^(?:common|organizations|consumers|[0-9a-fA-F-]{36}|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/)
			.optional(),
		environment: z.enum(["sandbox", "live", "production"]).optional(),
	})
	.strict();

export const oauthClients = z.partialRecord(oauthProvider, oauthClient).superRefine((clients, ctx) => {
	for (const [provider, client] of Object.entries(clients)) {
		for (const key of ["domain", "region", "userPoolId"] as const) {
			if (provider === "cognito" && !client[key]) ctx.addIssue({ code: "custom", path: [provider, key], message: "Required for Amazon Cognito" });
			if (provider !== "cognito" && client[key]) ctx.addIssue({ code: "custom", path: [provider, key], message: "Only supported for Amazon Cognito" });
		}

		if (client.tenantId && provider !== "microsoft") ctx.addIssue({ code: "custom", path: [provider, "tenantId"], message: "Only supported for Microsoft" });
		if (client.environment && !((provider === "paypal" && ["sandbox", "live"].includes(client.environment)) || (provider === "salesforce" && ["sandbox", "production"].includes(client.environment)))) ctx.addIssue({ code: "custom", path: [provider, "environment"], message: "Choose a valid provider environment" });
	}
});

export type OAuthClient = z.infer<typeof oauthClient>;
