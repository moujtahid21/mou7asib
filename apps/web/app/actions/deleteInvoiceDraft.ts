"use server";

import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// Only drafts (unnumbered, never touched the sequence) may be deleted — the immutability
// trigger blocks this outright once finalized, this is just the honest error path instead
// of an uncaught exception (same pattern as postJournalEntry.ts's locked-period check).
export async function deleteInvoiceDraft(invoiceId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "invoice:write")) {
    redirect("/facturation?error=forbidden");
  }

  await withTenant(session.tenantId, async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId: session.tenantId, status: "draft" },
      select: { id: true },
    });
    if (invoice === null) {
      return;
    }
    await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id, tenantId: session.tenantId } });
    await tx.invoice.delete({ where: { id: invoice.id } });
  });

  redirect("/facturation");
}
