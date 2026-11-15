import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { resourceInput } from "@contracts/resources";
import { listResources, createResource } from "@domain/resources";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, ({ pool }, actor) => {
		const raw = new URL(request.url).searchParams.get("workspaceId");
		const parsed = z
			.uuid()
			.optional()
			.safeParse(raw ?? undefined);
		if (!parsed.success) throw new AppError("invalid_input", 400, "Invalid workspace");

		return listResources(pool, actor, "project", parsed.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => createResource(pool, actor, { ...(await readJson(request, resourceInput)), type: "project" }));
}
