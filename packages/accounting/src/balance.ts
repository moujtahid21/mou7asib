import { sum, type Money } from "./money.ts";
import type { JournalEntryInput, JournalLineInput } from "./types.ts";

export class UnbalancedEntryError extends Error {
  readonly imbalance: Money;
  constructor(imbalance: Money) {
    super(`entry does not balance: debit - credit = ${imbalance.toString()}`);
    this.name = "UnbalancedEntryError";
    this.imbalance = imbalance;
  }
}

export class InvalidLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLineError";
  }
}

function validateLineShape(line: JournalLineInput, index: number): void {
  if (line.debit.isNegative() || line.credit.isNegative()) {
    throw new InvalidLineError(`line ${index}: debit and credit must not be negative`);
  }
  const debitNonZero = !line.debit.isZero();
  const creditNonZero = !line.credit.isZero();
  if (debitNonZero === creditNonZero) {
    throw new InvalidLineError(
      `line ${index}: exactly one of debit/credit must be non-zero (debit=${line.debit.toString()}, credit=${line.credit.toString()})`,
    );
  }
}

export function entryImbalance(lines: readonly JournalLineInput[]): Money {
  return sum(lines.map((line) => line.debit)).minus(sum(lines.map((line) => line.credit)));
}

/**
 * Throws rather than returning a boolean — CLAUDE.md §13 "fail loudly": a caller that
 * ignores a boolean return would silently post an unbalanced or malformed entry. Every
 * write path (server actions in apps/web) must call this before persisting a draft or
 * posting it — CLAUDE.md §2 rule 2, checked in application code as the primary control,
 * with the database trigger as the backstop (same "both, not either" pattern as RLS).
 */
export function assertValidEntry(entry: JournalEntryInput): void {
  if (entry.lines.length === 0) {
    throw new InvalidLineError("entry must have at least one line");
  }
  entry.lines.forEach(validateLineShape);
  const imbalance = entryImbalance(entry.lines);
  if (!imbalance.isZero()) {
    throw new UnbalancedEntryError(imbalance);
  }
}
