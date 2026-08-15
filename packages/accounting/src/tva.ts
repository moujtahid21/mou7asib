import { Decimal, sum, ZERO, type Money } from "./money.ts";

// CLAUDE.md §5.3 — TVA rates and the cash-payment deductibility threshold are
// effective-dated configuration, never a hardcoded number. Every value this module
// resolves comes from rows the caller passes in (seeded in packages/db, currently marked
// `isPlaceholder: true` — see docs/legal-inputs.md L-01/L-13, still TODO(legal)). This
// module never reads a clock or a database; every date and every rate table is injected
// (CLAUDE.md §3).

export interface TvaRateConfig {
  rateCode: string;
  /** As a fraction, e.g. 0.2 for 20% — not a percentage. */
  rate: Money;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Resolves the rate config in force for `rateCode` on `transactionDate` — the exact
 * CLAUDE.md §5.3 rule: "rate selection is always resolved by (rateCode, transactionDate)".
 * Never assumes today's rate applied to a past period. */
export function resolveTvaRate(
  rates: readonly TvaRateConfig[],
  rateCode: string,
  transactionDate: Date,
): TvaRateConfig | null {
  return (
    rates.find(
      (r) =>
        r.rateCode === rateCode &&
        r.effectiveFrom <= transactionDate &&
        (r.effectiveTo === null || transactionDate <= r.effectiveTo),
    ) ?? null
  );
}

export interface TvaLineInput {
  baseHt: Money;
  rateCode: string;
}

export interface ResolvedTvaLine {
  baseHt: Money;
  rateCode: string;
  rate: Money;
  /** Rounded half-up at the line level (CLAUDE.md §5.7 — round per rate line, then
   * totals, never a single rounding of the aggregate). */
  tvaAmount: Money;
}

export interface TvaComputation {
  resolved: ResolvedTvaLine[];
  /** Lines whose rateCode has no config in force at the transaction date — surfaced, never
   * silently dropped or computed with a guessed rate (CLAUDE.md §14). */
  unresolved: TvaLineInput[];
}

export function computeTvaLines(
  lines: readonly TvaLineInput[],
  rates: readonly TvaRateConfig[],
  transactionDate: Date,
): TvaComputation {
  const resolved: ResolvedTvaLine[] = [];
  const unresolved: TvaLineInput[] = [];
  for (const line of lines) {
    const config = resolveTvaRate(rates, line.rateCode, transactionDate);
    if (config === null) {
      unresolved.push(line);
      continue;
    }
    resolved.push({
      baseHt: line.baseHt,
      rateCode: line.rateCode,
      rate: config.rate,
      tvaAmount: line.baseHt.times(config.rate),
    });
  }
  return { resolved, unresolved };
}

export interface TvaTotals {
  totalHt: Money;
  totalTva: Money;
  totalTtc: Money;
}

export function sumTvaTotals(resolved: readonly ResolvedTvaLine[]): TvaTotals {
  const totalHt = sum(resolved.map((l) => l.baseHt));
  const totalTva = sum(resolved.map((l) => l.tvaAmount));
  return { totalHt, totalTva, totalTtc: totalHt.plus(totalTva) };
}

/** Groups resolved lines by rateCode, summing base and TVA per group — the shape needed
 * to post one TVA control-account line per rate rather than one per invoice line
 * (build-order.md S7: "a mixed-rate invoice books correct TVA per rate line"). */
export function groupByRate(resolved: readonly ResolvedTvaLine[]): Map<string, { rate: Money; baseHt: Money; tvaAmount: Money }> {
  const groups = new Map<string, { rate: Money; baseHt: Money; tvaAmount: Money }>();
  for (const line of resolved) {
    const existing = groups.get(line.rateCode);
    if (existing === undefined) {
      groups.set(line.rateCode, { rate: line.rate, baseHt: line.baseHt, tvaAmount: line.tvaAmount });
    } else {
      groups.set(line.rateCode, {
        rate: line.rate,
        baseHt: existing.baseHt.plus(line.baseHt),
        tvaAmount: existing.tvaAmount.plus(line.tvaAmount),
      });
    }
  }
  return groups;
}

export interface CashThresholdConfig {
  thresholdAmount: Money;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Resolves the cash-payment deductibility threshold in force on `date`, or null if none
 * configured for that date. Comparing a TTC amount against it is the caller's job (this
 * stays pure/date-injected); a hit means "warn", never an automatic block — CLAUDE.md §5.3
 * asks for a warning, not a silent rejection, since the exact enforcement rule (per
 * transaction vs per supplier per period) is still TODO(legal) L-13. */
export function resolveCashThreshold(configs: readonly CashThresholdConfig[], date: Date): Money | null {
  const config = configs.find((c) => c.effectiveFrom <= date && (c.effectiveTo === null || date <= c.effectiveTo));
  return config?.thresholdAmount ?? null;
}

export { Decimal, ZERO };
