import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "@": here("./src"),
      // `server-only` throws outside React Server Components; it's a no-op for unit tests.
      "server-only": here("./tests/server-only-stub.ts"),
    },
  },
});
