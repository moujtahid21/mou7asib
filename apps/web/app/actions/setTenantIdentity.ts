"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

export type SetTenantIdentityState = { error: string } | null;

// Feeds the invoice mentions validator's issuer fields (CLAUDE.md §5.6) — free text, no
// format validation, since the ICE/IF check-digit algorithms (L-65/L-66) are still
// TODO(legal). settings:manage rather than invoice:write since this is standing tenant
// configuration, not a single invoice action.
export async function setTenantIdentity(_prevState: SetTenantIdentityState, formData: FormData): Promise<SetTenantIdentityState> {
  const session = await requireSession();
  if (!can(session.role, "settings:manage")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const field = (name: string): string | null => {
    const value = formData.get(name);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  };

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      ice: field("ice"),
      ifNumber: field("ifNumber"),
      rc: field("rc"),
      patente: field("patente"),
      cnss: field("cnss"),
    },
  });

  revalidatePath("/facturation");
  return null;
}
