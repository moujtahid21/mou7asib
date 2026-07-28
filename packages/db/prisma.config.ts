import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// One .env at the repo root is the single source of truth for local secrets,
// resolved from this file's own location rather than the current working
// directory so it does not matter where the CLI is invoked from.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

// Prisma 7 moved the datasource URL out of schema.prisma and into this file.
// The URL is read from the environment and never committed (CLAUDE.md §8.5).
//
// Note: the config that `prisma init` generates passes `process.env.DATABASE_URL`
// straight through, which does not typecheck under `exactOptionalPropertyTypes`
// (CLAUDE.md §10) because the property is typed `url?: string`, not
// `url?: string | undefined`. Resolving it here is also the behaviour we want:
// a missing URL fails loudly rather than surfacing later as a confusing
// connection error (CLAUDE.md §13).
const url = process.env["DATABASE_URL"];

if (url === undefined || url.length === 0) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
