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
	const frame = scriptFrame(stage, bindings);
	const result = await format(frame.prefix + body + frame.suffix, { ...formatting, parser: "typescript", plugins: [typescript, estree] });
	if (!stage) return result;
	const headerEnd = result.indexOf("{\n", result.indexOf("export default async function"));
	if (headerEnd < 0 || !result.endsWith("}\n")) throw Error("Could not format the lifecycle function.");

	return result.slice(headerEnd + 2, -2).replace(/\n$/, "");
}
