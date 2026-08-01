import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";

// CLAUDE.md §8.4 — the demo-scoped substitute for a pre-signed URL: a
// per-request authorization check (tenantId match) instead of a time-limited
// signature. Files live outside apps/web's public/static tree entirely, so
// this route is the only path that can ever reach them.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, tenantId: DEMO_TENANT_ID },
    select: { storagePath: true, mimeType: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
  const uploadsRoot = path.join(repoRoot, "uploads");
  const absolutePath = path.resolve(repoRoot, document.storagePath);

  // Defense in depth: storagePath is always server-generated, never client
  // input, but refuse to serve anything outside the uploads root regardless.
  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
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
