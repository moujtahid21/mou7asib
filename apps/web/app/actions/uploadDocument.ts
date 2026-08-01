"use server";

import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";
import { scanBufferForMalware } from "@/lib/malwareScanner";

// D2 scope is camera capture only (no PDF path in the UI, confirmed scope
// decision) — the allowlist is narrowed to what a phone camera can actually
// produce, not CLAUDE.md §8.4's full list. Checked by magic bytes, never by
// extension or the client-declared Content-Type.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadState = { error: string } | null;

export async function uploadDocument(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucune photo reçue." };
  }

  const originalBytes = Buffer.from(await file.arrayBuffer());
  if (originalBytes.byteLength > MAX_UPLOAD_BYTES) {
    return { error: "Le fichier dépasse la taille maximale (20 Mo)." };
  }

  const detected = await fileTypeFromBuffer(originalBytes);
  if (detected === undefined || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    return { error: "Format non pris en charge. Utilisez une photo JPEG ou PNG." };
  }

  const scanResult = await scanBufferForMalware(originalBytes);
  if (scanResult.isInfected) {
    return { error: "Le fichier a été rejeté par l'analyse antivirus." };
  }

  // Auto-orient from EXIF (bakes rotation into pixels, otherwise a portrait
  // phone photo displays sideways once EXIF is stripped), then re-encode
  // without .withMetadata() — sharp strips all metadata (incl. GPS) by
  // default unless explicitly asked to keep it (CLAUDE.md §8.4).
  const normalized = sharp(originalBytes, { failOn: "none" }).rotate();
  const { data: normalizedBytes, info } =
    detected.mime === "image/png"
      ? await normalized.png().toBuffer({ resolveWithObject: true })
      : await normalized.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });

  if (info.width === undefined || info.height === undefined) {
    return { error: "Impossible de lire les dimensions de l'image." };
  }

  const contentHash = crypto
    .createHash("sha256")
    .update(normalizedBytes)
    .digest("hex")
    .slice(0, 16);
  const extension = detected.mime === "image/png" ? "png" : "jpg";

  // Duplicate detection (CLAUDE.md §7.2) — a re-upload of the same content
  // costs nothing and lands on the same document rather than a new row.
  const existing = await prisma.document.findUnique({
    where: { tenantId_contentHash: { tenantId: DEMO_TENANT_ID, contentHash } },
    select: { id: true },
  });

  let documentId: string;
  if (existing) {
    documentId = existing.id;
  } else {
    // Outside apps/web's public/static tree entirely — the only access path
    // is the authorized Route Handler in app/api/documents/[id]/image, not a
    // direct static URL. This is the demo-scoped simplification of §8.4's
    // "object storage with signed URLs" — same security property (no direct/
    // predictable/unauthorized access), different mechanism, documented here
    // and in the D2 plan rather than silently narrowed.
    const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
    const relativeStoragePath = path.join(
      "uploads",
      "documents",
      DEMO_TENANT_ID,
      `${contentHash}.${extension}`,
    );
    const absoluteStoragePath = path.join(repoRoot, relativeStoragePath);
    await mkdir(path.dirname(absoluteStoragePath), { recursive: true });
    await writeFile(absoluteStoragePath, normalizedBytes);

    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          contentHash,
          originalFilename: file.name.length > 0 ? file.name : `capture.${extension}`,
          mimeType: detected.mime,
          byteSize: normalizedBytes.byteLength,
          storagePath: relativeStoragePath,
          storedImageWidth: info.width,
          storedImageHeight: info.height,
          status: "queued",
        },
      });
      await tx.extractionJob.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          documentId: doc.id,
          status: "queued",
        },
      });
      return doc;
    });
    documentId = document.id;
  }

  redirect(`/documents/${documentId}`);
}
