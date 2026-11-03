import { protectedRoute } from "@api/protected";
import { readInstallationHealth } from "@domain/installation";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];

		return readInstallationHealth(pool, actor, installation.id, config);
	});
}
