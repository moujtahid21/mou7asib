import Decimal from "decimal.js";

// CLAUDE.md §5.7 — round half up at legally significant points, set explicitly rather
// than relying on decimal.js's default (which happens to already be ROUND_HALF_UP, but
// "happens to be" is not the same as "specified"). This is the single place rounding
// policy is set for the whole engine, per CLAUDE.md §6.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
/** Alias so call sites read "an amount of money", not "some decimal.js internal type". */
export type Money = InstanceType<typeof Decimal>;

export const ZERO: Money = new Decimal(0);

export function sum(values: readonly Money[]): Money {
  return values.reduce((total, value) => total.plus(value), ZERO);
}
