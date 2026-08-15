import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Decimal, ZERO } from "./money.ts";
import { entryImbalance } from "./balance.ts";
import { buildReversingEntry } from "./reversal.ts";
import { arbitraryBalancedLines } from "./testing/arbitraries.ts";
import type { JournalEntryInput, JournalLineInput } from "./types.ts";

function entryOf(lines: readonly JournalLineInput[]): JournalEntryInput {
  return { date: new Date("2026-08-01"), journalCode: "ACH", label: "facture ONEE", lines };
}

describe("buildReversingEntry", () => {
  it("swaps debit and credit on every line, keeps accounts and amounts", () => {
    const original = entryOf([
      { accountCode: "6111", debit: new Decimal(100), credit: ZERO, label: "achat" },
      { accountCode: "4411", debit: ZERO, credit: new Decimal(100), label: "fournisseur" },
    ]);
    const reversalDate = new Date("2026-08-15");
    const reversal = buildReversingEntry(original, reversalDate);

    expect(reversal.date).toBe(reversalDate);
    expect(reversal.journalCode).toBe(original.journalCode);
    expect(reversal.label).toBe("Extourne — facture ONEE");
    expect(reversal.lines).toEqual([
      { accountCode: "6111", debit: ZERO, credit: new Decimal(100), label: "achat" },
      { accountCode: "4411", debit: new Decimal(100), credit: ZERO, label: "fournisseur" },
    ]);
  });

  // build-order.md S3's DoD: "a reversing entry ... restores the prior balance" — proven
  // two ways: the reversal is itself always balanced, and applying original + reversal
  // together nets every touched account back to zero.
  it("property: the reversal of any balanced entry is itself balanced", () => {
    fc.assert(
      fc.property(arbitraryBalancedLines, (lines) => {
        const reversal = buildReversingEntry(entryOf(lines), new Date("2026-08-20"));
        expect(entryImbalance(reversal.lines).isZero()).toBe(true);
      }),
    );
  });

  it("property: posting an entry then its reversal nets every account back to zero", () => {
    fc.assert(
      fc.property(arbitraryBalancedLines, (lines) => {
        const reversal = buildReversingEntry(entryOf(lines), new Date("2026-08-20"));
        const netByAccount = new Map<string, InstanceType<typeof Decimal>>();
        for (const line of [...lines, ...reversal.lines]) {
          const delta = line.debit.minus(line.credit);
          netByAccount.set(line.accountCode, (netByAccount.get(line.accountCode) ?? ZERO).plus(delta));
        }
        for (const net of netByAccount.values()) {
          expect(net.isZero()).toBe(true);
        }
      }),
    );
  });
});
