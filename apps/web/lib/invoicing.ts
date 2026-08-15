// Fixed row count for the manual line-entry form (app/facturation/InvoiceForm.tsx) — same
// simplest-possible-shape convention as MAX_ENTRY_LINES (lib/ledger.ts).
export const MAX_INVOICE_LINES = 8;

/** Draft invoices don't have a series yet; this is the placeholder policy for which series
 * a normal invoice vs an avoir gets once finalized. L-51 (whether avoirs share the
 * invoice's own sequence) is still TODO(legal) — a separate "AV" series sidesteps
 * asserting an unverified answer either way. */
export const INVOICE_SERIES_CODE = "FA";
export const AVOIR_SERIES_CODE = "AV";
