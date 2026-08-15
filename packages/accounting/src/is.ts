import { sum, ZERO, type Money } from "./money.ts";

// CLAUDE.md §5.5 — the tableau de passage du résultat comptable au résultat fiscal:
// réintégrations, déductions extra-comptables, cotisation minimale, brackets that are
// "progressive/bracketed and have been changing year over year... never hardcode." Unlike
// TVA (CLAUDE.md §5.3 states real percentages), §5.5 gives zero numbers for any of this —
// no brackets, no cotisation minimale rate, no standard réintégrations list — so
// packages/db seeds all of it empty, same posture as phase 12's RAS rule table. What's
// real here: the résultat comptable input (packages/accounting's buildCpc, phase 10) and
// the *mechanism* — max(calculated IS, cotisation minimale) is a structural rule of the
// Moroccan system, not a numeric fact, so encoding that mechanism isn't inventing
// anything; only the rate/threshold numbers are missing.

export interface IsBracketConfig {
  minIncome: Money;
  /** null = no upper bound (the top bracket). */
  maxIncome: Money | null;
  rate: Money;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

function isEffectiveAt(range: { effectiveFrom: Date; effectiveTo: Date | null }, date: Date): boolean {
  return range.effectiveFrom <= date && (range.effectiveTo === null || date <= range.effectiveTo);
}

/** Resolves which bracket a given taxable income falls into on `date`. Whether Moroccan
 * IS brackets are applied as a flat rate on the whole result (the assumption here) or
 * marginally is itself unconfirmed (L-27/L-28) — this only resolves the matching bracket,
 * it doesn't assume the multiplication method beyond that simplification, documented so a
 * later correction is a one-function change, not a rewrite. */
export function resolveIsBracket(brackets: readonly IsBracketConfig[], taxableIncome: Money, date: Date): IsBracketConfig | null {
  return (
    brackets.find(
      (b) => isEffectiveAt(b, date) && taxableIncome.gte(b.minIncome) && (b.maxIncome === null || taxableIncome.lte(b.maxIncome)),
    ) ?? null
  );
}

export interface IsCotisationMinimaleConfig {
  rate: Money;
  minimumAmount: Money;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export function resolveCotisationMinimale(configs: readonly IsCotisationMinimaleConfig[], date: Date): IsCotisationMinimaleConfig | null {
  return configs.find((c) => isEffectiveAt(c, date)) ?? null;
}

export interface PassageLineInput {
  kind: "reintegration" | "deduction";
  amount: Money;
}

/** résultat fiscal = résultat comptable + Σ réintégrations − Σ déductions (CLAUDE.md
 * §5.5). Every input line is expected to already carry its own explanation at the
 * caller/persistence layer — this function only does the arithmetic. */
export function computeResultatFiscal(resultatComptable: Money, lines: readonly PassageLineInput[]): Money {
  const reintegrations = sum(lines.filter((l) => l.kind === "reintegration").map((l) => l.amount));
  const deductions = sum(lines.filter((l) => l.kind === "deduction").map((l) => l.amount));
  return resultatComptable.plus(reintegrations).minus(deductions);
}

export interface IsComputation {
  resultatFiscal: Money;
  bracket: IsBracketConfig | null;
  /** resultatFiscal × bracket.rate. Zero (not null) when resultatFiscal isn't positive —
   * a loss genuinely owes no bracket-tax, that's known, not unresolved. Null only when
   * resultatFiscal is positive and no bracket matched — genuinely undetermined, so isDue
   * can't be computed either (see isDue's comment; CLAUDE.md §5.5's "cotisation minimale
   * applies even at a loss" specifically requires the zero-not-null distinction here). */
  calculatedIs: Money | null;
  cotisationMinimale: { config: IsCotisationMinimaleConfig; amount: Money } | null;
  /** max(calculatedIs, cotisationMinimale.amount) — CLAUDE.md §5.5: cotisation minimale
   * applies "even at a loss". Null (not a guessed number) whenever either leg couldn't be
   * resolved, since the true amount due genuinely can't be determined without both. */
  isDue: Money | null;
}

export function computeIs(
  resultatComptable: Money,
  lines: readonly PassageLineInput[],
  brackets: readonly IsBracketConfig[],
  cotisationConfigs: readonly IsCotisationMinimaleConfig[],
  cotisationMinimaleBase: Money,
  date: Date,
): IsComputation {
  const resultatFiscal = computeResultatFiscal(resultatComptable, lines);
  const bracket = resultatFiscal.lte(0) ? null : resolveIsBracket(brackets, resultatFiscal, date);
  const calculatedIs = resultatFiscal.lte(0) ? ZERO : bracket === null ? null : resultatFiscal.times(bracket.rate);

  const cmConfig = resolveCotisationMinimale(cotisationConfigs, date);
  const cotisationMinimale =
    cmConfig === null
      ? null
      : {
          config: cmConfig,
          amount: cotisationMinimaleBase.times(cmConfig.rate).gte(cmConfig.minimumAmount)
            ? cotisationMinimaleBase.times(cmConfig.rate)
            : cmConfig.minimumAmount,
        };

  const isDue = calculatedIs === null || cotisationMinimale === null ? null : (calculatedIs.gte(cotisationMinimale.amount) ? calculatedIs : cotisationMinimale.amount);

  return { resultatFiscal, bracket, calculatedIs, cotisationMinimale, isDue };
}
