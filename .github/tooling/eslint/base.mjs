import readability from "./readability.mjs";

export default {
	name: "payloadbay/readability",
	plugins: { readability },
	rules: {
		"readability/logical-sections": "error",
		"readability/multiline-types": "error",
		"one-var": ["error", "never"],
		"padding-line-between-statements": [
			"error",
			{ blankLine: "always", prev: "directive", next: "*" },
			{ blankLine: "always", prev: "import", next: "*" },
			// Keep consecutive imports together; this overrides the import boundary above.
			{ blankLine: "any", prev: "import", next: "import" },
			{ blankLine: "always", prev: "*", next: ["function", "class", "export", "return"] },
			{ blankLine: "always", prev: ["function", "class", "block-like"], next: "*" },
		],
		"object-curly-newline": ["error", { ObjectExpression: { minProperties: 4, consistent: true } }],
	},
};
