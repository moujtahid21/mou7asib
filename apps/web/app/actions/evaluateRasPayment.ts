"use server";

import { redirect } from "next/navigation";
import { prisma, withTenant, Prisma } from "@mou7asib/db";
import { Decimal as AccountingDecimal, evaluateRasWithholding, type RasRuleConfig } from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

export type EvaluateRasState = { error: string } | null;

// CLAUDE.md §5.4 — "if the payment nature cannot be determined with confidence, flag it —
// never default to 'no retenue'." The rule table (packages/db) ships empty (no verified
// rates exist — see docs/legal-inputs.md L-38/L-39), so today every real evaluation
// flags; that IS the required behaviour, persisted here rather than silently discarded.
export async function evaluateRasPayment(_prevState: EvaluateRasState, formData: FormData): Promise<EvaluateRasState> {
  const session = await requireSession();
  if (!can(session.role, "ras:evaluate")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const field = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };

  const payeeName = field("payeeName");
  const paymentNature = field("paymentNature");
  const payeeType = field("payeeType");
  const residentStatus = field("residentStatus");
  const invoiceDateRaw = field("invoiceDate");
  const paymentDateRaw = field("paymentDate");
  const baseAmountRaw = field("baseAmount");

  if (payeeName.length === 0 || paymentNature.length === 0 || payeeType.length === 0 || residentStatus.length === 0) {
    return { error: "Bénéficiaire, nature du paiement, type de bénéficiaire et statut de résidence sont requis." };
  }
  const invoiceDate = new Date(invoiceDateRaw);
  const paymentDate = new Date(paymentDateRaw);
  if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    return { error: "Dates invalides." };
  }
  let baseAmount: InstanceType<typeof AccountingDecimal>;
  try {
    baseAmount = new AccountingDecimal(baseAmountRaw);
    if (baseAmount.lte(0)) {
      return { error: "Montant de base invalide." };
    }
  } catch {
    return { error: "Montant de base invalide." };
  }

  const ruleRows = await prisma.rasRule.findMany({
    select: { paymentNature: true, payeeType: true, residentStatus: true, rate: true, liabilityTrigger: true, effectiveFrom: true, effectiveTo: true },
  });
  const rules: RasRuleConfig[] = ruleRows.map((r) => ({
    paymentNature: r.paymentNature,
    payeeType: r.payeeType,
    residentStatus: r.residentStatus,
    rate: new AccountingDecimal(r.rate.toString()),
    liabilityTrigger: r.liabilityTrigger,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));

  const evaluation = evaluateRasWithholding(rules, { paymentNature, payeeType, residentStatus }, baseAmount, invoiceDate, paymentDate);

  await withTenant(session.tenantId, (tx) =>
    tx.rasWithholding.create({
      data: {
        tenantId: session.tenantId,
        payeeName,
        payeeType,
        residentStatus,
        paymentNature,
        invoiceDate,
        paymentDate,
        baseAmount: new Prisma.Decimal(baseAmount.toString()),
        status: evaluation.matched ? "computed" : "flagged",
        matchedRateAtEval: evaluation.rule === null ? null : new Prisma.Decimal(evaluation.rule.rate.toString()),
        rasAmount: evaluation.rasAmount === null ? null : new Prisma.Decimal(evaluation.rasAmount.toString()),
        netPayable: evaluation.netPayable === null ? null : new Prisma.Decimal(evaluation.netPayable.toString()),
        createdById: session.userId,
      },
    }),
  );

  redirect("/tva");
}
