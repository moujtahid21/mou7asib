"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";

// Soft-delete the row (CLAUDE.md §9: soft delete for user-facing, non-ledger
// records), hard-delete the file bytes on disk regardless — the raw image/
// PDF is the most sensitive artifact here, and there's no legal retention
// obligation yet blocking its immediate physical removal (CLAUDE.md §8.6).
// See the D2 dashboard-extension plan for the full rationale.
export async function deleteDocument(documentId: string): Promise<void> {
  const session = await requireSession();

  const document = await withTenant(session.tenantId, async (tx) => {
    const doc = await tx.document.findFirst({
      where: { id: documentId, ...visibleDocumentWhere(session.tenantId) },
      select: { storagePath: true, previewImagePath: true },
    });
    if (doc === null) {
      return null;
    }
    await tx.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    return doc;
  });

  if (!document) {
    // Already gone or never visible to this tenant — nothing to do.
    redirect("/documents");
  }

  const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
  const filesToRemove = [document.storagePath, document.previewImagePath].filter(
    (p): p is string => p !== null,
  );
  await Promise.all(
    filesToRemove.map((relativePath) =>
      unlink(path.join(repoRoot, relativePath)).catch(() => {
        // Best-effort — a missing file is not an error worth failing the
        // delete action over; the DB row is the source of truth for "deleted."
      }),
    ),
  );

  redirect("/documents");
}
