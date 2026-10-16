import type { Pool, PoolClient } from "pg";
import ts from "typescript";
import { createHash, randomUUID } from "node:crypto";
import { transaction } from "./db.ts";
import { requirePermission, scopeAncestry, actorPermissions } from "./membership.ts";
import type { Actor, ScopeRef } from "./authorization.ts";
import { AppError } from "../../contracts/src/errors.ts";
import { appendChange } from "./changes.ts";
import type { compile } from "../../../apps/executor/src/compiler.ts";

type Compiler = (input: unknown) => ReturnType<typeof compile>;

function metadata(row: Record<string, unknown>) {
	return {
		id: row.id as string,
		name: row.name as string,
		scope: { type: row.scope_type as ScopeRef["type"], id: row.scope_id as string },
		sourceDigest: row.source_digest as string,
		bundleDigest: row.bundle_digest as string,
		originRevisionId: row.origin_revision_id as string | null,
		createdAt: row.created_at as Date,
	};
}

export async function getSharedVersion(db: Pool | PoolClient, actor: Actor, id: string) {
	const row = (await db.query("SELECT * FROM payloadbay.shared_module_revision WHERE id=$1", [id])).rows[0];
	if (!row) throw new AppError("not_found", 404, "Shared code unavailable");
	await requirePermission(db, actor, { type: row.scope_type, id: row.scope_id }, "code.read");

	return { ...metadata(row), source: row.source as string, exports: helperExports(row.source as string) };
}

