-- CreateEnum
CREATE TYPE "tva_filing_frequency" AS ENUM ('monthly', 'quarterly');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "tva_filing_frequency" "tva_filing_frequency";

-- CreateTable
CREATE TABLE "tva_declaration_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "regime" "tva_regime",
    "total_collectee" DECIMAL(19,4) NOT NULL,
    "total_deductible" DECIMAL(19,4) NOT NULL,
    "total_due" DECIMAL(19,4) NOT NULL,
    "adapter_version" TEXT NOT NULL,
    "exported_by_id" UUID NOT NULL,
    "exported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tva_declaration_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tva_declaration_exports_tenant_id_idx" ON "tva_declaration_exports"("tenant_id");

-- AddForeignKey
ALTER TABLE "tva_declaration_exports" ADD CONSTRAINT "tva_declaration_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tva_declaration_exports" ADD CONSTRAINT "tva_declaration_exports_exported_by_id_fkey" FOREIGN KEY ("exported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- Same pattern as every phase since phase 1 — see that migration's comment for the
-- FORCE/NULLIF rationale.

ALTER TABLE "tva_declaration_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tva_declaration_exports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tva_declaration_exports"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

