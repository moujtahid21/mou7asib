import type { Money } from "./money.ts";

/**
 * One leg of a journal entry. Exactly one of debit/credit is non-zero — this mirrors the
 * database's own CHECK constraint (packages/db's phase2_ledger migration) so a bad line
 * is rejected here, before it ever reaches a query, not just at the DB as a last resort.
 */
export interface JournalLineInput {
  /** CGNC account code — a string, never parsed as a number (CLAUDE.md §5.1: leading
   * structure and zeros matter, "3421" and "34210000" are different accounts). */
  accountCode: string;
  debit: Money;
  credit: Money;
  label?: string | undefined;
}

export interface JournalEntryInput {
  /** Accounting date (CLAUDE.md §5.7) — always injected by the caller; this package
   * never reads the clock (CLAUDE.md §3, packages/accounting must be pure). */
  date: Date;
  /** CGNC-style journal category (ACH/VTE/BQ/CAI/OD/AN, ...) — a bookkeeping convention,
   * not a legally-sourced value. */
  journalCode: string;
  label: string;
  lines: readonly JournalLineInput[];
}
