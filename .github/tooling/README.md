# Shared JavaScript and TypeScript formatting

These files are maintained in `payloadbay/.github`. The existing repository
baseline workflow distributes them through the explicitly eligible `typescript`
file group, initially to `payloadbay` only. Brand and other repositories receive
no tooling files unless their exact names are added to the group.

Synchronization only copies these assets. It does not install dependencies,
format code, or overwrite project-owned ESLint, Prettier, TypeScript, package,
editor, or CI configurations. Local modifications to managed assets use the
existing three-way merge and conflict-PR behavior.

## ESLint adoption

The base requires ESLint 9 flat configuration. A TypeScript project provides its
own parser; Next.js projects can keep their existing Next.js presets. Import the
shared base after framework presets, then add project overrides and ignores:

```js
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import readability from "./.github/tooling/eslint/base.mjs";

export default defineConfig([
	...nextVitals,
	...nextTs,
	readability,
	// Project-specific boundaries, test exceptions and ignores belong here.
]);
```

The base enforces:

- A blank line after `use client`/other directives and the import block.
- Blank lines between functions, logical state/hook/type sections, and before returns.
- One variable declaration per statement. Each `const [value, setValue] = useState(...)`
  remains normal destructuring; consecutive related state declarations stay together.
- Multiline object literals and type shapes with four or more properties.

Use a named local props/argument type for a substantial function-parameter shape.
Prettier otherwise collapses inline parameter types and would fight the lint rule.
Formatting rules have autofixes. Run ESLint fixes followed by Prettier, then both
checks to verify that their outputs agree.

## Prettier adoption

Use a project-owned `.prettierrc.mjs` rather than duplicating the base settings:

```js
import base from "./.github/tooling/prettier/base.mjs";

export default {
	...base,
	// Optional project-specific settings.
};
```

The baseline matches the approved Clipify settings: tabs, JSX single quotes,
and `printWidth: 500`. Whitespace structure is enforced by ESLint, not inferred
from line width. A project owns its `.prettierignore` and excludes generated,
vendored, or canonical brand artifacts as appropriate.

## Repository-local responsibilities

TypeScript aliases name real entry points, such as `@api`, `@lib`, `@components`
and a shared `@types` file. Actual path mappings, workspace package boundaries,
Next.js rules, page/component organization, migration policy, formatter targets,
and test commands remain local to each project. Worker and executor runtimes
must resolve their own imports; a Next.js path alias is not a Node.js package.

Run the baseline synchronizer tests and tooling tests for source changes. CI
validates actual ESLint and Prettier behavior using pinned tools; synchronization
still does not execute project tooling in target repositories.
