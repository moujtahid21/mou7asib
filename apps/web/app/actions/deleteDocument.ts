"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { prisma } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";

// Soft-delete the row (CLAUDE.md §9: soft delete for user-facing, non-ledger
// records), hard-delete the file bytes on disk regardless — the raw image/
// PDF is the most sensitive artifact here, and there's no legal retention
// obligation yet blocking its immediate physical removal (CLAUDE.md §8.6).
// See the D2 dashboard-extension plan for the full rationale.
export async function deleteDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ...visibleDocumentWhere() },
    select: { storagePath: true, previewImagePath: true },
  });

  if (!document) {
    // Already gone or never visible to this tenant — nothing to do.
    redirect("/documents");
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

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
