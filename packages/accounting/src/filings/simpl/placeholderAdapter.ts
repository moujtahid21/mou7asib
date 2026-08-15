import type { TvaDeclarationFigures } from "./types.ts";

// The only adapter version that exists — see types.ts's comment. `ADAPTER_VERSION` is
// stored on every export record (packages/db's TvaDeclarationExport) so a later, real
// adapter can be told apart from this placeholder in the audit trail.
export const ADAPTER_VERSION = "placeholder-v0";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Renders a human-readable declaration summary — deliberately not a DGI-format file.
 * Every real fact it states (tenant name, period, computed totals) is real and traceable;
 * every claim about official status is explicitly negative. Never call this the "SIMPL
 * export" in user-facing copy without the same disclaimer attached (CLAUDE.md §14).
 */
export function renderPlaceholderDeclaration(figures: TvaDeclarationFigures): string {
  const lines = [
    "BROUILLON — NON OFFICIEL",
    "Ce fichier n'est pas au format DGI/SIMPL — ce format est TODO(legal), voir docs/legal-inputs.md L-22.",
    "",
    `Adaptateur : ${ADAPTER_VERSION}`,
    `Contribuable : ${figures.tenantName}`,
    `Période : ${formatDate(figures.periodStart)} au ${formatDate(figures.periodEnd)}`,
    `Régime : ${figures.regime === null ? "non défini" : figures.regime}`,
    "",
    `TVA collectée : ${figures.totalCollectee.toFixed(2)} MAD`,
    `TVA déductible : ${figures.totalDeductible.toFixed(2)} MAD`,
    `TVA due (ou crédit si négatif) : ${figures.totalDue.toFixed(2)} MAD`,
  ];
  return lines.join("\n");
}
