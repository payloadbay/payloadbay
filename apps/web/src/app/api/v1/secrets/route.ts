import { z } from "zod";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { scopeSchema } from "@contracts/resources";
import { createSecret, listSecrets } from "@domain/secrets";
import { AppError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";
const input = z.object({ scope: scopeSchema, name: z.string().min(1).max(100), value: z.string().min(1).max(8192) }).strict();

export async function GET(request: Request) {
	return protectedRoute(request, ({ pool }, actor) => {
		const query = new URL(request.url).searchParams;
		const scope = scopeSchema.safeParse({ type: query.get("scopeType"), id: query.get("scopeId") });
		if (!scope.success) throw new AppError("invalid_input", 400, "Choose a valid secret scope");

		return listSecrets(pool, actor, scope.data);
	});
}

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => createSecret(pool, actor, await readJson(request, input), config.encryptionKey));
}
