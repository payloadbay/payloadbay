import { readJson } from "@api/handler";
import { editableConfiguration, saveInstallationConfiguration } from "@domain/installation-configuration";
import { installationUpdateInput } from "@contracts/installation";
import { protectedRoute } from "@api/protected";
import { readInstallationSettings } from "@domain/installation";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];

		return { ...(await readInstallationSettings(pool, actor, installation.id, config)), configuration: await editableConfiguration(pool, actor, installation.id, config) };
	});
}

export async function PUT(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];

		return saveInstallationConfiguration(pool, actor, installation.id, config, await readJson(request, installationUpdateInput));
	});
}
