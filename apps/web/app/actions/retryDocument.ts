"use server";

import { redirect } from "next/navigation";
import { prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";
import { visibleDocumentWhere } from "@/lib/documents";

// A new ExtractionJob row, not a reuse/reset of the failed one —
// ExtractionJob.attemptCount already tracks job-claim attempts (queue
// mechanics), a different concept from ExtractionAttempt.attemptNumber
// (extract_document's own internal model-call retry loop). A new row
// preserves the failed job's history (CLAUDE.md §7.1's audit-record
// requirement) rather than overwriting it — mirrors Document.currentAttemptId's
// existing "reprocess creates a new attempt, repoints, doesn't delete"
// pattern one level up. See the D2 dashboard-extension plan.
export async function retryDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ...visibleDocumentWhere() },
    select: { status: true },
  });

  if (!document || document.status !== "failed") {
    // Not retryable — nothing to do, just go back to the document.
    redirect(`/documents/${documentId}`);
  }

  await prisma.$transaction(async (tx) => {
    // Idempotency guard (CLAUDE.md §10): refuse a second job if one is
    // already outstanding — a double-click doesn't create two competing jobs.
    const outstanding = await tx.extractionJob.findFirst({
      where: { documentId, status: { in: ["queued", "processing"] } },
      select: { id: true },
    });
    if (outstanding) {
      return;
    }

    await tx.extractionJob.create({
      data: { tenantId: DEMO_TENANT_ID, documentId, status: "queued" },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: "queued" },
    });
  });

  redirect(`/documents/${documentId}`);
}
