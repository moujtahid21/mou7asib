import type { Money } from "./money.ts";

// CLAUDE.md §5.6's mandatory-mentions list, implemented as the interim ruleset — that list
// is this project's own instructions, not an invented fact, but docs/legal-inputs.md L-48
// (the authoritative mention list) and L-49 (which mentions are only conditionally
// required) are still TODO(legal). Every finding below is labelled with that in mind:
// unconditional mentions block finalisation; RC/patente/CNSS are surfaced as warnings, not
// blockers, because "where applicable" (CLAUDE.md's own wording) is exactly what L-49
// hasn't resolved — blocking on them with false confidence would be worse than not
// checking them at all.

export interface InvoiceMentionLine {
  description: string;
  quantity: Money;
  unitPriceHt: Money;
  rateCode: string;
}

export interface InvoiceMentionInput {
  issuerName: string | null;
  issuerIce: string | null;
  issuerIf: string | null;
  issuerRc: string | null;
  issuerPatente: string | null;
  issuerCnss: string | null;
  customerName: string | null;
  customerIce: string | null;
  invoiceDate: Date | null;
  paymentTerms: string | null;
  lines: readonly InvoiceMentionLine[];
  /** Rate codes from `lines` that failed to resolve against the configured TVA rate table
   * (phase 8) — passed in rather than resolved here, since rate resolution needs the rate
   * table and a date, which this pure module doesn't fetch. */
  unresolvedRateCodes: readonly string[];
  /** True for an avoir: its lines carry the *negated* quantity of the invoice they
   * correct (see actions/createAvoir.ts), so "quantity must be positive" would wrongly
   * block every avoir. Zero is still invalid either way. */
  allowNegativeQuantity?: boolean;
}

export interface MentionIssue {
  field: string;
  message: string;
  /** A blocking issue prevents finalisation; a non-blocking one is shown but doesn't. */
  blocking: boolean;
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

export function validateMentions(input: InvoiceMentionInput): MentionIssue[] {
  const issues: MentionIssue[] = [];
  const requireBlocking = (value: string | null, field: string, message: string) => {
    if (isBlank(value)) issues.push({ field, message, blocking: true });
  };
  const warnIfBlank = (value: string | null, field: string, message: string) => {
    if (isBlank(value)) issues.push({ field, message, blocking: false });
  };

  requireBlocking(input.issuerName, "issuerName", "Identité de l'émetteur manquante.");
  requireBlocking(input.issuerIce, "issuerIce", "ICE de l'émetteur manquant.");
  requireBlocking(input.issuerIf, "issuerIf", "IF de l'émetteur manquant.");
  warnIfBlank(input.issuerRc, "issuerRc", "RC de l'émetteur non renseigné (obligatoire si applicable — L-49).");
  warnIfBlank(input.issuerPatente, "issuerPatente", "Patente/TP de l'émetteur non renseignée (obligatoire si applicable — L-49).");
  warnIfBlank(input.issuerCnss, "issuerCnss", "CNSS de l'émetteur non renseignée (obligatoire si applicable — L-49).");

  requireBlocking(input.customerName, "customerName", "Identité du client manquante.");
  requireBlocking(input.customerIce, "customerIce", "ICE du client manquant.");

  if (input.invoiceDate === null) {
    issues.push({ field: "invoiceDate", message: "Date de facture manquante.", blocking: true });
  }
  requireBlocking(input.paymentTerms, "paymentTerms", "Conditions de paiement manquantes.");

  if (input.lines.length === 0) {
    issues.push({ field: "lines", message: "Au moins une ligne de facturation est requise.", blocking: true });
  }
  input.lines.forEach((line, i) => {
    if (line.description.trim().length === 0) {
      issues.push({ field: `lines[${i}].description`, message: `Ligne ${i + 1} : description manquante.`, blocking: true });
    }
    // decimal.js's isPositive() is true for zero (sign is non-negative), so check
    // explicitly rather than relying on it to catch "quantity must be > 0". An avoir's
    // lines are legitimately negative (see allowNegativeQuantity's doc comment) — zero is
    // invalid either way.
    const quantityInvalid = input.allowNegativeQuantity === true ? line.quantity.isZero() : line.quantity.lte(0);
    if (quantityInvalid) {
      issues.push({ field: `lines[${i}].quantity`, message: `Ligne ${i + 1} : quantité invalide.`, blocking: true });
    }
    if (line.unitPriceHt.isNegative()) {
      issues.push({ field: `lines[${i}].unitPriceHt`, message: `Ligne ${i + 1} : prix unitaire négatif.`, blocking: true });
    }
  });

  for (const rateCode of input.unresolvedRateCodes) {
    issues.push({
      field: "lines.rateCode",
      message: `Taux TVA "${rateCode}" non résolu à la date de facture — impossible de calculer le montant de TVA.`,
      blocking: true,
    });
  }

  return issues;
}

export function hasBlockingIssues(issues: readonly MentionIssue[]): boolean {
  return issues.some((issue) => issue.blocking);
}
