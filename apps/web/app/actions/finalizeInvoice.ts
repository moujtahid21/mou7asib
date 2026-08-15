"use server";

import { redirect } from "next/navigation";
import { withTenant, prisma, Prisma } from "@mou7asib/db";
import {
  Decimal as AccountingDecimal,
  computeTvaLines,
  validateMentions,
  hasBlockingIssues,
  type TvaRateConfig,
} from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { INVOICE_SERIES_CODE } from "@/lib/invoicing";

// The only place an invoice's sequence number is allocated — CLAUDE.md §5.6: "per-tenant,
// per-series database sequence inside the same transaction as the invoice insert". Prisma
// compiles this upsert to a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
// statement, so two concurrent finalisations serialise on the counter row's lock rather
// than racing — the second transaction blocks until the first commits or rolls back,
// which is what makes "no gap, no reuse" hold (see packages/db/withTenant.test.ts's sibling
// concurrency test for this table, invoiceSequence.test.ts).
async function allocateInvoiceNumber(tx: Prisma.TransactionClient, tenantId: string, seriesCode: string): Promise<number> {
  const counter = await tx.invoiceSeriesCounter.upsert({
    where: { tenantId_seriesCode: { tenantId, seriesCode } },
    create: { tenantId, seriesCode, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  return counter.nextNumber - 1;
}

export async function finalizeInvoice(invoiceId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "invoice:write")) {
    redirect(`/facturation?error=forbidden`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, ice: true, ifNumber: true, rc: true, patente: true, cnss: true },
  });
  const tvaRateRows = await prisma.tvaRate.findMany({
    select: { rateCode: true, rate: true, effectiveFrom: true, effectiveTo: true },
  });
  const configuredRates: TvaRateConfig[] = tvaRateRows.map((r) => ({
    rateCode: r.rateCode,
    rate: new AccountingDecimal(r.rate.toString()),
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));

  const outcome = await withTenant(session.tenantId, async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId: session.tenantId, status: "draft" },
      include: { lines: { orderBy: { lineOrder: "asc" } } },
    });
    if (invoice === null) {
      return "not_found" as const;
    }

    const tvaLines = invoice.lines.map((l) => ({
      baseHt: new AccountingDecimal(l.quantity.toString()).times(new AccountingDecimal(l.unitPriceHt.toString())),
      rateCode: l.rateCode,
    }));
    const computation = computeTvaLines(tvaLines, configuredRates, invoice.issueDate);
    const unresolvedRateCodes = [...new Set(computation.unresolved.map((l) => l.rateCode))];

    const issues = validateMentions({
      issuerName: tenant?.name ?? null,
      issuerIce: tenant?.ice ?? null,
      issuerIf: tenant?.ifNumber ?? null,
      issuerRc: tenant?.rc ?? null,
      issuerPatente: tenant?.patente ?? null,
      issuerCnss: tenant?.cnss ?? null,
      customerName: invoice.customerName,
      customerIce: invoice.customerIce,
      invoiceDate: invoice.issueDate,
      paymentTerms: invoice.paymentTerms,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: new AccountingDecimal(l.quantity.toString()),
        unitPriceHt: new AccountingDecimal(l.unitPriceHt.toString()),
        rateCode: l.rateCode,
      })),
      unresolvedRateCodes,
    });
    if (hasBlockingIssues(issues)) {
      return { kind: "blocked" as const, issues };
    }

    const totalHt = computation.resolved.reduce((acc, l) => acc.plus(l.baseHt), new AccountingDecimal(0));
    const totalTva = computation.resolved.reduce((acc, l) => acc.plus(l.tvaAmount), new AccountingDecimal(0));

    const number = await allocateInvoiceNumber(tx, session.tenantId, INVOICE_SERIES_CODE);
    const year = invoice.issueDate.getUTCFullYear();
    const fullNumber = `${INVOICE_SERIES_CODE}-${year}-${String(number).padStart(6, "0")}`;

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        seriesCode: INVOICE_SERIES_CODE,
        number,
        fullNumber,
        status: "finalized",
        finalizedAt: new Date(),
        totalHt: new Prisma.Decimal(totalHt.toString()),
        totalTva: new Prisma.Decimal(totalTva.toString()),
        totalTtc: new Prisma.Decimal(totalHt.plus(totalTva).toString()),
      },
    });

    return { kind: "finalized" as const, fullNumber };
  });

  if (outcome === "not_found") {
    redirect(`/facturation?error=not_found`);
  }
  if (outcome.kind === "blocked") {
    const firstIssues = outcome.issues
      .filter((i) => i.blocking)
      .slice(0, 3)
      .map((i) => i.message)
      .join(" | ");
    redirect(`/facturation?error=mentions&detail=${encodeURIComponent(firstIssues)}`);
  }
  redirect(`/facturation?finalized=${encodeURIComponent(outcome.fullNumber)}`);
}
