import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: [
        "**/*.test.ts",
        "**/__tests__/**",
        "**/*-cli.ts"
      ],
      include: [
        "scripts/**/*.ts",
        "apps/**/src/**/*.ts",
        "apps/**/src/**/*.tsx",
        "packages/**/src/**/*.ts",
        "packages/**/src/**/*.tsx"
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      }
    }
  }
});
