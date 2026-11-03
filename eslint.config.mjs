import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import readability from "./.github/tooling/eslint/base.mjs";

export default defineConfig([
	...nextVitals.map((config) => ({ ...config, files: ["apps/web/**/*.{js,mjs,ts,tsx}"] })),
	...nextTs,
	readability,
	{ settings: { next: { rootDir: "apps/web" }, react: { version: "19.3" } } },
	{
		files: ["apps/web/src/**/*.{ts,tsx,js,jsx}"],
		rules: {
			"no-restricted-imports": ["error", { patterns: [{ group: ["../*"], message: "Use a TypeScript entry-point alias or a workspace package import instead of traversing parent directories." }] }],
		},
	},
	{ files: ["tests/**/*.{ts,tsx}"], rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-require-imports": "off", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
	globalIgnores(["**/node_modules/**", "**/.next/**", "**/next-env.d.ts", "**/dist/**", "**/build/**", "coverage/**", "test-results/**", "playwright-report/**", "graphify-out/**", "packages/script-sdk/src/declarations.generated.ts"]),
]);
