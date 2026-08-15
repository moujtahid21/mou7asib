-- CreateEnum
CREATE TYPE "bank_transaction_status" AS ENUM ('unmatched', 'matched');

-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_code" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "row_count" INTEGER NOT NULL,
    "imported_count" INTEGER NOT NULL,
    "skipped_count" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "bank_account_code" TEXT NOT NULL,
    "value_date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "source_hash" TEXT NOT NULL,
    "status" "bank_transaction_status" NOT NULL DEFAULT 'unmatched',
    "matched_journal_line_id" UUID,
    "matched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statement_imports_tenant_id_idx" ON "bank_statement_imports"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_matched_journal_line_id_key" ON "bank_transactions"("matched_journal_line_id");

-- CreateIndex
CREATE INDEX "bank_transactions_tenant_id_idx" ON "bank_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_transactions_tenant_id_status_idx" ON "bank_transactions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_tenant_id_bank_account_code_source_hash_key" ON "bank_transactions"("tenant_id", "bank_account_code", "source_hash");

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_journal_line_id_fkey" FOREIGN KEY ("matched_journal_line_id") REFERENCES "journal_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- Same pattern as every phase since phase 1 — see that migration's comment for the
-- FORCE/NULLIF rationale.

ALTER TABLE "bank_statement_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_statement_imports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bank_statement_imports"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "bank_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bank_transactions"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

