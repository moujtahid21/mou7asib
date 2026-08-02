-- AlterTable
ALTER TABLE "extracted_fields" ADD COLUMN     "corrected_at" TIMESTAMPTZ(6),
ADD COLUMN     "override_value_decimal" DECIMAL(19,4),
ADD COLUMN     "override_value_text" TEXT;
