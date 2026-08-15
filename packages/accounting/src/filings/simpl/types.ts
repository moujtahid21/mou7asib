import type { Money } from "../../money.ts";

// CLAUDE.md §5.3: "Treat the DGI format as a versioned adapter in
// packages/accounting/src/filings/simpl/ — never scatter format details through the
// codebase." This is that adapter boundary. docs/legal-inputs.md L-22 (the official DGI
// file spec — format, schema/XSD, encoding, version) is still TODO(legal) and is flagged
// as "the single largest unknown in the filing feature" — so there is currently exactly
// one adapter version, and it does not produce a file the DGI portal would accept. It
// exists so the figures → export → audit pipeline is real end to end, ready to be
// re-pointed at the real format the moment L-22 resolves, per CLAUDE.md §14.

export interface TvaDeclarationFigures {
  tenantName: string;
  periodStart: Date;
  periodEnd: Date;
  /** Null when the tenant hasn't picked one yet (CLAUDE.md §5.3 — never assumed). */
  regime: "encaissement" | "debit" | null;
  /** TVA facturée on sales within the period (account 4455 movements) — currently always
   * 0 for most tenants, since outgoing invoices (phase 9) aren't auto-posted to the ledger
   * yet; an honest reflection of what's actually in the ledger, not a gap hidden here. */
  totalCollectee: Money;
  /** TVA récupérable on purchases within the period (account 34552 movements). */
  totalDeductible: Money;
  /** Positive = amount due to the DGI; negative = crédit de TVA reporté. */
  totalDue: Money;
}
