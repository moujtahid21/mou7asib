"use server";

import { redirect } from "next/navigation";
import { withTenant } from "@mou7asib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { findOrCreatePeriod } from "@/lib/ledger";

// The DB trigger (packages/db's phase2_ledger migration) is the real backstop for "never
// post into a locked period" — this application-level check exists so a locked period
// produces a normal redirect-with-message instead of an uncaught Postgres exception
// hitting Next's generic error boundary (CLAUDE.md §13: user errors get an actionable
// message, not a raw stack trace).
export async function postJournalEntry(entryId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "ledger:write")) {
    redirect(`/tva?entry=${entryId}&error=forbidden`);
  }

  const outcome = await withTenant(session.tenantId, async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: entryId, tenantId: session.tenantId },
      select: { id: true, date: true, status: true },
    });
    if (entry === null || entry.status !== "draft") {
      return "not_found" as const;
    }
    const period = await findOrCreatePeriod(tx, session.tenantId, entry.date);
    if (period.status === "locked") {
      return "period_locked" as const;
    }
    await tx.journalEntry.update({
      where: { id: entryId },
      data: { status: "posted", periodId: period.id, postedAt: new Date() },
    });
    return "posted" as const;
  });

  if (outcome === "posted") {
    redirect(`/tva?entry=${entryId}`);
  }
  redirect(`/tva?entry=${entryId}&error=${outcome}`);
}
