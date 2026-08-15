import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { buildBilan, buildCpc, type AccountBalanceLine } from "./statements.ts";
import { arbitraryPositiveMoney } from "./testing/arbitraries.ts";

// Restricted to classes 1-7 (financement..produits) deliberately, not the generic
// arbitraryAccountCode (which spans 0-9): classes 0/8/9 (hors bilan/résultats/analytique)
// are excluded from both actif and passif by buildBilan, so a balanced fixture that
// happens to leave a nonzero net balance sitting in one of those classes would break the
// actif==passif identity for a reason that has nothing to do with buildBilan's logic —
// see the identity's derivation in this file's git history/PR description.
const arbitraryAccountCodeClass1to7 = fc
  .integer({ min: 1, max: 7 })
  .chain((classDigit) => fc.integer({ min: 0, max: 999 }).map((rest) => `${classDigit}${String(rest).padStart(3, "0")}`));

const arbitraryBalancedLinesClass1to7 = fc
  .array(fc.tuple(arbitraryAccountCodeClass1to7, arbitraryPositiveMoney), { minLength: 1, maxLength: 8 })
  .chain((debitSide) =>
    fc.tuple(fc.constant(debitSide), arbitraryAccountCodeClass1to7).map(([lines, balancingAccount]) => {
      const total = lines.reduce((s, [, amount]) => s.plus(amount), new Decimal(0));
      const debitLines = lines.map(([accountCode, amount]) => ({ accountCode, debit: amount, credit: new Decimal(0) }));
      const balancingLine = { accountCode: balancingAccount, debit: new Decimal(0), credit: total };
      return [...debitLines, balancingLine];
    }),
  );

/** Aggregates arbitraryBalancedLines' JournalLineInput[] (which may repeat an account
 * code across several lines) into one AccountBalanceLine per account — the shape
 * buildBilan/buildCpc actually expect (see statements.ts's doc comment). */
function aggregateByAccount(lines: readonly { accountCode: string; debit: Decimal; credit: Decimal }[]): AccountBalanceLine[] {
  const byAccount = new Map<string, { debit: Decimal; credit: Decimal }>();
  for (const line of lines) {
    const existing = byAccount.get(line.accountCode) ?? { debit: new Decimal(0), credit: new Decimal(0) };
    byAccount.set(line.accountCode, { debit: existing.debit.plus(line.debit), credit: existing.credit.plus(line.credit) });
  }
  return Array.from(byAccount.entries()).map(([accountCode, { debit, credit }]) => ({
    accountCode,
    accountLabel: `Compte ${accountCode}`,
    classDigit: Number(accountCode[0]),
    debit,
    credit,
  }));
}

describe("buildBilan", () => {
  it("keeps totalActif == totalPassif (the résultat net line closes the identity) for any balanced ledger", () => {
    fc.assert(
      fc.property(arbitraryBalancedLinesClass1to7, (lines) => {
        const accountLines = aggregateByAccount(lines);
        const bilan = buildBilan(accountLines);
        expect(bilan.totalActif.toString()).toBe(bilan.totalPassif.toString());
      }),
    );
  });

  it("classifies a simple fixture correctly", () => {
    const lines: AccountBalanceLine[] = [
      { accountCode: "5141", accountLabel: "Banques", classDigit: 5, debit: new Decimal(1000), credit: new Decimal(0) },
      { accountCode: "1111", accountLabel: "Capital social", classDigit: 1, debit: new Decimal(0), credit: new Decimal(1000) },
    ];
    const bilan = buildBilan(lines);
    expect(bilan.actif).toHaveLength(1);
    expect(bilan.actif[0]?.accountCode).toBe("5141");
    expect(bilan.passif.some((l) => l.accountCode === "1111")).toBe(true);
    expect(bilan.resultatNet.toString()).toBe("0");
  });

  it("computes résultat net from charges/produits and reflects it in passif", () => {
    const lines: AccountBalanceLine[] = [
      { accountCode: "5141", accountLabel: "Banques", classDigit: 5, debit: new Decimal(500), credit: new Decimal(0) },
      { accountCode: "7111", accountLabel: "Ventes", classDigit: 7, debit: new Decimal(0), credit: new Decimal(500) },
    ];
    const bilan = buildBilan(lines);
    expect(bilan.resultatNet.toString()).toBe("500");
    expect(bilan.totalActif.toString()).toBe("500");
    expect(bilan.totalPassif.toString()).toBe("500");
  });

  it("excludes zero-balance accounts", () => {
    const lines: AccountBalanceLine[] = [
      { accountCode: "5141", accountLabel: "Banques", classDigit: 5, debit: new Decimal(100), credit: new Decimal(100) },
    ];
    const bilan = buildBilan(lines);
    expect(bilan.actif).toEqual([]);
  });
});

describe("buildCpc", () => {
  it("computes résultat net as produits minus charges", () => {
    const lines: AccountBalanceLine[] = [
      { accountCode: "6111", accountLabel: "Achats", classDigit: 6, debit: new Decimal(300), credit: new Decimal(0) },
      { accountCode: "7111", accountLabel: "Ventes", classDigit: 7, debit: new Decimal(0), credit: new Decimal(800) },
    ];
    const cpc = buildCpc(lines);
    expect(cpc.totalCharges.toString()).toBe("300");
    expect(cpc.totalProduits.toString()).toBe("800");
    expect(cpc.resultatNet.toString()).toBe("500");
  });

  it("ignores balance-sheet classes entirely", () => {
    const lines: AccountBalanceLine[] = [
      { accountCode: "5141", accountLabel: "Banques", classDigit: 5, debit: new Decimal(1000), credit: new Decimal(0) },
    ];
    const cpc = buildCpc(lines);
    expect(cpc.produits).toEqual([]);
    expect(cpc.charges).toEqual([]);
    expect(cpc.resultatNet.toString()).toBe("0");
  });
});
