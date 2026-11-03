import { getServices } from "@lib/server";
import { invitationDetails } from "@domain/invitations";
import { AppError, publicError } from "@contracts/errors";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** The unguessable invitation token permits reviewing this invitation, not joining it. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
	try {
		return Response.json(await invitationDetails(getServices().pool, (await params).token), { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
	} catch (cause) {
		return Response.json(publicError(cause, crypto.randomUUID()), { status: cause instanceof AppError ? cause.status : 500, headers: { "cache-control": "no-store" } });
	}
}
