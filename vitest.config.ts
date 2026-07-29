import { defineConfig } from "vitest/config";

/**
 * Vitest, rather than Node's built-in test runner, because `packages/shared`
 * ships raw TypeScript with `moduleResolution: "bundler"` and extensionless
 * imports (decision 0003). Node's ESM resolver cannot follow `./money`; Vite's
 * can. The alternatives were a hand-rolled resolution hook or giving `shared` a
 * build step, and 0003 exists specifically to avoid the latter.
 */
export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
    environment: "node",
  },
});
