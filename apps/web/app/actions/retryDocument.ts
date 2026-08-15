"use server";

import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";

// A new ExtractionJob row, not a reuse/reset of the failed one —
// ExtractionJob.attemptCount already tracks job-claim attempts (queue
// mechanics), a different concept from ExtractionAttempt.attemptNumber
// (extract_document's own internal model-call retry loop). A new row
// preserves the failed job's history (CLAUDE.md §7.1's audit-record
// requirement) rather than overwriting it — mirrors Document.currentAttemptId's
// existing "reprocess creates a new attempt, repoints, doesn't delete"
// pattern one level up. See the D2 dashboard-extension plan.
export async function retryDocument(documentId: string): Promise<void> {
  const session = await requireSession();

  await withTenant(session.tenantId, async (tx) => {
    const document = await tx.document.findFirst({
      where: { id: documentId, ...visibleDocumentWhere(session.tenantId) },
      select: { status: true },
    });
    if (!document || document.status !== "failed") {
      // Not retryable — nothing to do.
      return;
    }

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
      data: { tenantId: session.tenantId, documentId, status: "queued" },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: "queued" },
    });
  });

  redirect(`/documents/${documentId}`);
}
