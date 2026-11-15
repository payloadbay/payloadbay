import { AppError } from "./errors.ts";

export type CompilationDiagnostic = {
	sourceId: string;
	line: number;
	column: number;
	severity: "error";
	code: string;
	message: string;
};

export class CompilationError extends AppError {
	constructor(public readonly diagnostics: CompilationDiagnostic[]) {
		super("compilation_failed", 422, "Script compilation failed", { diagnostics });
	}
}
