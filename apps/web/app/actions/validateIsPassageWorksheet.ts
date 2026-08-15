"use server";

import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §5.5 — "nothing is treated as final until the user or their accountant
// validates it." This is that sign-off: independent of whether IS was actually
// computable (brackets/cotisation minimale may still be unconfigured — see
// packages/accounting/src/is.ts) — validating means "a human reviewed this working
// paper", not "the tax is correct".
export async function validateIsPassageWorksheet(worksheetId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "is:manage")) {
    redirect("/tva?error=forbidden");
  }

  await withTenant(session.tenantId, async (tx) => {
    const worksheet = await tx.isPassageWorksheet.findFirst({
      where: { id: worksheetId, tenantId: session.tenantId, status: "draft" },
      select: { id: true },
    });
    if (worksheet === null) {
      return;
    }
    await tx.isPassageWorksheet.update({
      where: { id: worksheet.id },
      data: { status: "validated", validatedById: session.userId, validatedAt: new Date() },
    });
  });

  redirect("/tva");
}
