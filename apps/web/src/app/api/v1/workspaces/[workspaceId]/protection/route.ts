import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { ingressPolicyUpdate } from "@contracts/ingress-policy";
import { getIngressPolicy, saveIngressPolicy } from "@domain/ingress-policy";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => getIngressPolicy(pool, actor, { type: "workspace", id: uuid((await params).workspaceId) }, config.encryptionKey));
}

export async function PUT(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => saveIngressPolicy(pool, actor, { type: "workspace", id: uuid((await params).workspaceId) }, await readJson(request, ingressPolicyUpdate), config.encryptionKey));
}
