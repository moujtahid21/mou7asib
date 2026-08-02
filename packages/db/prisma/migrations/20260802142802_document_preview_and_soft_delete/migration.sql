-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "preview_image_path" TEXT,
ALTER COLUMN "stored_image_width" DROP NOT NULL,
ALTER COLUMN "stored_image_height" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "documents_tenant_id_status_idx" ON "documents"("tenant_id", "status");
