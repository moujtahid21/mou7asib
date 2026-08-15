/**
 * Reads only the leading digit to determine the CGNC class (0-9, not 1-8 — CLAUDE.md
 * §5.1: classes 0 and 9 are hors bilan / comptabilité analytique, real classes, not an
 * oversight). This is a single-character read, not "parsing the account code into a
 * number" (CLAUDE.md §5.1 forbids treating the whole code, e.g. "3421", as an integer —
 * leading structure and zeros matter for the code as a whole, just not for this one digit).
 */
export function classDigitOf(accountCode: string): number {
  if (accountCode.length === 0) {
    throw new Error("invalid CGNC account code: empty string");
  }
  const digit = accountCode.charCodeAt(0) - "0".charCodeAt(0);
  if (digit < 0 || digit > 9) {
    throw new Error(`invalid CGNC account code: "${accountCode}" does not start with a digit`);
  }
  return digit;
}
