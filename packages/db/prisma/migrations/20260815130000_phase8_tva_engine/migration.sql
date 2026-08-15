-- CreateEnum
CREATE TYPE "tva_regime" AS ENUM ('encaissement', 'debit');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "tva_regime" "tva_regime";

-- CreateTable
CREATE TABLE "tva_rates" (
    "id" UUID NOT NULL,
    "rate_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "legal_source_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tva_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tva_cash_thresholds" (
    "id" UUID NOT NULL,
    "threshold_amount" DECIMAL(19,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT true,
    "legal_source_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tva_cash_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tva_rates_rate_code_effective_from_key" ON "tva_rates"("rate_code", "effective_from");

