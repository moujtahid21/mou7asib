"use server";

import { redirect } from "next/navigation";
import { withTenant, Prisma } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { MAX_INVOICE_LINES } from "@/lib/invoicing";

export type CreateInvoiceState = { error: string } | null;

interface RawLine {
  description: string;
  quantity: string;
  unitPriceHt: string;
  rateCode: string;
}

function parseLines(formData: FormData): RawLine[] {
  const lines: RawLine[] = [];
  for (let i = 0; i < MAX_INVOICE_LINES; i++) {
    const descriptionField = formData.get(`description_${i}`);
    const description = typeof descriptionField === "string" ? descriptionField.trim() : "";
    if (description.length === 0) {
      continue;
    }
    const quantityField = formData.get(`quantity_${i}`);
    const unitPriceField = formData.get(`unitPriceHt_${i}`);
    const rateCodeField = formData.get(`rateCode_${i}`);
    lines.push({
      description,
      quantity: typeof quantityField === "string" ? quantityField.trim() : "",
      unitPriceHt: typeof unitPriceField === "string" ? unitPriceField.trim() : "",
      rateCode: typeof rateCodeField === "string" ? rateCodeField.trim() : "",
    });
  }
  return lines;
}

export async function createInvoiceDraft(_prevState: CreateInvoiceState, formData: FormData): Promise<CreateInvoiceState> {
  const session = await requireSession();
  if (!can(session.role, "invoice:write")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const customerNameField = formData.get("customerName");
  const customerName = typeof customerNameField === "string" ? customerNameField.trim() : "";
  if (customerName.length === 0) {
    return { error: "Nom du client requis." };
  }
  const customerIceField = formData.get("customerIce");
  const customerIce = typeof customerIceField === "string" && customerIceField.trim().length > 0 ? customerIceField.trim() : null;
  const customerIfField = formData.get("customerIf");
  const customerIf = typeof customerIfField === "string" && customerIfField.trim().length > 0 ? customerIfField.trim() : null;

  const issueDateField = formData.get("issueDate");
  if (typeof issueDateField !== "string" || Number.isNaN(Date.parse(issueDateField))) {
    return { error: "Date de facture invalide." };
  }
  const issueDate = new Date(issueDateField);

  const paymentTermsField = formData.get("paymentTerms");
  const paymentTerms = typeof paymentTermsField === "string" && paymentTermsField.trim().length > 0 ? paymentTermsField.trim() : null;

  const rawLines = parseLines(formData);
  if (rawLines.length === 0) {
    return { error: "Au moins une ligne requise." };
  }

  let lines: { description: string; quantity: Prisma.Decimal; unitPriceHt: Prisma.Decimal; rateCode: string }[];
  try {
    lines = rawLines.map((line) => {
      if (line.rateCode.length === 0) {
        throw new Error(`Taux TVA requis pour "${line.description}".`);
      }
      return {
        description: line.description,
        quantity: new Prisma.Decimal(line.quantity || "0"),
        unitPriceHt: new Prisma.Decimal(line.unitPriceHt || "0"),
        rateCode: line.rateCode,
      };
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ligne invalide." };
  }

  const invoiceId = await withTenant(session.tenantId, async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        tenantId: session.tenantId,
        customerName,
        customerIce,
        customerIf,
        issueDate,
        paymentTerms,
        status: "draft",
        createdById: session.userId,
      },
    });

    let lineOrder = 0;
    for (const line of lines) {
      await tx.invoiceLine.create({
        data: {
          tenantId: session.tenantId,
          invoiceId: invoice.id,
          description: line.description,
          quantity: line.quantity,
          unitPriceHt: line.unitPriceHt,
          rateCode: line.rateCode,
          lineOrder,
        },
      });
      lineOrder += 1;
    }

    return invoice.id;
  });

  redirect(`/facturation?draft=${invoiceId}`);
}
