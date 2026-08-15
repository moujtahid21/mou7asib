import { Decimal, type Money } from "@mou7asib/accounting";

export interface DrilldownLine {
  accountCode: string | null;
  debit: Money;
  credit: Money;
}

/** Net (debit - credit) across every line in an entry matching `accountCode` — not just
 * the first match. An entry can legitimately post to the same account on more than one
 * line (e.g. two TVA rate lines both hitting 34552 récupérable); a drilldown that only
 * looked at the first match would under-report and fail to reconcile to the account's
 * aggregate total. Caught live on /tva's TVA declaration panel before shipping. */
export function netAmountForAccount(lines: readonly DrilldownLine[], accountCode: string): Money {
  return lines
    .filter((l) => l.accountCode === accountCode)
    .reduce((acc, l) => acc.plus(l.debit).minus(l.credit), new Decimal(0));
}

/** Formats a net amount the way the drilldown UI expects: a plain positive string, or a
 * "-"-prefixed one for a negative net (never relies on decimal.js's own sign rendering,
 * which differs from this project's convention elsewhere). */
export function formatSignedAmount(amount: Money): string {
  return amount.gte(0) ? amount.toFixed(2) : `-${amount.abs().toFixed(2)}`;
}
