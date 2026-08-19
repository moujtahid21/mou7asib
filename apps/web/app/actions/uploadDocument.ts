"use server";

import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { scanBufferForMalware } from "@/lib/malwareScanner";

// Photos (camera capture) and PDFs (how Moroccan businesses commonly
// actually receive invoices — confirmed by a real-document test). Checked
// by magic bytes, never by extension or the client-declared Content-Type.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadState = { error: string } | null;

interface NormalizedUpload {
  bytes: Buffer;
  extension: string;
  width: number | null;
  height: number | null;
}

// Images get the full sharp pipeline (EXIF auto-orient + strip); PDFs have
// no EXIF concept and no image dimensions to measure at upload time — the
// worker rasterizes a preview and fills storedImageWidth/Height in once it
// processes the document (see apps/ai's worker.py / db.py).
async function normalizeUpload(bytes: Buffer, mime: string): Promise<NormalizedUpload | null> {
  if (mime === "application/pdf") {
    return { bytes, extension: "pdf", width: null, height: null };
  }

  // Auto-orient from EXIF (bakes rotation into pixels, otherwise a portrait
  // phone photo displays sideways once EXIF is stripped), then re-encode
  // without .withMetadata() — sharp strips all metadata (incl. GPS) by
  // default unless explicitly asked to keep it (CLAUDE.md §8.4).
  const normalized = sharp(bytes, { failOn: "none" }).rotate();
  const { data, info } =
    mime === "image/png"
      ? await normalized.png().toBuffer({ resolveWithObject: true })
      : await normalized.jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });

  if (info.width === undefined || info.height === undefined) {
    return null;
  }
  return { bytes: data, extension: mime === "image/png" ? "png" : "jpg", width: info.width, height: info.height };
}

export async function uploadDocument(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await requireSession();
  if (!can(session.role, "document:write")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier reçu." };
  }

  const originalBytes = Buffer.from(await file.arrayBuffer());
  if (originalBytes.byteLength > MAX_UPLOAD_BYTES) {
    return { error: "Le fichier dépasse la taille maximale (20 Mo)." };
  }

  const detected = await fileTypeFromBuffer(originalBytes);
  if (detected === undefined || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    return { error: "Format non pris en charge. Utilisez une photo JPEG/PNG ou un PDF." };
  }

  // CLAUDE.md §8.4 requires every upload scanned before it's trusted with
  // anything else, and §15 bans a silent "temporary" bypass of that — so a
  // scanner that can't be reached still fails the upload by default. The one
  // way past that is ALLOW_UNSCANNED_UPLOADS, an explicit, loud opt-out (not
  // a default): production currently has nowhere to run clamd (Vercel is
  // serverless, no persistent daemon — see docs/decision-log.md), a real,
  // tracked gap, not a hidden one. Every document that goes through without
  // being scanned is logged server-side so there's a paper trail once a real
  // scanner host exists to point CLAMD_HOST at.
  try {
    const scanResult = await scanBufferForMalware(originalBytes);
    if (scanResult.isInfected) {
      return { error: "Le fichier a été rejeté par l'analyse antivirus." };
    }
  } catch (error: unknown) {
    if (process.env["ALLOW_UNSCANNED_UPLOADS"] !== "true") {
      throw error;
    }
    console.error(
      "malware scan unavailable — document stored WITHOUT a virus scan (ALLOW_UNSCANNED_UPLOADS=true)",
      { tenantId: session.tenantId, filename: file.name },
      error,
    );
  }

  const normalized = await normalizeUpload(originalBytes, detected.mime);
  if (normalized === null) {
    return { error: "Impossible de lire les dimensions de l'image." };
  }
  const { bytes: normalizedBytes, extension, width, height } = normalized;

  const contentHash = crypto
    .createHash("sha256")
    .update(normalizedBytes)
    .digest("hex")
    .slice(0, 16);

  // Duplicate detection (CLAUDE.md §7.2) — a re-upload of the same content
  // costs nothing and lands on the same document rather than a new row.
  const existing = await withTenant(session.tenantId, (tx) =>
    tx.document.findUnique({
      where: { tenantId_contentHash: { tenantId: session.tenantId, contentHash } },
      select: { id: true },
    }),
  );

  let documentId: string;
  if (existing) {
    documentId = existing.id;
  } else {
    // Outside apps/web's public/static tree entirely — the only access path
    // is the authorized Route Handlers in app/api/documents/[id]/{image,preview},
    // not a direct static URL. This is the demo-scoped simplification of
    // §8.4's "object storage with signed URLs" — same security property (no
    // direct/predictable/unauthorized access), different mechanism,
    // documented here and in the D2 plan rather than silently narrowed.
    const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
    const relativeStoragePath = path.join(
      "uploads",
      "documents",
      session.tenantId,
      `${contentHash}.${extension}`,
    );
    const absoluteStoragePath = path.join(repoRoot, relativeStoragePath);
    await mkdir(path.dirname(absoluteStoragePath), { recursive: true });
    await writeFile(absoluteStoragePath, normalizedBytes);

    const document = await withTenant(session.tenantId, async (tx) => {
      const doc = await tx.document.create({
        data: {
          tenantId: session.tenantId,
          contentHash,
          originalFilename: file.name.length > 0 ? file.name : `document.${extension}`,
          mimeType: detected.mime,
          byteSize: normalizedBytes.byteLength,
          storagePath: relativeStoragePath,
          storedImageWidth: width,
          storedImageHeight: height,
          status: "queued",
        },
      });
      await tx.extractionJob.create({
        data: {
          tenantId: session.tenantId,
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
