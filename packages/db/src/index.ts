import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client.ts";

// Prisma 7 runs on a query compiler with driver adapters — there is no Rust
// query engine, so the Postgres driver is wired in explicitly here.

// Deliberately APP_DATABASE_URL, not DATABASE_URL — see db-init/01-app-role.sql.
// DATABASE_URL is the schema-owning role prisma migrate/generate/seed use; the running
// application (and this exported client) must connect as the restricted, non-superuser
// role instead, or Row Level Security silently does nothing (Postgres superusers and
// BYPASSRLS roles always bypass RLS — FORCE ROW LEVEL SECURITY cannot override that).
const connectionString = process.env["APP_DATABASE_URL"];

// CLAUDE.md §13 — fail loudly. A missing database URL must never degrade into
// a client that silently fails at the first query.
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error(
    "APP_DATABASE_URL is not set. Copy .env.example to .env and fill it in — see db-init/01-app-role.sql.",
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
  User,
  Role,
  TenantMembership,
  Session,
  PasswordResetToken,
  AuditLog,
  ReferenceAccount,
  Account,
  Period,
  PeriodStatus,
  JournalEntry,
  JournalEntryStatus,
  JournalLine,
  JournalImport,
  BankStatementImport,
  BankTransaction,
  BankTransactionStatus,
  TvaRate,
  TvaCashThreshold,
  TvaRegime,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  InvoiceSeriesCounter,
  TvaFilingFrequency,
  TvaDeclarationExport,
  RasRule,
  RasWithholding,
  RasLiabilityTrigger,
  RasWithholdingStatus,
  IsBracket,
  IsCotisationMinimaleConfig,
  IsPassageWorksheet,
  IsPassageLine,
  IsWorksheetStatus,
  IsAdjustmentKind,
  AccountantAccess,
  AccountantAccessScope,
} from "../generated/prisma/client.ts";
// Value export (not `export type`) — needed for Prisma.DocumentWhereInput
// and friends, used to type shared query-fragment helpers like
// apps/web/lib/documents.ts's tenant+deletedAt filter.
export { Prisma } from "../generated/prisma/client.ts";

/**
 * Every query against a business-data table (documents, extraction_*, audit_logs — see
 * the phase 1 migration's RLS comment for which tables and why) must run inside this, not
 * against the bare `prisma` export, or CLAUDE.md §8.1's RLS backstop never engages for it.
 *
 * `set_config(..., true)` is Postgres's parameterized equivalent of `SET LOCAL` — scoped to
 * this transaction only, gone the moment it commits/rolls back, and safe from injection
 * because it goes through Prisma's tagged-template parameter binding like any other value.
 */
export { seedTenantAccounts } from "./seedTenantAccounts.ts";

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
