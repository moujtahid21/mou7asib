-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "source_document_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_source_document_id_key" ON "journal_entries"("source_document_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

