-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'finalized');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "cnss" TEXT,
ADD COLUMN     "ice" TEXT,
ADD COLUMN     "if_number" TEXT,
ADD COLUMN     "patente" TEXT,
ADD COLUMN     "rc" TEXT;

-- CreateTable
CREATE TABLE "invoice_series_counters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "series_code" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_series_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "series_code" TEXT,
    "number" INTEGER,
    "full_number" TEXT,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "customer_name" TEXT NOT NULL,
    "customer_ice" TEXT,
    "customer_if" TEXT,
    "issue_date" DATE NOT NULL,
    "payment_terms" TEXT,
    "total_ht" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_tva" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_ttc" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_avoir" BOOLEAN NOT NULL DEFAULT false,
    "avoir_of_invoice_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMPTZ(6),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price_ht" DECIMAL(19,4) NOT NULL,
    "rate_code" TEXT NOT NULL,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_series_counters_tenant_id_idx" ON "invoice_series_counters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_series_counters_tenant_id_series_code_key" ON "invoice_series_counters"("tenant_id", "series_code");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_avoir_of_invoice_id_key" ON "invoices"("avoir_of_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_series_code_number_key" ON "invoices"("tenant_id", "series_code", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_tenant_id_idx" ON "invoice_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice_series_counters" ADD CONSTRAINT "invoice_series_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_avoir_of_invoice_id_fkey" FOREIGN KEY ("avoir_of_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- Same pattern as every phase since phase 1 — see that migration's comment for the
-- FORCE/NULLIF rationale.

ALTER TABLE "invoice_series_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_series_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoice_series_counters"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoices"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoice_lines"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ── Append-only once finalized (CLAUDE.md §5.6) ────────────────────────────
-- Same shape as journal_entries/journal_lines' immutability triggers (phase2_ledger
-- migration) — the draft->finalized transition itself is allowed (OLD.status is still
-- 'draft' at that moment); everything after is blocked. invoice_lines' trigger fires on
-- INSERT too, not just UPDATE/DELETE, for the same reason journal_lines' does: lines must
-- be fully assembled while the parent is still a draft.

CREATE OR REPLACE FUNCTION prevent_finalized_invoice_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'invoice % is finalized and append-only — use an avoir', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_immutability
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_finalized_invoice_mutation();

CREATE OR REPLACE FUNCTION prevent_finalized_invoice_line_mutation() RETURNS TRIGGER AS $$
DECLARE
  target_invoice_id UUID;
  invoice_status "invoice_status";
BEGIN
  target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO invoice_status FROM invoices WHERE id = target_invoice_id;
  IF invoice_status = 'finalized' THEN
    RAISE EXCEPTION 'invoice % is finalized and append-only — use an avoir', target_invoice_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_lines_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_finalized_invoice_line_mutation();

