import { readFileSync } from "node:fs";
import ts from "typescript";
import type { FileCoverageData, FunctionMapping } from "istanbul-lib-coverage";

type NamedFunction = { mapping: FunctionMapping; declared: boolean };

/** Reconcile unique declared function names; preserve inferred/minified entries. */
export function createFunctionNormalizer() {
	const indexes = new Map<string, Map<string, NamedFunction[]> | null>();

	return (file: FileCoverageData) => {
		if (!indexes.has(file.path)) {
			let text: string;
			try {
				text = readFileSync(file.path, "utf8");
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
				indexes.set(file.path, null);

				return;
			}

			const source = ts.createSourceFile(file.path, text, ts.ScriptTarget.Latest, true);
			const names = new Map<string, NamedFunction[]>();

			const position = (offset: number) => {
				const point = source.getLineAndCharacterOfPosition(offset);

				return { line: point.line + 1, column: point.character };
			};

			const visit = (node: ts.Node) => {
				if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.body) {
					let name = "name" in node && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;
					const parent = node.parent;
					if (!name && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) name = parent.name.text;
					if (!name && ts.isParameter(parent) && ts.isIdentifier(parent.name)) name = parent.name.text;
					if (!name && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
						const target = parent.left;
						if (ts.isIdentifier(target)) name = target.text;
						else if (ts.isPropertyAccessExpression(target)) name = target.name.text;
						else if (ts.isElementAccessExpression(target) && ts.isStringLiteral(target.argumentExpression)) name = target.argumentExpression.text;
					}

					if (!name && ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) name = parent.parent.name.getText(source);
					if (name) {
						const loc = { start: position(node.getStart(source)), end: position(node.getEnd()) };
						const mapping = {
							name,
							decl: loc,
							loc,
							line: loc.start.line,
						};
						const declared = (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && Boolean(node.name);
						names.set(name, [...(names.get(name) ?? []), { mapping, declared }]);
					}
				}

				ts.forEachChild(node, visit);
			};

			visit(source);
			indexes.set(file.path, names);
		}

		const names = indexes.get(file.path);
		if (!names) return;
		const fnMap: FileCoverageData["fnMap"] = {};
		const hits: FileCoverageData["f"] = {};
		const identities = new Map<string, string>();
		for (const [id, mapping] of Object.entries(file.fnMap)) {
			// esbuild's name-preservation helper is generated, not an authored
			// function. Retain a user-authored __name function when one exists.
			if (mapping.name === "__name" && !names.has("__name")) continue;
			const source = names.get(mapping.name);
			// Callback names can be inferred from repeated assignments/properties.
			// They are not unique source declarations and keep their mapped ranges.
			// Source maps can begin before a declaration; require overlapping ranges.
			// Coincident minified names in disjoint authored ranges remain distinct.
			const canonical = source?.length === 1 && source[0].declared && mapping.loc.end.line >= source[0].mapping.loc.start.line && mapping.loc.start.line <= source[0].mapping.loc.end.line ? source[0].mapping : mapping;
			const key = canonical.name + ":" + JSON.stringify(canonical.loc);
			let target = identities.get(key);
			if (target === undefined) {
				target = String(identities.size);
				identities.set(key, target);
				fnMap[target] = canonical;
				hits[target] = 0;
			}

			hits[target] += file.f[id];
		}

		file.fnMap = fnMap;
		file.f = hits;
	};
}
