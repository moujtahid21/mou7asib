// D2: one flat, documented placeholder threshold. CLAUDE.md §7.2 wants this
// configurable per field per tenant eventually — that needs tenant
// configuration to exist first (W2+). Not tuned against real accuracy data
// yet; revisit once D2 has been run against enough real documents to know.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
