"use server";

import { redirect } from "next/navigation";
import { withTenant, Prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// Snapshots the real résultat comptable (already computed by /tva's own CPC section,
// phase 10) into a new draft worksheet — CLAUDE.md §5.5: pre-filled from the ledger,
// frozen at creation so a later correction doesn't retroactively change an
// already-in-progress review.
export async function createIsPassageWorksheet(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "is:manage")) {
    redirect("/tva?error=forbidden");
  }

  const periodStartField = formData.get("periodStart");
  const periodEndField = formData.get("periodEnd");
  const resultatComptableField = formData.get("resultatComptable");
  if (typeof periodStartField !== "string" || typeof periodEndField !== "string" || typeof resultatComptableField !== "string") {
    redirect("/tva?error=is_period");
  }
  const periodStart = new Date(`${periodStartField}T00:00:00.000Z`);
  const periodEnd = new Date(`${periodEndField}T23:59:59.999Z`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
    redirect("/tva?error=is_period");
  }

  await withTenant(session.tenantId, (tx) =>
    tx.isPassageWorksheet.create({
      data: {
        tenantId: session.tenantId,
        periodStart,
        periodEnd,
        resultatComptable: new Prisma.Decimal(resultatComptableField),
        status: "draft",
        createdById: session.userId,
      },
    }),
  );

  redirect("/tva");
}
