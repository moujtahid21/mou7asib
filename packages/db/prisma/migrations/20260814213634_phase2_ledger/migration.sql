-- CreateEnum
CREATE TYPE "period_status" AS ENUM ('open', 'locked');

-- CreateEnum
CREATE TYPE "journal_entry_status" AS ENUM ('draft', 'posted');

-- CreateTable
CREATE TABLE "reference_accounts" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_ar" TEXT NOT NULL,
    "class_digit" INTEGER NOT NULL,
    "parent_code" TEXT,

    CONSTRAINT "reference_accounts_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "class_digit" INTEGER NOT NULL,
    "parent_code" TEXT,
    "source_reference_code" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "period_status" NOT NULL DEFAULT 'open',

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "journal_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "journal_entry_status" NOT NULL DEFAULT 'draft',
    "period_id" UUID,
    "reverses_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "label" TEXT,
    "line_order" INTEGER NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_tenant_id_idx" ON "accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenant_id_code_key" ON "accounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "periods_tenant_id_idx" ON "periods"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "periods_tenant_id_start_date_end_date_key" ON "periods"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reverses_entry_id_key" ON "journal_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_idx" ON "journal_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_status_idx" ON "journal_entries"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "journal_entries_period_id_idx" ON "journal_entries"("period_id");

-- CreateIndex
CREATE INDEX "journal_lines_tenant_id_idx" ON "journal_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "journal_lines_entry_id_idx" ON "journal_lines"("entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- AddForeignKey
ALTER TABLE "reference_accounts" ADD CONSTRAINT "reference_accounts_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "reference_accounts"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- Same pattern as phase 1 — see that migration's comment for FORCE/NULLIF rationale.
-- reference_accounts is deliberately NOT RLS'd: it's global reference data (CLAUDE.md
-- §5.1 — "never mutate the shared reference plan per tenant"), not tenant-owned.

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "accounts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "periods"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "journal_entries"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "journal_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "journal_lines"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ── Line shape (CLAUDE.md §2 rule 1/2) ─────────────────────────────────────
-- Exactly one of debit/credit is non-zero per line — a row-local invariant, plain CHECK.

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_debit_xor_credit"
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit <> 0 OR credit <> 0));

-- ── Entry balance (CLAUDE.md §2 rule 2) ────────────────────────────────────
-- Cross-row invariant — Postgres CHECK constraints can't span rows, so this needs a
-- trigger. DEFERRABLE INITIALLY DEFERRED: the check runs at COMMIT, not after each
-- individual line insert, so building an entry's lines one at a time in one transaction
-- works — only the final, committed state has to balance.

CREATE OR REPLACE FUNCTION check_journal_entry_balance() RETURNS TRIGGER AS $$
DECLARE
  target_entry_id UUID;
  imbalance NUMERIC;
BEGIN
  target_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
    INTO imbalance
    FROM journal_lines
    WHERE entry_id = target_entry_id;
  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'journal entry % does not balance: debit - credit = %', target_entry_id, imbalance;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_lines_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balance();

-- ── Append-only once posted (CLAUDE.md §2 rule 3) ──────────────────────────
-- Draft entries/lines are freely editable (application-level review/correction before
-- posting); once an entry's status is 'posted', neither it nor its lines may change —
-- the only path forward is a reversing entry. The entry's own draft->posted transition
-- is itself allowed here: OLD.status is still 'draft' at that moment, so the check only
-- blocks mutations that happen *after* posting, not the post itself.

CREATE OR REPLACE FUNCTION prevent_posted_entry_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'journal entry % is posted and append-only — use a reversing entry', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_immutability
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_entry_mutation();

CREATE OR REPLACE FUNCTION prevent_posted_entry_line_mutation() RETURNS TRIGGER AS $$
DECLARE
  target_entry_id UUID;
  entry_status "journal_entry_status";
BEGIN
  target_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT status INTO entry_status FROM journal_entries WHERE id = target_entry_id;
  IF entry_status = 'posted' THEN
    RAISE EXCEPTION 'journal entry % is posted and append-only — use a reversing entry', target_entry_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_lines_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_entry_line_mutation();

-- ── Closed periods are immutable (CLAUDE.md §2 rule 4) ─────────────────────
-- Nothing may post (INSERT with status='posted', or UPDATE into status='posted') into a
-- locked period, and posting always requires a period to be set — no post without one.

CREATE OR REPLACE FUNCTION prevent_post_into_locked_period() RETURNS TRIGGER AS $$
DECLARE
  covering_period_status "period_status";
BEGIN
  IF NEW.status = 'posted' THEN
    IF NEW.period_id IS NULL THEN
      RAISE EXCEPTION 'cannot post journal entry % without a period', NEW.id;
    END IF;
    SELECT status INTO covering_period_status FROM periods WHERE id = NEW.period_id;
    IF covering_period_status = 'locked' THEN
      RAISE EXCEPTION 'cannot post journal entry % into a locked period', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_period_lock_check
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_post_into_locked_period();
