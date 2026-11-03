import { protectedRoute } from "@api/protected";
import { uuid } from "@api/parameters";
import { AppError } from "@contracts/errors";
import type { ScopeRef } from "@domain/authorization";
import { listNotifications, listAccountNotifications, reconcileRuntimeNotice } from "@domain/notifications";
import { actorPermissions, requirePermission } from "@domain/membership";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const query = new URL(request.url).searchParams;
		if (query.get("account") === "true") {
			const installation = (await pool.query("SELECT id FROM payloadbay.installation WHERE singleton")).rows[0];
			if (installation && (!actor.token || actor.token.personal || actor.token.scope.type === "instance") && (await actorPermissions(pool, actor, { type: "instance", id: installation.id })).has("settings.manage")) await reconcileRuntimeNotice(pool, installation.id, config.executorMode);

			return listAccountNotifications(pool, actor);
		}

		const type = query.get("scopeType");
		if (type !== "instance" && type !== "workspace" && type !== "project") throw new AppError("invalid_scope", 400, "Choose a notification scope");
		const scope: ScopeRef = { type, id: uuid(query.get("scopeId") ?? "") };
		await requirePermission(pool, actor, scope, "notifications.read");
		if (type === "instance" && (await actorPermissions(pool, actor, scope)).has("settings.manage")) await reconcileRuntimeNotice(pool, scope.id, config.executorMode);

		return listNotifications(pool, actor, scope);
	});
}
