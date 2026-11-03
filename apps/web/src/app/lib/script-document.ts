import formatting from "@formatting";

export type ScriptStage = "ingress" | "processing" | "ingress_middleware" | "processing_middleware";

export function scriptFrame(stage?: ScriptStage, bindings: Record<string, string> = {}) {
	if (!stage) return { prefix: "", suffix: "" };
	const context = stage === "ingress" ? "IngressContext" : stage === "processing" ? "ProcessingContext" : stage === "ingress_middleware" ? "IngressMiddlewareContext" : "ProcessingMiddlewareContext";
	const decision = context.replace("Context", "Decision");
	const name = stage === "ingress" ? "ingress" : stage === "processing" ? "processEvent" : "middleware";
	const imports = Object.keys(bindings)
		.map((alias) => `import * as ${alias} from "@shared/${alias}";`)
		.join("\n");

	return { prefix: (imports ? imports + "\n\n" : "") + `export default async function ${name}(ctx: ${context}): Promise<${decision}> {\n`, suffix: "\n}\n" };
}

/** Formats the actual TypeScript file, then preserves the body-only API contract. */
export async function formatScript(body: string, stage?: ScriptStage, bindings: Record<string, string> = {}) {
	const [{ format }, typescript, estree] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/typescript"), import("prettier/plugins/estree")]);
	const moduleFile = /^\s*(?:import|export)\s/m.test(body);
	const frame = scriptFrame(moduleFile ? undefined : stage, bindings);
	const formatted = await format(frame.prefix + body + frame.suffix, { ...formatting, parser: "typescript", plugins: [typescript, estree] });
	const result = formatted.replace(/^(import[\s\S]*?;\n)(?=(?:export|async|function|const|let|class|type|interface|enum)\b)/, "$1\n");
	if (!stage || moduleFile) return result;
	const headerEnd = result.indexOf("{\n", result.indexOf("export default async function"));
	if (headerEnd < 0 || !result.endsWith("}\n")) throw Error("Could not format the lifecycle function.");

	return result.slice(headerEnd + 2, -2).replace(/\n$/, "");
}

/** Existing incomplete drafts stay editable when formatting cannot parse them. */
export async function formatScriptForDisplay(body: string, stage?: ScriptStage, bindings: Record<string, string> = {}) {
	try {
		return await formatScript(body, stage, bindings);
	} catch {
		return body;
	}
}

/** Promote stored stage bodies into the same complete module the compiler executes. */
export function scriptDocument(body: string, stage: ScriptStage, bindings: Record<string, string> = {}) {
	if (/^\s*(?:import|export)\s/m.test(body)) return body;
	const frame = scriptFrame(stage, bindings);

	return frame.prefix + body + frame.suffix;
}
