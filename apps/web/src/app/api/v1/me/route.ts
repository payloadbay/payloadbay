import { passkeyEnrollmentRequired, passkeyPolicyRequired } from "@domain/organization-security";
import { protectedRoute } from "@api/protected";
import { actorPermissions } from "@domain/membership";
import { rolePermissions } from "@domain/authorization";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool }, actor) => {
		const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton AND bootstrap_state='complete'")).rows[0];
		const user = (await pool.query('SELECT id,name,email FROM auth."user" WHERE id=$1', [actor.userId])).rows[0];

		return {
			user,
			passkeyEnrollmentRequired: await passkeyEnrollmentRequired(pool, actor.userId),
			passkeyRequired: await passkeyPolicyRequired(pool, actor.userId),
			instanceId: installation.id,
			permissions: [...(await actorPermissions(pool, actor, { type: "instance", id: installation.id }))],
			roles: rolePermissions,
		};
	});
}
