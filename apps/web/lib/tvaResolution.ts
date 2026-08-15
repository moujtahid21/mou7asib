import {
  computeTvaLines,
  groupByRate,
  sumTvaTotals,
  type TvaRateConfig,
  type Money,
} from "@mou7asib/accounting";

// Bridges a document's extracted tva_lines (a percentage per line, e.g. "20.00" meaning
// 20%) to packages/accounting's rate-code-based engine — this mapping is specific to the
// extraction contract (packages/contracts/invoice-fields.json), not core double-entry
// logic, so it lives here rather than in packages/accounting.

export interface RawTvaLine {
  groupIndex: number;
  ratePercent: Money | null;
  baseHt: Money | null;
}

export interface TvaBreakdownRow {
  groupIndex: number;
  ratePercentLabel: string;
  rateCode: string | null;
  baseHt: string;
  tvaAmount: string | null;
}

export interface TvaPostingLine {
  accountCode: string;
  amount: string;
  label: string;
}

export interface TvaBreakdown {
  rows: TvaBreakdownRow[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /** Rows whose extracted percentage matches no configured rate in force at the invoice
   * date — could be a genuinely unconfigured rate, a placeholder-data gap, or a bad
   * extraction. Never guessed past; the caller must not auto-post while this is > 0. */
  unresolvedCount: number;
  /** One line per distinct resolved rate, ready to prefill the TVA récupérable postings —
   * empty when unresolvedCount > 0. */
  postingLines: TvaPostingLine[];
}

/** Recoverable-TVA control account for purchase-side (Réception) documents — see
 * packages/db/src/referenceAccounts.ts. Sales-side (facturation, phase 9) will need 4455
 * instead; not built here. */
const TVA_RECOVERABLE_ACCOUNT_CODE = "34552";

export function buildTvaBreakdown(
  rawLines: readonly RawTvaLine[],
  configuredRates: readonly TvaRateConfig[],
  invoiceDate: Date,
): TvaBreakdown | null {
  if (rawLines.length === 0) {
    return null;
  }

  const withRateCode = rawLines.map((line) => {
    if (line.ratePercent === null || line.baseHt === null) {
      return { groupIndex: line.groupIndex, rateCode: null, baseHt: line.baseHt, ratePercent: line.ratePercent };
    }
    const fraction = line.ratePercent.dividedBy(100);
    const match = configuredRates.find(
      (r) => r.rate.eq(fraction) && r.effectiveFrom <= invoiceDate && (r.effectiveTo === null || invoiceDate <= r.effectiveTo),
    );
    return { groupIndex: line.groupIndex, rateCode: match?.rateCode ?? null, baseHt: line.baseHt, ratePercent: line.ratePercent };
  });

  const resolvableLines = withRateCode.filter(
    (l): l is { groupIndex: number; rateCode: string; baseHt: Money; ratePercent: Money } => l.rateCode !== null && l.baseHt !== null,
  );
  const unresolvedCount = withRateCode.length - resolvableLines.length;

  const computation = computeTvaLines(
    resolvableLines.map((l) => ({ baseHt: l.baseHt, rateCode: l.rateCode })),
    configuredRates,
    invoiceDate,
  );

  // resolvableLines and computation.resolved are both in the same order (computeTvaLines
  // preserves input order and every resolvableLines entry already matched a configured
  // rate above, so none of them land in computation.unresolved) — zip by index rather than
  // searching, which would be ambiguous for two lines sharing the same rate and base.
  const tvaAmountByGroupIndex = new Map<number, Money>(
    resolvableLines.map((line, i) => [line.groupIndex, computation.resolved[i]!.tvaAmount]),
  );

  const rows: TvaBreakdownRow[] = withRateCode.map((l) => ({
    groupIndex: l.groupIndex,
    ratePercentLabel: l.ratePercent === null ? "—" : `${l.ratePercent.toString()} %`,
    rateCode: l.rateCode,
    baseHt: l.baseHt === null ? "—" : l.baseHt.toFixed(2),
    tvaAmount: tvaAmountByGroupIndex.get(l.groupIndex)?.toFixed(2) ?? null,
  }));

  const totals = sumTvaTotals(computation.resolved);
  const totalUnresolvedCount = unresolvedCount + computation.unresolved.length;

  const postingLines: TvaPostingLine[] =
    totalUnresolvedCount > 0
      ? []
      : Array.from(groupByRate(computation.resolved).entries()).map(([rateCode, group]) => ({
          accountCode: TVA_RECOVERABLE_ACCOUNT_CODE,
          amount: group.tvaAmount.toFixed(2),
          label: `TVA ${rateCode}`,
        }));

  return {
    rows,
    totalHt: totals.totalHt.toFixed(2),
    totalTva: totals.totalTva.toFixed(2),
    totalTtc: totals.totalTtc.toFixed(2),
    unresolvedCount: totalUnresolvedCount,
    postingLines,
  };
}
