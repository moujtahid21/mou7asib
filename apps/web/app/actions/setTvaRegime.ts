"use server";

import { revalidatePath } from "next/cache";
import { prisma, type TvaRegime } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §5.3 — must never be assumed. Setting it is a real, explicit tenant decision,
// not a default; settings:manage rather than ledger:write since it's a standing
// configuration change, not a single posting.
export async function setTvaRegime(regime: TvaRegime): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "settings:manage")) {
    return;
  }
  await prisma.tenant.update({ where: { id: session.tenantId }, data: { tvaRegime: regime } });
  revalidatePath("/tva");
  revalidatePath("/documents");
}
