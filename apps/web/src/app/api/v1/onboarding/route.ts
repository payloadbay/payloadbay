import { resolveInstallationConfiguration } from "@domain/installation-configuration";
import { onboardingInput } from "@contracts/http-inputs";
import { getServices } from "@lib/server";
import { handle, readJson } from "@api/handler";
import { provisionCustomerOrganization } from "@domain/onboarding";
import { AppError, publicError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	try {
		const { pool, identity, config } = getServices();
		const result = await identity.api.getSession({ headers: request.headers, returnHeaders: true });
		const session = result.response;
		const admission = session ? (await pool.query("SELECT active FROM payloadbay.admission WHERE user_id=$1", [session.user.id])).rows[0] : undefined;
		const headers = new Headers({ "cache-control": "no-store" });
		for (const cookie of result.headers.getSetCookie()) headers.append("set-cookie", cookie);

		return Response.json(
			{
				registrationEnabled: config.registrationPolicy === "organization",
				oauthProviders: Object.keys((await resolveInstallationConfiguration(pool, config)).config.oauth),
				authenticated: Boolean(session?.user.emailVerified),
				needsOrganization: Boolean(session?.user.emailVerified && !admission && config.registrationPolicy === "organization"),
				blocked: admission?.active === false,
			},
			{ headers },
		);
	} catch (error) {
		return Response.json(publicError(error, crypto.randomUUID()), { status: error instanceof AppError ? error.status : 500 });
	}
}

/** Only this route accepts a verified, never-admitted session; domain APIs still require admission. */
export async function POST(request: Request) {
	const { pool, identity, config } = getServices();

	return handle(
		request,
		{
			origin: new URL(config.publicUrl).origin,
			authenticate: async () => {
				if (request.headers.has("authorization") || config.registrationPolicy !== "organization") return null;
				const session = await identity.api.getSession({ headers: request.headers });

				return session?.user.emailVerified ? { userId: session.user.id, active: true, transport: "cookie" as const } : null;
			},
		},
		async ({ actor }) => provisionCustomerOrganization(pool, { ...(await readJson(request, onboardingInput, 16384)), userId: actor.userId }, config.registrationPolicy),
	);
}
