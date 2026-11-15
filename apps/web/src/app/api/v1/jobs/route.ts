import { protectedRoute } from "@api/protected";
import { readJobAdministration } from "@domain/overview";
import { jobAdministrationSchema } from "@contracts/jobs";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];

		return jobAdministrationSchema.parse(await readJobAdministration(pool, actor, installation.id));
	});
}
