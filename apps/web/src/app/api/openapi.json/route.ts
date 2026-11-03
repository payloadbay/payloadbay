import { openApiDocument } from "@contracts/openapi";

export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(openApiDocument(), { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
