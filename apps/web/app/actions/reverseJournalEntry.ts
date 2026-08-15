"use server";

import { redirect } from "next/navigation";
import { withTenant, Prisma } from "@mou7asib/db";
import { buildReversingEntry, Decimal as AccountingDecimal, type JournalLineInput } from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { findOrCreatePeriod } from "@/lib/ledger";

type Outcome =
  | { kind: "not_found" }
  | { kind: "already_reversed"; reversalId: string }
  | { kind: "reversed"; reversalId: string }
  | { kind: "reversed_but_period_locked"; reversalId: string };

// CLAUDE.md §2 rule 3 — the only way to correct a posted entry. Builds the écriture
// d'extourne (packages/accounting's buildReversingEntry — every line's debit/credit
// swapped, proven balanced by its own property test) and posts it immediately, dated
// today: an extourne's whole purpose is to cancel the original's effect right away, not
// sit around as an unposted draft.
export async function reverseJournalEntry(entryId: string): Promise<void> {
  const session = await requireSession();
  if (!can(session.role, "ledger:write")) {
    redirect(`/tva?entry=${entryId}&error=forbidden`);
  }

  const outcome: Outcome = await withTenant(session.tenantId, async (tx) => {
    const original = await tx.journalEntry.findFirst({
      where: { id: entryId, tenantId: session.tenantId },
      select: {
        id: true,
        status: true,
        journalCode: true,
        label: true,
        reversedByEntry: { select: { id: true } },
        lines: { select: { debit: true, credit: true, label: true, account: { select: { code: true } } } },
      },
    });
    if (original === null || original.status !== "posted") {
      return { kind: "not_found" };
    }
    if (original.reversedByEntry !== null) {
      return { kind: "already_reversed", reversalId: original.reversedByEntry.id };
    }

    const originalLines: JournalLineInput[] = original.lines.map((line) => ({
      accountCode: line.account.code,
      debit: new AccountingDecimal(line.debit.toString()),
      credit: new AccountingDecimal(line.credit.toString()),
      label: line.label ?? undefined,
    }));
    const reversalDate = new Date();
    const reversal = buildReversingEntry(
      { date: reversalDate, journalCode: original.journalCode, label: original.label, lines: originalLines },
      reversalDate,
    );

    const accounts = await tx.account.findMany({
      where: { tenantId: session.tenantId, code: { in: reversal.lines.map((line) => line.accountCode) } },
      select: { id: true, code: true },
    });
    const accountIdByCode = new Map(accounts.map((account) => [account.code, account.id]));

    const reversalEntry = await tx.journalEntry.create({
      data: {
        tenantId: session.tenantId,
        date: reversal.date,
        journalCode: reversal.journalCode,
        label: reversal.label,
        status: "draft",
        reversesEntryId: original.id,
      },
    });

    let lineOrder = 0;
    for (const line of reversal.lines) {
      const accountId = accountIdByCode.get(line.accountCode);
      if (accountId === undefined) {
        throw new Error(`Compte inconnu : ${line.accountCode}`);
      }
      await tx.journalLine.create({
        data: {
          tenantId: session.tenantId,
          entryId: reversalEntry.id,
          accountId,
          debit: new Prisma.Decimal(line.debit.toString()),
          credit: new Prisma.Decimal(line.credit.toString()),
          label: line.label ?? null,
          lineOrder,
        },
      });
      lineOrder += 1;
    }

    // Same locked-period guard as postJournalEntry.ts — if it fires, the reversal still
    // exists (as a draft, linked to the original via reversesEntryId) so nothing is lost;
    // it just isn't posted yet.
    const period = await findOrCreatePeriod(tx, session.tenantId, reversal.date);
    if (period.status === "locked") {
      return { kind: "reversed_but_period_locked", reversalId: reversalEntry.id };
    }
    await tx.journalEntry.update({
      where: { id: reversalEntry.id },
      data: { status: "posted", periodId: period.id, postedAt: new Date() },
    });

    return { kind: "reversed", reversalId: reversalEntry.id };
  });

  if (outcome.kind === "not_found") {
    redirect(`/tva?entry=${entryId}&error=not_found`);
  }
  redirect(`/tva?entry=${outcome.reversalId}${outcome.kind === "reversed_but_period_locked" ? "&error=period_locked" : ""}`);
}
