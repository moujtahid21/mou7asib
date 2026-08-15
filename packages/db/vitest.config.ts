import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Same repo-root .env resolution as prisma.config.ts/seed.ts — one source of truth for
// local secrets regardless of where the test runner is invoked from.
loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

export default defineConfig({
  test: {
    // Integration tests against a real Postgres (CLAUDE.md §12), not mocked — they share
    // one connection pool via packages/db's prisma singleton, so run them sequentially to
    // avoid cross-test transaction interleaving noise.
    fileParallelism: false,
  },
});
