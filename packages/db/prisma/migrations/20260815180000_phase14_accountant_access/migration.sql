
-- CreateEnum
CREATE TYPE "accountant_access_scope" AS ENUM ('read_only', 'read_write');

-- CreateTable
CREATE TABLE "accountant_accesses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "accountant_id" UUID NOT NULL,
    "scope" "accountant_access_scope" NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountant_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accountant_accesses_tenant_id_idx" ON "accountant_accesses"("tenant_id");

-- CreateIndex
CREATE INDEX "accountant_accesses_accountant_id_idx" ON "accountant_accesses"("accountant_id");

-- CreateIndex
CREATE UNIQUE INDEX "accountant_accesses_tenant_id_accountant_id_key" ON "accountant_accesses"("tenant_id", "accountant_id");

-- AddForeignKey
ALTER TABLE "accountant_accesses" ADD CONSTRAINT "accountant_accesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_accesses" ADD CONSTRAINT "accountant_accesses_accountant_id_fkey" FOREIGN KEY ("accountant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_accesses" ADD CONSTRAINT "accountant_accesses_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_accesses" ADD CONSTRAINT "accountant_accesses_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

