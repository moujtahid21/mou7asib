import type { Prisma } from "@mou7asib/db";

// S6 (build-order.md) — retrieval + ranking over *this tenant's own* posted history only
// (CLAUDE.md §7.2: "never train, fine-tune, or share one tenant's data with another" —
// this is a same-tenant SQL query, not a model, so that boundary is automatic here, but
// the query is still always tenantId-scoped like everything else, CLAUDE.md §8.1). Never
// posts anything itself — see postDocumentEntry.ts, which still requires a human to
// confirm accounts before anything reaches the ledger (CLAUDE.md §5 rule 5).

export interface SuggestedAccount {
  code: string;
  label: string;
  /** How many of the matched historical entries used this account on this side. */
  frequency: number;
}

export interface PostingSuggestion {
  supplierName: string;
  /** Distinct prior documents from this supplier that were posted. */
  matchCount: number;
  earliestDate: Date;
  debitAccount: SuggestedAccount;
  creditAccount: SuggestedAccount;
}

/**
 * Looks for prior documents from the same supplier (exact, case-insensitive match on the
 * supplier_name field's current display value — override if corrected, else the model's
 * original) that were posted to the ledger, and ranks the accounts used on each side by
 * how often they appear. Returns null when there's no prior history to learn from, or
 * when the top debit/credit accounts are each used by fewer than MIN_MATCHES documents —
 * a single coincidental precedent isn't enough to suggest anything (CLAUDE.md §14: a
 * plausible-sounding but wrong suggestion is worse than none).
 */
const MIN_MATCHES = 1;

export async function findPostingSuggestion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currentDocumentId: string,
  supplierName: string | null,
): Promise<PostingSuggestion | null> {
  const trimmed = supplierName?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }

  const priorEntries = await tx.journalEntry.findMany({
    where: {
      tenantId,
      status: "posted",
      sourceDocumentId: { not: null },
    },
    select: {
      date: true,
      sourceDocumentId: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          account: { select: { code: true, label: true } },
        },
      },
      sourceDocument: {
        select: {
          id: true,
          fields: {
            where: { fieldName: "supplier_name", groupName: null },
            select: { valueText: true, overrideValueText: true },
            take: 1,
          },
        },
      },
    },
  });

  const matches = priorEntries.filter((entry) => {
    if (entry.sourceDocumentId === null || entry.sourceDocumentId === currentDocumentId) {
      return false;
    }
    const field = entry.sourceDocument?.fields[0];
    if (field === undefined) {
      return false;
    }
    const displayed = (field.overrideValueText ?? field.valueText ?? "").trim();
    return displayed.length > 0 && displayed.toLowerCase() === trimmed.toLowerCase();
  });

  if (matches.length === 0) {
    return null;
  }

  const debitFrequency = new Map<string, { label: string; count: number }>();
  const creditFrequency = new Map<string, { label: string; count: number }>();
  for (const entry of matches) {
    for (const line of entry.lines) {
      const target = !line.debit.isZero() ? debitFrequency : !line.credit.isZero() ? creditFrequency : null;
      if (target === null) {
        continue;
      }
      const existing = target.get(line.account.code);
      target.set(line.account.code, { label: line.account.label, count: (existing?.count ?? 0) + 1 });
    }
  }

  const topOf = (freq: Map<string, { label: string; count: number }>): SuggestedAccount | null => {
    let best: SuggestedAccount | null = null;
    for (const [code, { label, count }] of freq) {
      if (best === null || count > best.frequency) {
        best = { code, label, frequency: count };
      }
    }
    return best;
  };

  const debitAccount = topOf(debitFrequency);
  const creditAccount = topOf(creditFrequency);
  if (debitAccount === null || creditAccount === null) {
    return null;
  }
  if (debitAccount.frequency < MIN_MATCHES || creditAccount.frequency < MIN_MATCHES) {
    return null;
  }

  const firstMatch = matches[0];
  if (firstMatch === undefined) {
    return null;
  }
  const earliestDate = matches.reduce(
    (earliest, entry) => (entry.date < earliest ? entry.date : earliest),
    firstMatch.date,
  );

  return {
    supplierName: trimmed,
    matchCount: matches.length,
    earliestDate,
    debitAccount,
    creditAccount,
  };
}
