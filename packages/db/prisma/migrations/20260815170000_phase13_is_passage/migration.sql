-- CreateEnum
CREATE TYPE "is_worksheet_status" AS ENUM ('draft', 'validated');

-- CreateEnum
CREATE TYPE "is_adjustment_kind" AS ENUM ('reintegration', 'deduction');

-- CreateTable
CREATE TABLE "is_brackets" (
    "id" UUID NOT NULL,
    "min_income" DECIMAL(19,4) NOT NULL,
    "max_income" DECIMAL(19,4),
    "rate" DECIMAL(6,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "legal_source_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "is_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "is_cotisation_minimale_configs" (
    "id" UUID NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "minimum_amount" DECIMAL(19,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "legal_source_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "is_cotisation_minimale_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "is_passage_worksheets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "resultat_comptable" DECIMAL(19,4) NOT NULL,
    "status" "is_worksheet_status" NOT NULL DEFAULT 'draft',
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "is_passage_worksheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "is_passage_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "worksheet_id" UUID NOT NULL,
    "kind" "is_adjustment_kind" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "explanation" TEXT NOT NULL,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "is_passage_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "is_passage_worksheets_tenant_id_idx" ON "is_passage_worksheets"("tenant_id");

-- CreateIndex
CREATE INDEX "is_passage_lines_tenant_id_idx" ON "is_passage_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "is_passage_lines_worksheet_id_idx" ON "is_passage_lines"("worksheet_id");

-- AddForeignKey
ALTER TABLE "is_passage_worksheets" ADD CONSTRAINT "is_passage_worksheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "is_passage_worksheets" ADD CONSTRAINT "is_passage_worksheets_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "is_passage_worksheets" ADD CONSTRAINT "is_passage_worksheets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "is_passage_lines" ADD CONSTRAINT "is_passage_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "is_passage_lines" ADD CONSTRAINT "is_passage_lines_worksheet_id_fkey" FOREIGN KEY ("worksheet_id") REFERENCES "is_passage_worksheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- is_brackets/is_cotisation_minimale_configs are deliberately NOT RLS'd: global reference
-- data, same status as tva_rates/ras_rules. is_passage_worksheets/is_passage_lines are
-- tenant-owned — same pattern as every phase since phase 1.

ALTER TABLE "is_passage_worksheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "is_passage_worksheets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "is_passage_worksheets"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "is_passage_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "is_passage_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "is_passage_lines"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

