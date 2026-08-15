import { defineConfig } from "vitest/config";

// Pure unit/property tests, no external services — unlike packages/db's suite, safe to
// run fully parallel.
export default defineConfig({ test: {} });
