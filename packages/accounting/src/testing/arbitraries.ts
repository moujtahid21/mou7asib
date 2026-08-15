import fc from "fast-check";
import { Decimal } from "../money.ts";
import type { JournalLineInput } from "../types.ts";

/** A positive amount with exactly 4 decimal places, built from an integer number of
 * minor units (1/10000 MAD) so it's always exact — never a float round-trip. */
export const arbitraryPositiveMoney = fc
  .integer({ min: 1, max: 1_000_000_00 })
  .map((minorUnits) => new Decimal(minorUnits).dividedBy(10_000));

export const arbitraryAccountCode = fc
  .integer({ min: 0, max: 9 })
  .chain((classDigit) => fc.integer({ min: 0, max: 999 }).map((rest) => `${classDigit}${String(rest).padStart(3, "0")}`));

/** A set of lines guaranteed to balance: n-1 random debit lines plus one final line
 * whose credit exactly offsets their total (or the reverse, at random) — every line
 * still respects the debit-xor-credit shape. */
export const arbitraryBalancedLines: fc.Arbitrary<JournalLineInput[]> = fc
  .array(fc.tuple(arbitraryAccountCode, arbitraryPositiveMoney), { minLength: 1, maxLength: 8 })
  .chain((debitSide) =>
    fc.tuple(fc.constant(debitSide), arbitraryAccountCode).map(([lines, balancingAccount]) => {
      const total = lines.reduce((sum, [, amount]) => sum.plus(amount), new Decimal(0));
      const debitLines: JournalLineInput[] = lines.map(([accountCode, amount]) => ({
        accountCode,
        debit: amount,
        credit: new Decimal(0),
      }));
      const balancingLine: JournalLineInput = {
        accountCode: balancingAccount,
        debit: new Decimal(0),
        credit: total,
      };
      return [...debitLines, balancingLine];
    }),
  );
