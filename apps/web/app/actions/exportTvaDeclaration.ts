"use server";

import { redirect } from "next/navigation";
import { withTenant, prisma, Prisma } from "@mou7asib/db";
import { Decimal as AccountingDecimal, ADAPTER_VERSION } from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// CLAUDE.md §5.3 — "Always show the user the figures before export, and log what was
// exported." The figures shown on /tva ARE what gets exported (same query, recomputed
// here rather than trusting client-submitted totals — the export record is the audit
// trail, not the display). ADAPTER_VERSION is always "placeholder-v0" today — see
// packages/accounting/src/filings/simpl's comment on why there's no real DGI format yet.
export async function exportTvaDeclaration(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "tva:declare")) {
    redirect("/tva?error=forbidden");
  }

  const periodStartField = formData.get("periodStart");
  const periodEndField = formData.get("periodEnd");
  if (typeof periodStartField !== "string" || typeof periodEndField !== "string") {
    redirect("/tva?error=declaration_period");
  }
  const periodStart = new Date(`${periodStartField}T00:00:00.000Z`);
  const periodEnd = new Date(`${periodEndField}T23:59:59.999Z`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
    redirect("/tva?error=declaration_period");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { tvaRegime: true } });

  const exportId = await withTenant(session.tenantId, async (tx) => {
    const lines = await tx.journalLine.findMany({
      where: {
        tenantId: session.tenantId,
        entry: { status: "posted", date: { gte: periodStart, lte: periodEnd } },
        account: { code: { in: ["34552", "4455"] } },
      },
      select: { debit: true, credit: true, account: { select: { code: true } } },
    });

    let totalDeductible = new AccountingDecimal(0);
    let totalCollectee = new AccountingDecimal(0);
    for (const line of lines) {
      if (line.account.code === "34552") {
        totalDeductible = totalDeductible.plus(new AccountingDecimal(line.debit.toString())).minus(new AccountingDecimal(line.credit.toString()));
      } else if (line.account.code === "4455") {
        totalCollectee = totalCollectee.plus(new AccountingDecimal(line.credit.toString())).minus(new AccountingDecimal(line.debit.toString()));
      }
    }
    const totalDue = totalCollectee.minus(totalDeductible);

    const record = await tx.tvaDeclarationExport.create({
      data: {
        tenantId: session.tenantId,
        periodStart,
        periodEnd,
        regime: tenant?.tvaRegime ?? null,
        totalCollectee: new Prisma.Decimal(totalCollectee.toString()),
        totalDeductible: new Prisma.Decimal(totalDeductible.toString()),
        totalDue: new Prisma.Decimal(totalDue.toString()),
        adapterVersion: ADAPTER_VERSION,
        exportedById: session.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "tva_declaration_exported",
        targetType: "TvaDeclarationExport",
        targetId: record.id,
        after: {
          periodStart: periodStartField,
          periodEnd: periodEndField,
          totalDue: totalDue.toString(),
          adapterVersion: ADAPTER_VERSION,
        },
      },
    });

    return record.id;
  });

  redirect(`/tva?exported=${exportId}`);
}
