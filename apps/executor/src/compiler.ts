import { build } from "esbuild";
import { createHash } from "node:crypto";
import { CompilationError } from "../../../packages/contracts/src/compilation.ts";
import { sdkDeclarations as sdk } from "../../../packages/script-sdk/src/declarations.generated.ts";
import ts from "typescript";
import { z } from "zod";

export type Stage = "ingress" | "processing" | "ingress_middleware" | "processing_middleware";

export type SharedModule = { source: string; revisionId: string };

const inputSchema = z
	.object({
		stage: z.enum(["ingress", "processing", "ingress_middleware", "processing_middleware"]),
		body: z.string().max(131072),
		sourceId: z.string().max(128).default("body"),
		sharedModules: z.record(z.string(), z.object({ source: z.string().max(131072), revisionId: z.string() })).default({}),
	})
	.strict();

export { CompilationError } from "../../../packages/contracts/src/compilation.ts";

export async function compile(input: unknown) {
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success)
		throw new CompilationError([
			{
				sourceId: "body",
				line: 1,
				column: 1,
				severity: "error",
				code: "invalid_source",
				message: "Only structured stage bodies and registered bindings may be published",
			},
		]);
	const { stage, body, sourceId, sharedModules } = parsed.data;
	const bindings = Object.keys(sharedModules);
	for (const name of bindings)
		if (!/^[A-Za-z_$][\w$]*$/.test(name) || name === "ctx")
			throw new CompilationError([
				{
					sourceId,
					line: 1,
					column: 1,
					severity: "error",
					code: "invalid_binding",
					message: "Invalid shared module binding",
				},
			]);
	for (const [name, module] of Object.entries(sharedModules)) {
		const parsedModule = ts.createSourceFile(name + ".ts", module.source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
		if (parsedModule.referencedFiles.length || parsedModule.typeReferenceDirectives.length || parsedModule.libReferenceDirectives.length)
			throw new CompilationError([
				{
					sourceId: name,
					line: 1,
					column: 1,
					severity: "error",
					code: "unregistered_reference",
					message: "File and compiler-environment references are not supported",
				},
			]);
	}

	const imports = bindings.map((name) => `import * as ${name} from ${JSON.stringify("@shared/" + name)};`).join("\n");
	const ctxType = stage === "ingress_middleware" ? "IngressMiddlewareContext" : stage === "processing_middleware" ? "ProcessingMiddlewareContext" : stage === "ingress" ? "IngressContext" : "ProcessingContext";
	const resultType = stage === "ingress_middleware" ? "IngressMiddlewareDecision" : stage === "processing_middleware" ? "ProcessingMiddlewareDecision" : stage === "ingress" ? "IngressDecision" : "ProcessingDecision";
	const functionName = stage === "ingress" ? "ingress" : stage === "processing" ? "processEvent" : "middleware";
	const parsedBody = ts.createSourceFile("ingress.ts", body, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
	const httpFile = stage === "ingress" && parsedBody.statements.some((node) => ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
	const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
	const handlers = httpFile
		? parsedBody.statements
				.filter(ts.isFunctionDeclaration)
				.filter((node) => methods.includes(node.name?.text ?? "") && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
				.map((node) => node.name!.text)
		: [];
	if (httpFile && (!handlers.length || parsedBody.statements.some((node) => ts.isExportAssignment(node) || (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)))))
		throw new CompilationError([
			{
				sourceId,
				line: 1,
				column: 1,
				severity: "error",
				code: "http_handlers",
				message: "Export at least one named HTTP method function (GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS). Default exports are managed by Payload Bay.",
			},
		]);
	const header = httpFile ? "" : imports + (imports ? "\n" : "") + `export default async function ${functionName}(ctx: ${ctxType}): Promise<${resultType}> {\n`;
	const dispatch = httpFile
		? `
const __payloadbayHandlers: Partial<Record<string, (ctx: IngressContext) => IngressDecision | Promise<IngressDecision>>> = { ${handlers.join(", ")} };
export default async function __payloadbayIngress(ctx: IngressContext): Promise<IngressDecision> {
 const handler = __payloadbayHandlers[ctx.request.method.toUpperCase()];
 if (!handler) return ctx.respondOnly({status:405,headers:{allow:${JSON.stringify(handlers.join(", "))}},body:"Method not allowed"});
 return await handler(ctx);
}
`
		: "\n}\n";
	const generated = header + body + dispatch;
	const source = ts.createSourceFile("body.ts", generated, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

	function inspect(node: ts.Node): void {
		if (ts.isImportEqualsDeclaration(node) || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword))
			throw new CompilationError([
				{
					sourceId,
					line: 1,
					column: 1,
					severity: "error",
					code: "unregistered_import",
					message: "Unregistered imports are not supported",
				},
			]);
		if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier) || !bindings.some((key) => node.moduleSpecifier.getText(source).slice(1, -1) === "@shared/" + key)))
			throw new CompilationError([
				{
					sourceId,
					line: 1,
					column: 1,
					severity: "error",
					code: "unregistered_import",
					message: "Unregistered imports are not supported",
				},
			]);
		ts.forEachChild(node, inspect);
	}

	inspect(source);
	for (const [name, module] of Object.entries(sharedModules)) {
		const shared = ts.createSourceFile(name + ".ts", module.source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

		const visit = (node: ts.Node): void => {
			if (ts.isImportEqualsDeclaration(node) || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword))
				throw new CompilationError([
					{
						sourceId: name,
						line: shared.getLineAndCharacterOfPosition(node.getStart(shared)).line + 1,
						column: shared.getLineAndCharacterOfPosition(node.getStart(shared)).character + 1,
						severity: "error",
						code: "unregistered_import",
						message: "Unregistered imports are not supported",
					},
				]);
			if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && (!ts.isStringLiteral(node.moduleSpecifier) || !bindings.some((binding) => node.moduleSpecifier!.getText(shared) === '"@shared/' + binding + '"' || node.moduleSpecifier!.getText(shared) === "'@shared/" + binding + "'")))
				throw new CompilationError([
					{
						sourceId: name,
						line: shared.getLineAndCharacterOfPosition(node.getStart(shared)).line + 1,
						column: 1,
						severity: "error",
						code: "unregistered_import",
						message: "Unregistered imports are not supported",
					},
				]);
			ts.forEachChild(node, visit);
		};

		visit(shared);
	}

	const functions = source.statements.filter(ts.isFunctionDeclaration);
	if (!httpFile && (functions.length !== 1 || functions[0]?.name?.text !== functionName || source.statements.length !== bindings.length + 1))
		throw new CompilationError([
			{
				sourceId,
				line: 1,
				column: 1,
				severity: "error",
				code: "fixed_wrapper",
				message: "Lifecycle wrapper cannot be replaced",
			},
		]);
	const typeSource = sdk + "\n" + generated;
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		lib: ["lib.es2022.d.ts", "lib.webworker.d.ts"],
		types: [],
	};
	const host = ts.createCompilerHost(options);
	const read = host.readFile.bind(host);
	const exists = host.fileExists.bind(host);
	const sources: Record<string, string> = { "/script/body.ts": typeSource };
	for (const [name, module] of Object.entries(sharedModules)) sources["/script/shared/" + name + ".ts"] = module.source;
	host.readFile = (file) => sources[file] ?? read(file);
	host.fileExists = (file) => file in sources || exists(file);
	host.getSourceFile = (file, language) => {
		const text = host.readFile(file);

		return text === undefined ? undefined : ts.createSourceFile(file, text, language, true);
	};

	host.resolveModuleNames = (names) => names.map((name) => (name.startsWith("@shared/") && bindings.includes(name.slice(8)) ? { resolvedFileName: "/script/shared/" + name.slice(8) + ".ts", extension: ts.Extension.Ts } : undefined));
	const program = ts.createProgram(["/script/body.ts"], options, host);
	const diagnostics = ts.getPreEmitDiagnostics(program);
	if (diagnostics.length)
		throw new CompilationError(
			diagnostics.map((d) => {
				const at = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
				const bodyFile = d.file?.fileName === "/script/body.ts";
				const offset = sdk.split("\n").length + header.split("\n").length - 1;

				return {
					sourceId: bodyFile ? sourceId : (d.file?.fileName ?? sourceId),
					line: Math.max(1, (at?.line ?? 0) + 1 - (bodyFile ? offset : 0)),
					column: (at?.character ?? 0) + 1,
					severity: "error" as const,
					code: String(d.code),
					message: ts.flattenDiagnosticMessageText(d.messageText, " "),
				};
			}),
		);
	const output = await build({
		stdin: {
			contents: generated,
			sourcefile: sourceId + ".ts",
			loader: "ts",
			resolveDir: "/script",
		},
		bundle: true,
		format: "esm",
		platform: "browser",
		target: "es2022",
		write: false,
		sourcemap: "external",
		outfile: "bundle.js",
		plugins: [
			{
				name: "registered-modules",
				setup(builder) {
					builder.onResolve({ filter: /.*/ }, (args) => {
						if (args.path.startsWith("@shared/") && bindings.includes(args.path.slice(8))) return { path: args.path.slice(8), namespace: "shared" };

						return { errors: [{ text: "Unregistered import" }] };
					});
					builder.onLoad({ filter: /.*/, namespace: "shared" }, (args) => ({ contents: sharedModules[args.path]!.source, loader: "ts" }));
				},
			},
		],
	});
	const bundle = output.outputFiles!.find((f) => f.path.endsWith(".js"))!.text;
	const map = JSON.parse(output.outputFiles!.find((f) => f.path.endsWith(".map"))!.text);

	return {
		stage,
		body,
		sourceId,
		generated,
		bundle,
		sourceMap: map,
		bodyLineOffset: header.split("\n").length - 1,
		bundleDigest: createHash("sha256").update(bundle).digest("hex"),
		bodyDigest: createHash("sha256").update(body).digest("hex"),
		sdkVersion: "1",
		sharedVersions: Object.fromEntries(Object.entries(sharedModules).map(([name, value]) => [name, value.revisionId])),
		compatibilityDate: "2026-07-01",
		compatibilityFlags: [] as string[],
	};
}
