import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Decimal } from "./money.ts";
import { assertValidEntry, entryImbalance, InvalidLineError, UnbalancedEntryError } from "./balance.ts";
import { arbitraryBalancedLines } from "./testing/arbitraries.ts";
import type { JournalEntryInput } from "./types.ts";

function entryOf(lines: JournalEntryInput["lines"]): JournalEntryInput {
  return { date: new Date("2026-08-01"), journalCode: "OD", label: "test", lines };
}

describe("assertValidEntry", () => {
  it("rejects an entry with no lines", () => {
    expect(() => assertValidEntry(entryOf([]))).toThrow(InvalidLineError);
  });

  it("rejects a line with both debit and credit non-zero", () => {
    const entry = entryOf([{ accountCode: "6111", debit: new Decimal(10), credit: new Decimal(10) }]);
    expect(() => assertValidEntry(entry)).toThrow(InvalidLineError);
  });

  it("rejects a line with neither debit nor credit set", () => {
    const entry = entryOf([{ accountCode: "6111", debit: new Decimal(0), credit: new Decimal(0) }]);
    expect(() => assertValidEntry(entry)).toThrow(InvalidLineError);
  });

  it("rejects a negative amount", () => {
    const entry = entryOf([{ accountCode: "6111", debit: new Decimal(-10), credit: new Decimal(0) }]);
    expect(() => assertValidEntry(entry)).toThrow(InvalidLineError);
  });

  it("rejects an unbalanced entry", () => {
    const entry = entryOf([
      { accountCode: "6111", debit: new Decimal(100), credit: new Decimal(0) },
      { accountCode: "4411", debit: new Decimal(0), credit: new Decimal(99) },
    ]);
    expect(() => assertValidEntry(entry)).toThrow(UnbalancedEntryError);
  });

  it("accepts a balanced entry", () => {
    const entry = entryOf([
      { accountCode: "6111", debit: new Decimal(100), credit: new Decimal(0) },
      { accountCode: "4411", debit: new Decimal(0), credit: new Decimal(100) },
    ]);
    expect(() => assertValidEntry(entry)).not.toThrow();
  });

  // CLAUDE.md §12 — property tests generating arbitrary operation sets, asserting the
  // trial-balance invariant (build-order.md S3's definition of done).
  it("property: any generated balanced line set has zero imbalance and passes validation", () => {
    fc.assert(
      fc.property(arbitraryBalancedLines, (lines) => {
        expect(entryImbalance(lines).isZero()).toBe(true);
        expect(() => assertValidEntry(entryOf(lines))).not.toThrow();
      }),
    );
  });
});
