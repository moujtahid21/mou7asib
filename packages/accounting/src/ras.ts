import type { Money } from "./money.ts";

// CLAUDE.md §5.4 — RAS as a rule table `(paymentNature, payeeType, residentStatus,
// effectiveFrom, effectiveTo) → rate, base, accounts`, never a switch statement, and: "if
// the payment nature cannot be determined with confidence, flag it — never default to 'no
// retenue'." Unlike TVA (packages/accounting/src/tva.ts), CLAUDE.md §5.4 gives no rate
// numbers to seed even as a labelled placeholder — only category names (honoraires,
// revenus locatifs, produits de placements, dividendes, non-residents), and
// docs/legal-inputs.md L-38 (the complete payment-nature list itself) is TODO(legal). So
// the rule table this engine resolves against ships genuinely empty (packages/db seeds no
// rows), and every real evaluation flags — that IS the required behaviour, not a gap
// hiding behind a placeholder value the way TVA's rates do.

export interface RasRuleConfig {
  paymentNature: string;
  payeeType: string;
  residentStatus: string;
  rate: Money;
  /** Which date determines whether this rule was in force — CLAUDE.md §5.4: "do not
   * assume it is always at invoice date or always at payment date; make it part of the
   * rule." */
  liabilityTrigger: "invoice_date" | "payment_date";
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface RasCriteria {
  paymentNature: string;
  payeeType: string;
  residentStatus: string;
}

function isEffectiveAt(rule: RasRuleConfig, date: Date): boolean {
  return rule.effectiveFrom <= date && (rule.effectiveTo === null || date <= rule.effectiveTo);
}

/** Finds the rule matching `criteria` whose liability date (invoice or payment, per that
 * rule's own trigger) falls within its effective range. Returns null — never a guess —
 * when nothing matches. */
export function resolveRasRule(
  rules: readonly RasRuleConfig[],
  criteria: RasCriteria,
  invoiceDate: Date,
  paymentDate: Date,
): RasRuleConfig | null {
  return (
    rules.find(
      (r) =>
        r.paymentNature === criteria.paymentNature &&
        r.payeeType === criteria.payeeType &&
        r.residentStatus === criteria.residentStatus &&
        isEffectiveAt(r, r.liabilityTrigger === "invoice_date" ? invoiceDate : paymentDate),
    ) ?? null
  );
}

export interface RasEvaluation {
  /** False means: flag for human review, per CLAUDE.md §5.4 — never compute a fallback
   * amount when nothing matched. */
  matched: boolean;
  rule: RasRuleConfig | null;
  rasAmount: Money | null;
  netPayable: Money | null;
}

export function evaluateRasWithholding(
  rules: readonly RasRuleConfig[],
  criteria: RasCriteria,
  baseAmount: Money,
  invoiceDate: Date,
  paymentDate: Date,
): RasEvaluation {
  const rule = resolveRasRule(rules, criteria, invoiceDate, paymentDate);
  if (rule === null) {
    return { matched: false, rule: null, rasAmount: null, netPayable: null };
  }
  const rasAmount = baseAmount.times(rule.rate);
  return { matched: true, rule, rasAmount, netPayable: baseAmount.minus(rasAmount) };
}
