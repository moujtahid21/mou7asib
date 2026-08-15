"use server";

import { redirect } from "next/navigation";
import { withTenant, Prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §5.5 — "every pre-filled line must carry an explanation." Enforced here
// (required, non-blank) rather than left optional in the form. Blocked once the
// worksheet is validated — an app-level check, not a DB trigger (see schema comment on
// IsPassageWorksheet for why that's a deliberately lighter guarantee than the ledger's).
export async function addIsPassageLine(worksheetId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "is:manage")) {
    redirect("/tva?error=forbidden");
  }

  const kindField = formData.get("kind");
  const labelField = formData.get("label");
  const amountField = formData.get("amount");
  const explanationField = formData.get("explanation");
  if (
    (kindField !== "reintegration" && kindField !== "deduction") ||
    typeof labelField !== "string" ||
    labelField.trim().length === 0 ||
    typeof amountField !== "string" ||
    typeof explanationField !== "string" ||
    explanationField.trim().length === 0
  ) {
    redirect("/tva?error=is_line");
  }

  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(amountField);
    if (amount.lte(0)) {
      redirect("/tva?error=is_line");
    }
  } catch {
    redirect("/tva?error=is_line");
  }

  await withTenant(session.tenantId, async (tx) => {
    const worksheet = await tx.isPassageWorksheet.findFirst({
      where: { id: worksheetId, tenantId: session.tenantId, status: "draft" },
      select: { id: true },
    });
    if (worksheet === null) {
      return;
    }
    const lineCount = await tx.isPassageLine.count({ where: { worksheetId, tenantId: session.tenantId } });
    await tx.isPassageLine.create({
      data: {
        tenantId: session.tenantId,
        worksheetId,
        kind: kindField,
        label: labelField.trim(),
        amount,
        explanation: explanationField.trim(),
        lineOrder: lineCount,
      },
    });
  });

  redirect("/tva");
}
