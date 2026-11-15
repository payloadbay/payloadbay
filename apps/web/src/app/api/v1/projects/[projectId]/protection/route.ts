import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { ingressPolicyUpdate } from "@contracts/ingress-policy";
import { getIngressPolicy, saveIngressPolicy } from "@domain/ingress-policy";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => getIngressPolicy(pool, actor, { type: "project", id: uuid((await params).projectId) }, config.encryptionKey));
}

export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => saveIngressPolicy(pool, actor, { type: "project", id: uuid((await params).projectId) }, await readJson(request, ingressPolicyUpdate), config.encryptionKey));
}
