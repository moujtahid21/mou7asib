"use server";

import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

// Confirms a lettrage match — never creates or edits a JournalLine (ADR 0003 point 4), only
// links an already-posted line to a bank transaction. Re-verifies the amount match
// server-side rather than trusting the transactionId/lineId pairing blindly: the pairing
// was computed for display by lib/bankMatching.ts in the page render, but this action is a
// separate request and the only real gate before anything is written.
export async function confirmBankMatch(transactionId: string, lineId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "bank:reconcile")) {
    redirect("/rapprochement?error=forbidden");
  }

  const outcome = await withTenant(session.tenantId, async (tx) => {
    const transaction = await tx.bankTransaction.findFirst({
      where: { id: transactionId, tenantId: session.tenantId, status: "unmatched" },
      select: { id: true, amount: true, bankAccountCode: true },
    });
    if (transaction === null) {
      return "not_found" as const;
    }

    const line = await tx.journalLine.findFirst({
      where: {
        id: lineId,
        tenantId: session.tenantId,
        entry: { status: "posted" },
        account: { code: transaction.bankAccountCode },
        matchedByBankTransaction: null,
      },
      select: { id: true, debit: true, credit: true },
    });
    if (line === null) {
      return "line_unavailable" as const;
    }

    const amountIsPositive = transaction.amount.greaterThan(0);
    const expected = amountIsPositive ? line.debit : line.credit;
    const actual = transaction.amount.abs();
    if (!expected.equals(actual)) {
      return "amount_mismatch" as const;
    }

    await tx.bankTransaction.update({
      where: { id: transaction.id },
      data: { status: "matched", matchedJournalLineId: line.id, matchedAt: new Date() },
    });
    return "matched" as const;
  });

  if (outcome === "matched") {
    redirect("/rapprochement");
  }
  redirect(`/rapprochement?error=${outcome}`);
}
