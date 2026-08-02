import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@mou7asib/db";
import { resolveUploadPath, visibleDocumentWhere } from "@/lib/documents";

// A raw PDF can't render inside an <img> tag — this serves a
// browser-displayable preview: for an image upload, storagePath itself IS
// the preview (identical bytes, no duplication); for a PDF, the worker
// rasterizes a first-page PNG (previewImagePath, apps/ai's worker.py) once
// it processes the document. See the /image route for the raw/download path,
// unchanged, and the D2 dashboard-extension plan for the full rationale.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, ...visibleDocumentWhere() },
    select: { storagePath: true, previewImagePath: true, mimeType: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const isImage = document.mimeType.startsWith("image/");
  const relativePath = isImage ? document.storagePath : document.previewImagePath;

  if (relativePath === null) {
    // PDF not yet rasterized (still processing, or rasterization failed) —
    // the UI shows an explicit "aperçu indisponible" fallback for this,
    // rather than a broken <img>.
    return NextResponse.json({ error: "Aperçu indisponible." }, { status: 404 });
  }

  const absolutePath = resolveUploadPath(relativePath);
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
      "Content-Type": isImage ? document.mimeType : "image/png",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
