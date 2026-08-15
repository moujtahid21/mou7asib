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
import { AVOIR_SERIES_CODE } from "@/lib/invoicing";

async function allocateInvoiceNumber(tx: Prisma.TransactionClient, tenantId: string, seriesCode: string): Promise<number> {
  const counter = await tx.invoiceSeriesCounter.upsert({
    where: { tenantId_seriesCode: { tenantId, seriesCode } },
    create: { tenantId, seriesCode, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  return counter.nextNumber - 1;
}

// The only way to correct a finalized invoice (CLAUDE.md §5.6) — negates every line's
// quantity and posts a brand-new, immediately-finalized invoice in its own "AV" series
// (see lib/invoicing.ts's comment on why avoirs don't share the invoice sequence), dated
// today (the real correction date, not the original invoice date) and referencing the
// original via avoirOfInvoiceId.
export async function createAvoir(invoiceId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "invoice:write")) {
    redirect("/facturation?error=forbidden");
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
    const original = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId: session.tenantId, status: "finalized", isAvoir: false },
      include: { lines: { orderBy: { lineOrder: "asc" } }, avoirInvoice: { select: { id: true } } },
    });
    if (original === null) {
      return "not_found" as const;
    }
    if (original.avoirInvoice !== null) {
      return "already_has_avoir" as const;
    }

    const avoirDate = new Date();
    const negatedLines = original.lines.map((l) => ({
      description: l.description,
      quantity: new AccountingDecimal(l.quantity.toString()).negated(),
      unitPriceHt: new AccountingDecimal(l.unitPriceHt.toString()),
      rateCode: l.rateCode,
    }));

    const tvaLines = negatedLines.map((l) => ({ baseHt: l.quantity.times(l.unitPriceHt), rateCode: l.rateCode }));
    const computation = computeTvaLines(tvaLines, configuredRates, avoirDate);
    const unresolvedRateCodes = [...new Set(computation.unresolved.map((l) => l.rateCode))];

    const issues = validateMentions({
      issuerName: tenant?.name ?? null,
      issuerIce: tenant?.ice ?? null,
      issuerIf: tenant?.ifNumber ?? null,
      issuerRc: tenant?.rc ?? null,
      issuerPatente: tenant?.patente ?? null,
      issuerCnss: tenant?.cnss ?? null,
      customerName: original.customerName,
      customerIce: original.customerIce,
      invoiceDate: avoirDate,
      paymentTerms: original.paymentTerms,
      lines: negatedLines,
      unresolvedRateCodes,
      allowNegativeQuantity: true,
    });
    if (hasBlockingIssues(issues)) {
      return { kind: "blocked" as const };
    }

    const totalHt = computation.resolved.reduce((acc, l) => acc.plus(l.baseHt), new AccountingDecimal(0));
    const totalTva = computation.resolved.reduce((acc, l) => acc.plus(l.tvaAmount), new AccountingDecimal(0));

    // invoice_lines' immutability trigger fires on INSERT too (not just UPDATE/DELETE —
    // same lesson as journal_lines, see postDocumentEntry.ts's comment), so the avoir must
    // exist as a draft while its lines are inserted, then flip to finalized once complete —
    // it can't be created finalized in one step.
    const avoir = await tx.invoice.create({
      data: {
        tenantId: session.tenantId,
        customerName: original.customerName,
        customerIce: original.customerIce,
        customerIf: original.customerIf,
        issueDate: avoirDate,
        paymentTerms: original.paymentTerms,
        status: "draft",
        isAvoir: true,
        avoirOfInvoiceId: original.id,
        createdById: session.userId,
      },
    });

    let lineOrder = 0;
    for (const line of negatedLines) {
      await tx.invoiceLine.create({
        data: {
          tenantId: session.tenantId,
          invoiceId: avoir.id,
          description: line.description,
          quantity: new Prisma.Decimal(line.quantity.toString()),
          unitPriceHt: new Prisma.Decimal(line.unitPriceHt.toString()),
          rateCode: line.rateCode,
          lineOrder,
        },
      });
      lineOrder += 1;
    }

    const number = await allocateInvoiceNumber(tx, session.tenantId, AVOIR_SERIES_CODE);
    const year = avoirDate.getUTCFullYear();
    const fullNumber = `${AVOIR_SERIES_CODE}-${year}-${String(number).padStart(6, "0")}`;

    await tx.invoice.update({
      where: { id: avoir.id },
      data: {
        seriesCode: AVOIR_SERIES_CODE,
        number,
        fullNumber,
        status: "finalized",
        finalizedAt: new Date(),
        totalHt: new Prisma.Decimal(totalHt.toString()),
        totalTva: new Prisma.Decimal(totalTva.toString()),
        totalTtc: new Prisma.Decimal(totalHt.plus(totalTva).toString()),
      },
    });

    return { kind: "created" as const, fullNumber };
  });

  if (outcome === "not_found") {
    redirect("/facturation?error=not_found");
  }
  if (outcome === "already_has_avoir") {
    redirect("/facturation?error=already_has_avoir");
  }
  if (outcome.kind === "blocked") {
    redirect("/facturation?error=avoir_mentions");
  }
  redirect(`/facturation?finalized=${encodeURIComponent(outcome.fullNumber)}`);
}
