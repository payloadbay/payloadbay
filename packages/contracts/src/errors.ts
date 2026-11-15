import type { CompilationDiagnostic } from "./compilation.ts";

export class AppError extends Error {
	constructor(
		public readonly code: string,
		public readonly status: number,
		public readonly publicMessage: string,
		public readonly details?: { diagnostics: CompilationDiagnostic[] },
	) {
		super(publicMessage);
	}
}

export function publicError(error: unknown, correlationId: string) {
	return {
		error: {
			code: error instanceof AppError ? error.code : "internal_error",
			message: error instanceof AppError ? error.publicMessage : "An unexpected error occurred",
			correlationId,
			...(error instanceof AppError && error.details?.diagnostics ? { diagnostics: error.details.diagnostics } : {}),
		},
	};
}
