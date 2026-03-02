# @novyra/eslint-config

Shareable ESLint configuration used across NOVYRA workspace.

This package provides a curated set of linting rules and recommended plugins
for the frontend and shared packages in the monorepo (Next.js, TypeScript,
React). It is intentionally lightweight so individual apps can extend it.

## Install

Install in a workspace package that needs linting (example uses pnpm):

```bash
pnpm add -D @novyra/eslint-config eslint
```

If using TypeScript and React, also install peer deps:

```bash
pnpm add -D eslint-plugin-react eslint-plugin-react-hooks @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Usage

Create an `.eslintrc.cjs` in your package root and extend the shared config:

```js
module.exports = {
	extends: ["@novyra/eslint-config"],
	parserOptions: {
		project: ['./tsconfig.json'],
	},
	rules: {
		// package-specific overrides
	},
}
```

## Philosophy

- Enforce consistent formatting and TypeScript best practices.
- Keep rules minimal so teams can opt into stricter linting locally.

## Contributing

Add rules or update peer dependencies carefully and bump the package
version. Run lint across the monorepo to ensure no unexpected failures.

---

Generated and maintained by the NOVYRA engineering team.
