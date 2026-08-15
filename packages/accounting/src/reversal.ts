import type { JournalEntryInput, JournalLineInput } from "./types.ts";

function swapDebitCredit(line: JournalLineInput): JournalLineInput {
  return { ...line, debit: line.credit, credit: line.debit };
}

/**
 * Builds the écriture d'extourne (CLAUDE.md §2 rule 3 — the only way to correct a posted
 * entry) — same accounts, same amounts, every line's debit/credit swapped. Purely a data
 * transform: this package has no Prisma and does no persistence, so the caller is
 * responsible for actually linking the result to the original via
 * JournalEntry.reversesEntryId when writing it.
 */
export function buildReversingEntry(original: JournalEntryInput, reversalDate: Date): JournalEntryInput {
  return {
    date: reversalDate,
    journalCode: original.journalCode,
    label: `Extourne — ${original.label}`,
    lines: original.lines.map(swapDebitCredit),
  };
}
