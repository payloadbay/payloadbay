import type { Pool, PoolClient } from "pg";
import { dataAncestry } from "./membership.ts";
import { AppError } from "../../contracts/src/errors.ts";
import type { PinnedMiddleware } from "./pipeline.ts";

type Manifest = { modules?: Record<string, string> };

/** Old immutable bundles must satisfy today's customer boundary before receiving any private input. */
export async function assertExecutionDependencies(db: Pool | PoolClient, projectId: string, stage: "ingress" | "processing", manifest: Manifest, bindings: readonly (PinnedMiddleware & { manifest?: Manifest })[]) {
	const ids = [...new Set([...Object.values(manifest.modules ?? {}), ...bindings.filter((binding) => binding.stage === stage && binding.scopeType !== "instance").flatMap((binding) => Object.values(binding.manifest?.modules ?? {}))])];
	if (!ids.length) return;
	const ancestry = await dataAncestry(db, { type: "project", id: projectId });
	const modules = (await db.query("SELECT id,scope_type,scope_id FROM payloadbay.shared_module_revision WHERE id=ANY($1::uuid[])", [ids])).rows;
	if (modules.length !== ids.length || modules.some((module) => !ancestry.some((scope) => scope.type === module.scope_type && scope.id === module.scope_id))) throw new AppError("publication_scope_changed", 409, "A pinned dependency is outside the customer scope; republish this route");
}
