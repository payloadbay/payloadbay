import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { uuid } from "@api/parameters";
import { organizationSecurityInput } from "@contracts/organization-policy";
import { readOrganizationSecurity, saveOrganizationSecurity } from "@domain/organization-security";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => readOrganizationSecurity(pool, actor, uuid((await params).organizationId)));
}

export async function PUT(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => saveOrganizationSecurity(pool, actor, uuid((await params).organizationId), await readJson(request, organizationSecurityInput)));
}
