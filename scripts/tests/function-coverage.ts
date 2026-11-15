import { readFileSync } from "node:fs";
import ts from "typescript";
import type { FileCoverageData, FunctionMapping } from "istanbul-lib-coverage";

type Position = { line: number; column: number };
type NamedFunction = {
	mapping: FunctionMapping;
	declared: boolean;
	starts: Position[];
	body: Position;
};

const beforeOrEqual = (left: Position, right: Position) => left.line < right.line || (left.line === right.line && left.column <= right.column);

/** Reconcile precise source ranges and unique declarations across compiler aliases. */
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
				if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node)) && node.body) {
					let name = "name" in node && node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;
					const parent = node.parent;
					if (ts.isConstructorDeclaration(node)) name = (ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) && parent.name ? parent.name.text : "constructor";
					if (!name && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) name = parent.name.text;
					if (!name && ts.isParameter(parent) && ts.isIdentifier(parent.name)) name = parent.name.text;
					if (!name && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
						const target = parent.left;
						if (ts.isIdentifier(target)) name = target.text;
						else if (ts.isPropertyAccessExpression(target)) name = target.name.text;
						else if (ts.isElementAccessExpression(target) && ts.isStringLiteral(target.argumentExpression)) name = target.argumentExpression.text;
					}

					if (!name && ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) name = parent.parent.name.getText(source);
					name ??= "(anonymous)";
					const loc = { start: position(node.getStart(source)), end: position(node.getEnd()) };
					const mapping = {
						name,
						decl: loc,
						loc,
						line: loc.start.line,
					};
					const declared = ts.isConstructorDeclaration(node) || ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && Boolean(node.name));
					const starts = [loc.start];
					if (ts.canHaveModifiers(node)) starts.push(...(ts.getModifiers(node) ?? []).map((modifier) => position(modifier.getStart(source))));
					for (const token of node.getChildren(source)) if (token.kind === ts.SyntaxKind.FunctionKeyword) starts.push(position(token.getStart(source)));
					names.set(name, [
						...(names.get(name) ?? []),
						{
							mapping,
							declared,
							starts,
							body: position(node.body.getStart(source)),
						},
					]);
				}

				ts.forEachChild(node, visit);
			};

			visit(source);
			indexes.set(file.path, names);
		}

		const names = indexes.get(file.path);
		if (!names) return;
		const sourceFunctions = [...names.values()].flat();
		if (!sourceFunctions.length) {
			file.fnMap = {};
			file.f = {};

			return;
		}

		const fnMap: FileCoverageData["fnMap"] = {};
		const hits: FileCoverageData["f"] = {};
		const identities = new Map<string, string>();
		for (const [index, source] of sourceFunctions.entries()) {
			const id = String(index);
			identities.set(source.mapping.name + ":" + JSON.stringify(source.mapping.loc), id);
			fnMap[id] = source.mapping;
			hits[id] = 0;
		}

		for (const [id, mapping] of Object.entries(file.fnMap)) {
			// esbuild's name-preservation helper is generated, not an authored
			// function. Retain a user-authored __name function when one exists.
			if (mapping.name === "__name" && !names.has("__name")) continue;
			if (/^\d+$/.test(mapping.name) && !names.has(mapping.name)) continue;
			const source = names.get(mapping.name);
			// Callback names can be inferred from repeated assignments/properties.
			// They are not unique source declarations and keep their mapped ranges.
			// Source maps can begin before a declaration; require overlapping ranges.
			// Coincident minified names in disjoint authored ranges remain distinct.
			// Compiler maps can omit a parenthesis or include the trailing comma and space.
			// Require unambiguous source boundaries rather than inferred names.
			// Parenthesized JSX/expression arrows can end at the body, before its closing delimiters.
			const located = sourceFunctions.filter(({ mapping: candidate, starts, body }) => starts.some((start) => start.line === mapping.loc.start.line && Math.abs(start.column - mapping.loc.start.column) <= 1) && ((candidate.loc.end.line === mapping.loc.end.line && Math.abs(candidate.loc.end.column - mapping.loc.end.column) <= 2) || (beforeOrEqual(mapping.loc.start, body) && beforeOrEqual(body, mapping.loc.end))));
			// Export accessors can carry the declaration's name without invoking its
			// body. They cannot claim an authored function's execution counter.
			const canonical = located.length === 1 ? located[0].mapping : source?.length === 1 && source[0].declared && beforeOrEqual(mapping.loc.start, source[0].body) && beforeOrEqual(source[0].body, mapping.loc.end) ? source[0].mapping : undefined;
			if (!canonical) continue;
			const key = canonical.name + ":" + JSON.stringify(canonical.loc);
			const target = identities.get(key)!;
			hits[target] += file.f[id];
		}

		// Source-map placeholders have no executed function ranges. They must not
		// turn authored functions into 100% coverage through an empty denominator.
		if (!Object.keys(file.fnMap).length) {
			Object.assign(file, { all: true });
			for (const id of Object.keys(file.s)) file.s[id] = 0;
		}

		file.fnMap = fnMap;
		file.f = hits;
	};
}
