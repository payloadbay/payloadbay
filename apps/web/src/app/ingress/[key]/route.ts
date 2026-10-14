import { getServices } from "@lib/server";
import { ingressHttp } from "@domain/ingress-http";
import { executeSource } from "@domain/executor-client";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
	const { pool, config } = getServices();

	return ingressHttp(pool, request, (await params).key, {
		encryptionKey: config.encryptionKey,
		bodyLimit: config.bodyLimit,
		headerLimit: config.headerLimit,
		deadlineMs: config.ingressDeadlineMs,
		maxAttempts: config.maxAttempts,
		run: (options: Parameters<typeof executeSource>[1]) => executeSource(config, options),
	});
}
