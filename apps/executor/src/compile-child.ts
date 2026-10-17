import { compile, CompilationError } from "./compiler.ts";

const chunks: Buffer[] = [];
let bytes = 0;
try {
	for await (const chunk of process.stdin) {
		bytes += chunk.length;
		if (bytes > 3145728) throw Error("source_limit");
		chunks.push(chunk);
	}

	const result = await compile(JSON.parse(Buffer.concat(chunks).toString("utf8")));
	await new Promise<void>((resolve, reject) => process.stdout.write(JSON.stringify({ result }), (error) => (error ? reject(error) : resolve())));
} catch (error) {
	await new Promise<void>((resolve, reject) => process.stdout.write(JSON.stringify({ error: { code: error instanceof CompilationError ? "compilation_failed" : "invalid_source", diagnostics: error instanceof CompilationError ? error.diagnostics.slice(0, 20) : [] } }), (error) => (error ? reject(error) : resolve())));
}

process.exit(0);
