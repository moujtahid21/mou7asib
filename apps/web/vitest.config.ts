import { defineConfig } from "vitest/config";

// Scoped to lib/ for now: pure helpers with no Next.js runtime dependency
// (CSV parsing, import mapping/grouping — CLAUDE.md §12's "extraction/import regression
// tests" category). Server actions and components need a Next test harness this repo
// doesn't have yet — not built here.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
