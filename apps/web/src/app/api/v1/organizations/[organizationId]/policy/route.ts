import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { readJson } from "@api/handler";
import { organizationPolicyInput } from "@contracts/organization-policy";
import { readOrganizationPolicy, setOrganizationPolicy } from "@domain/organization-policy";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => readOrganizationPolicy(pool, actor, uuid((await params).organizationId)));
}

export async function PUT(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const organizationId = uuid((await params).organizationId);
		const input = await readJson(request, organizationPolicyInput.omit({ organizationId: true }));

		return setOrganizationPolicy(pool, actor, { ...input, organizationId });
	});
}
