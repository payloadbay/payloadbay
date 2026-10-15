import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { acceptInvitation } from "@domain/invitations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => acceptInvitation(pool, actor, (await readJson(request, z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict())).token));
}
