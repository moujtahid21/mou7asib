-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('uploaded', 'queued', 'processing', 'extracted', 'failed');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "extraction_path" AS ENUM ('text_layer', 'ocr');

-- CreateEnum
CREATE TYPE "extracted_field_type" AS ENUM ('string', 'date', 'decimal');

-- DropForeignKey
ALTER TABLE "stack_checks" DROP CONSTRAINT "stack_checks_tenantId_fkey";

-- DropTable
DROP TABLE "stack_checks";

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "content_hash" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "stored_image_width" INTEGER NOT NULL,
    "stored_image_height" INTEGER NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'uploaded',
    "current_attempt_id" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_attempts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "path" "extraction_path" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "raw_response" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_minor_units" INTEGER NOT NULL,
    "compute_ms" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_fields" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "group_name" TEXT,
    "group_index" INTEGER,
    "field_type" "extracted_field_type" NOT NULL,
    "value_text" TEXT,
    "value_decimal" DECIMAL(19,4),
    "confidence" DOUBLE PRECISION NOT NULL,
    "page_number" INTEGER NOT NULL DEFAULT 1,
    "bounding_box" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_current_attempt_id_key" ON "documents"("current_attempt_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_tenant_id_content_hash_key" ON "documents"("tenant_id", "content_hash");

-- CreateIndex
CREATE INDEX "extraction_jobs_tenant_id_idx" ON "extraction_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "extraction_jobs_document_id_idx" ON "extraction_jobs"("document_id");

-- CreateIndex
CREATE INDEX "extraction_jobs_status_idx" ON "extraction_jobs"("status");

-- CreateIndex
CREATE INDEX "extraction_attempts_tenant_id_idx" ON "extraction_attempts"("tenant_id");

-- CreateIndex
CREATE INDEX "extraction_attempts_document_id_idx" ON "extraction_attempts"("document_id");

-- CreateIndex
CREATE INDEX "extracted_fields_tenant_id_idx" ON "extracted_fields"("tenant_id");

-- CreateIndex
CREATE INDEX "extracted_fields_document_id_idx" ON "extracted_fields"("document_id");

-- CreateIndex
CREATE INDEX "extracted_fields_attempt_id_idx" ON "extracted_fields"("attempt_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_attempt_id_fkey" FOREIGN KEY ("current_attempt_id") REFERENCES "extraction_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_attempts" ADD CONSTRAINT "extraction_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "extraction_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_attempts" ADD CONSTRAINT "extraction_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_attempts" ADD CONSTRAINT "extraction_attempts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "extraction_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

