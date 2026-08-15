import type { Money } from "./money.ts";

// CLAUDE.md §5.4 — "generate... the attestation de retenue for the payee." The required
// content of a real attestation (docs/legal-inputs.md L-45) is TODO(legal), so this
// renders a plainly-labelled non-official summary, same posture as
// filings/simpl/placeholderAdapter.ts. Only callable with an already-resolved RAS
// computation (packages/accounting/src/ras.ts's evaluateRasWithholding with matched:
// true) — there is nothing honest to put in an attestation for a flagged, unresolved
// payment.

export const ATTESTATION_VERSION = "placeholder-v0";

export interface RasAttestationInput {
  tenantName: string;
  payeeName: string;
  paymentNature: string;
  paymentDate: Date;
  baseAmount: Money;
  rate: Money;
  rasAmount: Money;
  netPayable: Money;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function renderPlaceholderAttestation(input: RasAttestationInput): string {
  const lines = [
    "ATTESTATION DE RETENUE À LA SOURCE — BROUILLON, NON OFFICIEL",
    "Contenu obligatoire réel non implémenté — voir docs/legal-inputs.md L-45 (TODO(legal)).",
    "",
    `Version : ${ATTESTATION_VERSION}`,
    `Émetteur : ${input.tenantName}`,
    `Bénéficiaire : ${input.payeeName}`,
    `Nature du paiement : ${input.paymentNature}`,
    `Date de paiement : ${formatDate(input.paymentDate)}`,
    "",
    `Base : ${input.baseAmount.toFixed(2)} MAD`,
    `Taux : ${input.rate.times(100).toFixed(2)} %`,
    `Retenue à la source : ${input.rasAmount.toFixed(2)} MAD`,
    `Net versé au bénéficiaire : ${input.netPayable.toFixed(2)} MAD`,
  ];
  return lines.join("\n");
}
