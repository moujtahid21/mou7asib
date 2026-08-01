import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

// Prisma 7 runs on a query compiler with driver adapters — there is no Rust
// query engine, so the Postgres driver is wired in explicitly here.

const connectionString = process.env["DATABASE_URL"];

// CLAUDE.md §13 — fail loudly. A missing database URL must never degrade into
// a client that silently fails at the first query.
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Next.js dev server re-evaluates modules on hot reload; without this the
// process accumulates connection pools until Postgres refuses new clients.
const globalForPrisma = globalThis as typeof globalThis & {
  __mou7asibPrisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.__mou7asibPrisma ?? createClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.__mou7asibPrisma = prisma;
}

export type {
  Tenant,
  Document,
  ExtractionJob,
  ExtractionAttempt,
  ExtractedField,
  DocumentStatus,
  JobStatus,
  ExtractionPath,
  ExtractedFieldType,
} from "../generated/prisma/client.ts";
