import type { Money } from "@mou7asib/accounting";

// Real matching over the tenant's own open ledger lines — same spirit as
// lib/postingSuggestion.ts (S6): retrieval + ranking over this tenant's own data, shown as
// a suggestion, never auto-confirmed (ADR 0003 point 4 / CLAUDE.md §5 rule 5). The
// similarity function here is amount-exact + date-proximity rather than supplier
// frequency, because that's what actually identifies a bank-statement/ledger pair.

export interface MatchableTransaction {
  id: string;
  valueDate: Date;
  /** Signed: positive = money in (debit-side), negative = money out (credit-side). */
  amount: Money;
}

export interface OpenLedgerLine {
  id: string;
  date: Date;
  debit: Money;
  credit: Money;
}

export interface MatchSuggestion {
  transactionId: string;
  lineId: string;
  dateDiffDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * For each transaction, finds the open ledger line whose amount matches exactly (debit
 * equals the transaction's amount when positive, credit equals its absolute value when
 * negative) and whose date is closest, within `maxDateDiffDays`. Each line is suggested to
 * at most one transaction (greedy, closest-date-first across all transactions) so the same
 * line is never proposed twice on one screen. Returns a map keyed by transaction id;
 * transactions with no eligible line are simply absent from the map, not given a weak
 * suggestion — CLAUDE.md §14 again: no match is more honest than a bad one.
 */
export function suggestMatches(
  transactions: readonly MatchableTransaction[],
  openLines: readonly OpenLedgerLine[],
  maxDateDiffDays = 15,
): Map<string, MatchSuggestion> {
  const candidates: MatchSuggestion[] = [];

  for (const txn of transactions) {
    for (const line of openLines) {
      const lineAmount = txn.amount.isPositive() ? line.debit : line.credit;
      const target = txn.amount.abs();
      if (!lineAmount.eq(target)) {
        continue;
      }
      const dateDiffDays = Math.abs(txn.valueDate.getTime() - line.date.getTime()) / DAY_MS;
      if (dateDiffDays > maxDateDiffDays) {
        continue;
      }
      candidates.push({ transactionId: txn.id, lineId: line.id, dateDiffDays });
    }
  }

  candidates.sort((a, b) => a.dateDiffDays - b.dateDiffDays);

  const result = new Map<string, MatchSuggestion>();
  const usedLines = new Set<string>();
  const usedTransactions = new Set<string>();
  for (const candidate of candidates) {
    if (usedLines.has(candidate.lineId) || usedTransactions.has(candidate.transactionId)) {
      continue;
    }
    result.set(candidate.transactionId, candidate);
    usedLines.add(candidate.lineId);
    usedTransactions.add(candidate.transactionId);
  }
  return result;
}
