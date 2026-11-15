import { protectedRoute } from "@api/protected";
import { uuid, version } from "@api/parameters";
import { endpointFor, deleteEndpoint } from "@domain/endpoints";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool, config }, actor) => {
		const { endpoint: e, permissions } = await endpointFor(pool, actor, uuid((await params).endpointId));

		return {
			id: e.id,
			projectId: e.project_id,
			name: e.name,
			slug: e.slug,
			paused: e.paused,
			priority: e.priority,
			version: e.config_version,
			activePublicationId: e.active_publication_id,
			permissions,
			...(permissions.includes("endpoints.configure") ? { ingressUrl: new URL("/ingress/" + e.ingress_key, config.publicUrl).href } : {}),
		};
	});
}

export async function DELETE(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
	return protectedRoute(request, async ({ pool }, actor) => deleteEndpoint(pool, actor, uuid((await params).endpointId), version(request)));
}
