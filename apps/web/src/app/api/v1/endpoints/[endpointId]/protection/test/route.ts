import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { protectionTestInput } from "@contracts/ingress-policy";
import { testIngressPolicy } from "@domain/ingress-policy";

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => testIngressPolicy(pool, actor, { type: "endpoint", id: uuid((await params).endpointId) }, await readJson(request, protectionTestInput), config.encryptionKey));
}
