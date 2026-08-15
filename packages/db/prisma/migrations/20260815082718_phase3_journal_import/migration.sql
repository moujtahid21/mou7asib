-- CreateTable
CREATE TABLE "journal_imports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "row_count" INTEGER NOT NULL,
    "entry_count" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_imports_tenant_id_idx" ON "journal_imports"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_imports_tenant_id_content_hash_key" ON "journal_imports"("tenant_id", "content_hash");

-- AddForeignKey
ALTER TABLE "journal_imports" ADD CONSTRAINT "journal_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_imports" ADD CONSTRAINT "journal_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Row Level Security (CLAUDE.md §8.1) ────────────────────────────────────
-- Same pattern as phase 1/2 — see phase1's migration comment for FORCE/NULLIF rationale.

ALTER TABLE "journal_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_imports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "journal_imports"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
