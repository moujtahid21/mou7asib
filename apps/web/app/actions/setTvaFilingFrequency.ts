"use server";

import { revalidatePath } from "next/cache";
import { prisma, type TvaFilingFrequency } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §5.3 — real frequency derivation needs a turnover threshold that's still
// TODO(legal) (L-17), so this is never auto-computed; the owner picks explicitly instead
// of the app guessing from an unverified number.
export async function setTvaFilingFrequency(frequency: TvaFilingFrequency): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "settings:manage")) {
    return;
  }
  await prisma.tenant.update({ where: { id: session.tenantId }, data: { tvaFilingFrequency: frequency } });
  revalidatePath("/tva");
}
