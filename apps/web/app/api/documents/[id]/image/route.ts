import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { withTenant } from "@mou7asib/db";
import { resolveUploadPath, visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";

// CLAUDE.md §8.4 — the demo-scoped substitute for a pre-signed URL: a
// per-request authorization check (tenantId + not-deleted) instead of a
// time-limited signature. Files live outside apps/web's public/static tree
// entirely, so this route is the only path that can ever reach them. This
// always serves the raw source file (download/original), whatever its mime
// type — for a browser-displayable preview (PDFs can't render in <img>),
// see the sibling /preview route.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireSession();
  const { id } = await params;

  const document = await withTenant(session.tenantId, (tx) =>
    tx.document.findFirst({
      where: { id, ...visibleDocumentWhere(session.tenantId) },
      select: { storagePath: true, mimeType: true },
    }),
  );

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const absolutePath = resolveUploadPath(document.storagePath);
  if (absolutePath === null) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }

  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  return new Response(new Uint8Array(fileBytes), {
    headers: {
      "Content-Type": document.mimeType,
      // Content is addressed by contentHash — immutable, safe to cache hard.
      // "private" since this is per-tenant, never CDN/shared-cacheable.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
