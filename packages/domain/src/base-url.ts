type Environment = Record<string, string | undefined>;

/** Adapted from Clipify's src/app/lib/baseUrl.ts; read only deployment configuration. */
export function resolveBaseUrl(env: Environment = process.env): URL {
	const configured = env.PUBLIC_URL || env.NEXT_PUBLIC_BASE_URL;
	const coolifyRuntime = Boolean(env.COOLIFY_RESOURCE_UUID || env.COOLIFY_CONTAINER_NAME);
	const usesCoolifyUrl = Boolean(env.COOLIFY_URL && (coolifyRuntime || !configured));
	let url = configured || "http://localhost:3000";
	if (usesCoolifyUrl) {
		const parts = env
			.COOLIFY_URL!.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		url = parts[0] || env.COOLIFY_URL!.trim();
	}

	if (!/^https?:\/\//.test(url)) url = `http://${url}`;
	if (usesCoolifyUrl) url = `https://${new URL(url).hostname}`;

	return new URL(url);
}
