import { sum, ZERO, type Money } from "./money.ts";

// CLAUDE.md §5.2 — states are *derived*, never stored as editable numbers, and every line
// must be traceable back to the journal lines that produced it. This module only
// aggregates account-level balances the caller already fetched (from posted JournalLines,
// filtered to a date range) — it never touches the database or the clock (CLAUDE.md §3).
//
// **Not the official CGNC structure.** docs/legal-inputs.md L-63 (the official
// line-by-line Bilan/CPC layout with account-to-line mapping) is still TODO(legal) — this
// derives a *simplified*, class-level rollup (CLAUDE.md §5.1's class digits: 1
// financement permanent, 2 actif immobilisé, 3 actif circulant, 4 passif circulant, 5
// trésorerie, 6 charges, 7 produits — all basic, undisputed CGNC structure, not an
// invented mapping) rather than fabricating official *rubrique*/*poste* codes nobody has
// verified. Every screen showing this must say so — CLAUDE.md §14.

/** One row per *account* (already aggregated — CLAUDE.md-style groupBy, same as
 * TrialBalance's rows), not per journal line. Passing un-aggregated lines with a repeated
 * accountCode will double-list that account. */
export interface AccountBalanceLine {
  accountCode: string;
  accountLabel: string;
  classDigit: number;
  debit: Money;
  credit: Money;
}

export interface StatementAccountLine {
  accountCode: string;
  accountLabel: string;
  /** Net balance in the natural direction for this side (always non-negative by
   * convention here — actif/charges show their net debit, passif/produits their net
   * credit; a naturally-reversed account still shows its true net value, which may itself
   * be negative, e.g. an overdrawn bank account under trésorerie). */
  amount: Money;
}

export interface BilanResult {
  actif: StatementAccountLine[];
  passif: StatementAccountLine[];
  totalActif: Money;
  /** Includes the computed résultat net line so totalPassif == totalActif by construction
   * for any balanced ledger — the identity itself is a useful sanity check, not just a
   * derived number. */
  totalPassif: Money;
  resultatNet: Money;
}

function netDebit(line: AccountBalanceLine): Money {
  return line.debit.minus(line.credit);
}
function netCredit(line: AccountBalanceLine): Money {
  return line.credit.minus(line.debit);
}

function toStatementLines(lines: readonly AccountBalanceLine[], amountOf: (l: AccountBalanceLine) => Money): StatementAccountLine[] {
  return lines
    .map((l) => ({ accountCode: l.accountCode, accountLabel: l.accountLabel, amount: amountOf(l) }))
    .filter((l) => !l.amount.isZero())
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** Bilan (actif/passif), CLAUDE.md §5.2 item 1. `asOfLines` must already be filtered to
 * entries posted on or before the balance-sheet date — this module doesn't know about
 * dates. */
export function buildBilan(asOfLines: readonly AccountBalanceLine[]): BilanResult {
  const actifLines = asOfLines.filter((l) => l.classDigit === 2 || l.classDigit === 3 || l.classDigit === 5);
  const passifLines = asOfLines.filter((l) => l.classDigit === 1 || l.classDigit === 4);
  const chargeLines = asOfLines.filter((l) => l.classDigit === 6);
  const produitLines = asOfLines.filter((l) => l.classDigit === 7);

  const totalCharges = sum(chargeLines.map(netDebit));
  const totalProduits = sum(produitLines.map(netCredit));
  const resultatNet = totalProduits.minus(totalCharges);

  const actif = toStatementLines(actifLines, netDebit);
  const passif = toStatementLines(passifLines, netCredit);

  const totalActif = sum(actif.map((l) => l.amount));
  const totalPassifBeforeResult = sum(passif.map((l) => l.amount));
  const totalPassif = totalPassifBeforeResult.plus(resultatNet);

  if (!resultatNet.isZero()) {
    passif.push({ accountCode: "RESULT", accountLabel: "Résultat net de l'exercice (calculé)", amount: resultatNet });
  }

  return { actif, passif, totalActif, totalPassif, resultatNet };
}

export interface CpcResult {
  produits: StatementAccountLine[];
  charges: StatementAccountLine[];
  totalProduits: Money;
  totalCharges: Money;
  resultatNet: Money;
}

/** CPC — Compte de Produits et Charges, CLAUDE.md §5.2 item 2. `periodLines` must already
 * be filtered to entries posted within the period (not cumulative since inception, unlike
 * the Bilan — a CPC is a flow statement). */
export function buildCpc(periodLines: readonly AccountBalanceLine[]): CpcResult {
  const chargeLines = periodLines.filter((l) => l.classDigit === 6);
  const produitLines = periodLines.filter((l) => l.classDigit === 7);

  const charges = toStatementLines(chargeLines, netDebit);
  const produits = toStatementLines(produitLines, netCredit);

  const totalCharges = sum(charges.map((l) => l.amount));
  const totalProduits = sum(produits.map((l) => l.amount));

  return { produits, charges, totalProduits, totalCharges, resultatNet: totalProduits.minus(totalCharges) };
}

export { ZERO };
