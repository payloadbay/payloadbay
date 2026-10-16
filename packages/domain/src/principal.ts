import type { Pool } from "pg";
import type { createAuth } from "./auth-runtime.ts";
import type { Principal } from "./request-types.ts";
import { authenticateToken } from "./tokens.ts";

export async function authenticateRequest(pool: Pool, identity: ReturnType<typeof createAuth>, request: Request, responseHeaders?: Headers): Promise<Principal | null> {
	const authorization = request.headers.get("authorization");
	if (authorization) {
		const matched = /^Bearer (\S+)$/i.exec(authorization);
		if (!matched) return null;
		const actor = await authenticateToken(pool, matched[1]);

		return actor ? { ...actor, active: true, transport: "token" } : null;
	}

	const result = await identity.api.getSession({ headers: request.headers, returnHeaders: true });
	for (const cookie of result.headers.getSetCookie()) responseHeaders?.append("set-cookie", cookie);
	const session = result.response;
	if (!session) return null;
	const admission = await pool.query("SELECT 1 FROM payloadbay.admission a JOIN payloadbay.installation i ON i.id=a.installation_id WHERE a.user_id=$1 AND a.active AND i.bootstrap_state='complete'", [session.user.id]);

	return admission.rowCount ? { userId: session.user.id, active: true, transport: "cookie" } : null;
}