export async function createSharedVersion(
	pool: Pool,
	actor: Actor,
	input: {
		scope: ScopeRef;
		name: string;
		source: string;
		originRevisionId?: string;
		compile: Compiler;
	},
) {
	if (!/^[A-Za-z_$][\w$]{0,99}$/.test(input.name) || !input.source.trim() || Buffer.byteLength(input.source) > 131072) throw new AppError("invalid_shared_code", 400, "Choose an identifier and a source module within 128 KiB");

	return transaction(pool, async (db) => {
		await requirePermission(db, actor, input.scope, "code.edit");
		if (input.originRevisionId) await getSharedVersion(db, actor, input.originRevisionId);
		const id = randomUUID();
		const compiled = await input.compile({
			stage: "processing",
			sourceId: "shared-validation",
			body: 'ctx.log.info("Registered exports",{names:Object.keys(Module)});return ctx.complete();',
			sharedModules: { Module: { source: input.source, revisionId: id } },
		});
		const row = (await db.query("INSERT INTO payloadbay.shared_module_revision(id,scope_type,scope_id,name,source,source_digest,bundle_digest,origin_revision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [id, input.scope.type, input.scope.id, input.name, input.source, createHash("sha256").update(input.source).digest("hex"), compiled.bundleDigest, input.originRevisionId ?? null])).rows[0];
		await db.query("INSERT INTO payloadbay.audit(actor,scope_type,scope_id,operation,resource_id,redacted_diff) VALUES($1,$2,$3,'shared.version_created',$4,$5)", [actor.userId, input.scope.type, input.scope.id, id, JSON.stringify({ name: input.name, originRevisionId: input.originRevisionId ?? null })]);
		await appendChange(db, {
			scope: input.scope,
			kind: "configuration.changed",
			resourceId: id,
			capability: "code.read",
		});

		return { ...metadata(row), source: row.source as string, exports: helperExports(row.source as string) };
	});
}

export async function copySharedVersion(
	pool: Pool,
	actor: Actor,
	input: {
		id: string;
		scope: ScopeRef;
		name?: string;
		compile: Compiler;
	},
) {
	const origin = await getSharedVersion(pool, actor, input.id);

	return createSharedVersion(pool, actor, {
		scope: input.scope,
		name: input.name ?? origin.name,
		source: origin.source,
		originRevisionId: origin.id,
		compile: input.compile,
	});
}

export async function resolveSharedModules(db: Pool | PoolClient, actor: Actor, scope: ScopeRef, bindings: Record<string, string>) {
	const ancestry = await scopeAncestry(db, scope);
	const modules: Record<string, { source: string; revisionId: string }> = Object.create(null);
	let bytes = 0;
	if (Object.keys(bindings).length > 32) throw new AppError("shared_code_limit", 413, "At most 32 shared code bindings are supported");
	for (const [name, id] of Object.entries(bindings)) {
		if (!/^[A-Za-z_$][\w$]*$/.test(name) || name === "ctx") throw new AppError("invalid_shared_binding", 400, "Choose a valid shared code binding");
		const version = await getSharedVersion(db, actor, id);
		if (!ancestry.some((parent) => parent.type === version.scope.type && parent.id === version.scope.id)) throw new AppError("invalid_shared_binding", 400, "Shared code is outside this route scope");
		bytes += Buffer.byteLength(version.source);
		if (bytes > 524288) throw new AppError("shared_code_limit", 413, "Shared dependencies exceed 512 KiB");
		modules[name] = { source: version.source, revisionId: version.id };
	}

	return modules;
}

export async function listSharedVersions(pool: Pool, actor: Actor, scope: ScopeRef) {
	await requirePermission(pool, actor, scope, "code.read");
	const ancestry = await scopeAncestry(pool, scope);
	const allowed: ScopeRef[] = [];
	const first = actor.token ? ancestry.findIndex((parent) => parent.type === actor.token!.scope.type && parent.id === actor.token!.scope.id) : 0;
	for (const parent of ancestry.slice(first)) if ((await actorPermissions(pool, actor, parent)).has("code.read")) allowed.push(parent);
	const parameters: string[] = [];
	const clauses = allowed.map((parent) => {
		parameters.push(parent.type, parent.id);

		return `(scope_type=$${parameters.length - 1} AND scope_id=$${parameters.length}::uuid)`;
	});

	return (await pool.query("SELECT id,name,scope_type,scope_id,source_digest,bundle_digest,origin_revision_id,created_at FROM payloadbay.shared_module_revision WHERE " + clauses.join(" OR ") + " ORDER BY created_at DESC,id DESC LIMIT 200", parameters)).rows.map(metadata);
}

/** Resolve literal source imports once; existing immutable pins survive subsequent saves. */
export async function pinSourceImports(db: Pool | PoolClient, actor: Actor, scope: ScopeRef, source: string, existing: Record<string, string> = {}) {
	const file = ts.createSourceFile("script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
	const names = new Set<string>();
	for (const statement of file.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		const specifier = statement.moduleSpecifier.text;
		if (!specifier.startsWith("@shared/")) throw new AppError("invalid_shared_binding", 400, "Only imports from @shared/HelperName are supported");
		const name = specifier.slice(8);
		if (!/^[A-Za-z_$][\w$]{0,99}$/.test(name)) throw new AppError("invalid_shared_binding", 400, "Choose a saved helper module name");
		names.add(name);
	}

	if (names.size > 32) throw new AppError("shared_code_limit", 413, "At most 32 helper imports are supported");
	const ancestry = await scopeAncestry(db, scope);
	const pinned: Record<string, string> = Object.create(null);
	for (const name of names) {
		if (Object.hasOwn(existing, name)) {
			pinned[name] = existing[name];
			continue;
		}

		// Nearest visible scope wins; revisions are immutable and newest-first.
		const first = actor.token ? ancestry.findIndex((parent) => parent.type === actor.token!.scope.type && parent.id === actor.token!.scope.id) : 0;
		for (const parent of ancestry.slice(first).reverse()) {
			if (!(await actorPermissions(db, actor, parent)).has("code.read")) continue;
			const row = (await db.query("SELECT id FROM payloadbay.shared_module_revision WHERE scope_type=$1 AND scope_id=$2 AND name=$3 ORDER BY created_at DESC,id DESC LIMIT 1", [parent.type, parent.id, name])).rows[0];
			if (row) {
				pinned[name] = row.id;
				break;
			}
		}

		if (!pinned[name]) throw new AppError("invalid_shared_binding", 400, `Helper ${name} is unavailable in this scope`);
	}

	await resolveSharedModules(db, actor, scope, pinned);

	return pinned;
}

export function helperExports(source: string) {
	const file = ts.createSourceFile("helper.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
	const names = new Set<string>();
	for (const node of file.statements) {
		if (ts.isExportAssignment(node)) names.add("default");
		if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) for (const item of node.exportClause.elements) names.add(item.name.text);
		const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
		if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
		if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
			names.add("default");
			continue;
		}

		if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
		} else if ("name" in node && node.name && ts.isIdentifier(node.name as ts.Node)) names.add((node.name as ts.Identifier).text);
	}

	return [...names];
}

export async function prepareHelperImport(
	pool: Pool,
	actor: Actor,
	input: {
		scope: ScopeRef;
		revisionId: string;
		body: string;
		exports: string[];
	},
) {
	await requirePermission(pool, actor, input.scope, "code.edit");
	const helper = await getSharedVersion(pool, actor, input.revisionId);
	await resolveSharedModules(pool, actor, input.scope, { [helper.name]: helper.id });
	const available = helperExports(helper.source);
	if (!input.exports.length || input.exports.some((name) => !available.includes(name))) throw new AppError("invalid_import", 400, "Select exports provided by this helper revision");
	const diagnostics = ts.transpileModule(input.body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true }).diagnostics;
	if (diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) throw new AppError("invalid_script", 400, "Fix the script syntax before importing a helper");
	const file = ts.createSourceFile("script.ts", input.body, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
	const imports = file.statements.filter(ts.isImportDeclaration);
	const existing = new Set<string>();
	const used = new Set<string>();

	function identifiers(node: ts.Node) {
		if (ts.isIdentifier(node)) used.add(node.text);
		ts.forEachChild(node, identifiers);
	}

	identifiers(file);
	for (const declaration of imports) {
		if (!ts.isStringLiteral(declaration.moduleSpecifier) || declaration.moduleSpecifier.text !== "@shared/" + helper.name) continue;
		if (declaration.importClause?.name) existing.add("default");
		const bindings = declaration.importClause?.namedBindings;
		if (bindings && ts.isNamedImports(bindings)) for (const symbol of bindings.elements) existing.add(symbol.propertyName?.text ?? symbol.name.text);
	}

	function local(name: string) {
		let candidate = name;
		let index = 1;
		while (used.has(candidate)) candidate = helper.name + "_" + name + (index++ > 1 ? index : "");
		used.add(candidate);

		return ts.factory.createIdentifier(candidate);
	}

	const selected = [...new Set(input.exports)].filter((name) => !existing.has(name));
	const statement = selected.length
		? ts.factory.createImportDeclaration(
				undefined,
				ts.factory.createImportClause(
					false,
					selected.includes("default") ? local(helper.name) : undefined,
					selected.some((name) => name !== "default")
						? ts.factory.createNamedImports(
								selected
									.filter((name) => name !== "default")
									.map((name) => {
										const alias = local(name);

										return ts.factory.createImportSpecifier(false, alias.text === name ? undefined : ts.factory.createIdentifier(name), alias);
									}),
							)
						: undefined,
				),
				ts.factory.createStringLiteral("@shared/" + helper.name),
			)
		: null;
	const statements = [...imports, ...(statement ? [statement] : []), ...file.statements.filter((node) => !ts.isImportDeclaration(node))];
	const body = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(ts.factory.updateSourceFile(file, statements));

	return { body, name: helper.name, revisionId: helper.id };
}
