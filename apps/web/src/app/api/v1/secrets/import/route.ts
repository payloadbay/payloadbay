import { secretImportInput } from "@contracts/http-inputs";
import { protectedRoute } from "@api/protected";
import { readJson } from "@api/handler";
import { importSecrets } from "@domain/secrets";

export async function POST(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => importSecrets(pool, actor, await readJson(request, secretImportInput), config.encryptionKey));
}
