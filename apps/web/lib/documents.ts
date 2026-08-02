import path from "node:path";
import { Prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";

// Every query against Document (and every join that needs to respect a
// document's visibility) must include this — centralizes both the tenant
// scope and the soft-delete filter so neither can be forgotten at a new call
// site, same spirit as lib/tenant.ts centralizing DEMO_TENANT_ID itself.
export function visibleDocumentWhere(): Prisma.DocumentWhereInput {
  return { tenantId: DEMO_TENANT_ID, deletedAt: null };
}

// Shared by the image/preview Route Handlers: resolves a Document's stored
// relative path to an absolute one, refusing anything outside uploads/ even
// though storagePath/previewImagePath are always server-generated, never
// client input — defense in depth, CLAUDE.md §8.4.
export function resolveUploadPath(relativePath: string): string | null {
  const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..");
  const uploadsRoot = path.join(repoRoot, "uploads");
  const absolutePath = path.resolve(repoRoot, relativePath);

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }
  return absolutePath;
}
