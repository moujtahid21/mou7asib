-- CreateEnum
CREATE TYPE "ras_liability_trigger" AS ENUM ('invoice_date', 'payment_date');

-- CreateEnum
CREATE TYPE "ras_withholding_status" AS ENUM ('flagged', 'computed');

-- CreateTable
CREATE TABLE "ras_rules" (
    "id" UUID NOT NULL,
    "payment_nature" TEXT NOT NULL,
    "payee_type" TEXT NOT NULL,
    "resident_status" TEXT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "base_description" TEXT NOT NULL,
    "liability_trigger" "ras_liability_trigger" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "legal_source_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ras_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ras_withholdings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payee_name" TEXT NOT NULL,
    "payee_type" TEXT NOT NULL,
    "resident_status" TEXT NOT NULL,
    "payment_nature" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "base_amount" DECIMAL(19,4) NOT NULL,
    "status" "ras_withholding_status" NOT NULL DEFAULT 'flagged',
    "matched_rate_at_eval" DECIMAL(6,4),
    "ras_amount" DECIMAL(19,4),
    "net_payable" DECIMAL(19,4),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ras_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ras_rules_payment_nature_payee_type_resident_status_effecti_key" ON "ras_rules"("payment_nature", "payee_type", "resident_status", "effective_from");

-- CreateIndex
CREATE INDEX "ras_withholdings_tenant_id_idx" ON "ras_withholdings"("tenant_id");

-- CreateIndex
CREATE INDEX "ras_withholdings_tenant_id_status_idx" ON "ras_withholdings"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "ras_withholdings" ADD CONSTRAINT "ras_withholdings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ras_withholdings" ADD CONSTRAINT "ras_withholdings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- ras_rules is deliberately NOT RLS'd: it's global reference data (same status as
-- tva_rates/reference_accounts), not tenant-owned. ras_withholdings is tenant-owned —
-- same pattern as every phase since phase 1.

ALTER TABLE "ras_withholdings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ras_withholdings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ras_withholdings"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

