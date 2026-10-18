function declaration(statement) {
	return statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
}

function section(statement) {
	const node = declaration(statement);
	if (!node) return "other";
	if (["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(node.type)) return "type";
	if (["FunctionDeclaration", "ClassDeclaration"].includes(node.type)) return "function";
	if (node.type === "VariableDeclaration") {
		if (node.declarations.some(({ init }) => ["ArrowFunctionExpression", "FunctionExpression"].includes(init?.type))) return "function";
		const call = node.declarations[0]?.init;
		if (call?.type === "CallExpression" && call.callee.type === "Identifier") {
			if (["useState", "useRef", "useReducer"].includes(call.callee.name)) return "state";
			if (["useCallback", "useMemo"].includes(call.callee.name)) return "function";
			if (/^use[A-Z]/.test(call.callee.name)) return "hook";
		}
	}

	if (node.type === "ExpressionStatement" && node.expression.type === "CallExpression" && node.expression.callee.type === "Identifier" && /^use[A-Z]/.test(node.expression.callee.name)) return "hook";

	return "other";
}

const logicalSections = {
	meta: {
		type: "layout",
		fixable: "whitespace",
		schema: [],
		messages: { separate: "Separate logical sections with a blank line." },
	},
	create(context) {
		const source = context.sourceCode;

		function check({ body }) {
			for (let index = 1; index < body.length; index++) {
				const previous = body[index - 1];
				const current = body[index];
				const before = section(previous);
				const after = section(current);
				const functionBoundary = before === "function" || after === "function";
				const changedSection = before !== after && [before, after].some((kind) => ["state", "type", "hook"].includes(kind));
				const effectBoundary = (before === "hook" && previous.type === "ExpressionStatement") || (after === "hook" && current.type === "ExpressionStatement");
				const boundary = functionBoundary || changedSection || effectBoundary;
				if (!boundary || current.loc.start.line - previous.loc.end.line > 1) continue;
				const gap = source.text.slice(previous.range[1], current.range[0]);
				if (/\/\/|\/\*/.test(gap)) continue;
				context.report({
					node: current,
					messageId: "separate",
					fix(fixer) {
						return fixer.replaceTextRange([previous.range[1], current.range[0]], "\n\n");
					},
				});
			}
		}

		return { Program: check, BlockStatement: check };
	},
};

const multilineTypes = {
	meta: {
		type: "layout",
		fixable: "whitespace",
		schema: [],
		messages: { expand: "Write substantial type shapes across multiple lines." },
	},
	create(context) {
		const source = context.sourceCode;

		function check(node) {
			const members = node.members ?? node.body;
			if (members.length < 4 || node.loc.start.line !== node.loc.end.line) return;
			context.report({
				node,
				messageId: "expand",
				fix(fixer) {
					return [fixer.insertTextAfter(source.getFirstToken(node), "\n"), fixer.insertTextBefore(source.getLastToken(node), "\n")];
				},
			});
		}

		return { TSTypeLiteral: check, TSInterfaceBody: check };
	},
};

export default { rules: { "logical-sections": logicalSections, "multiline-types": multilineTypes } };
