import type { AccountantAccessScope, Role } from "@mou7asib/db";

// CLAUDE.md §8.1 — the AccountantAccess grant's scope and expiry are the *only* things
// that turn a row in this table into working access; auth.ts's getSession/switchTenant
// call this on every lookup rather than trusting a cached role. Pure and date-injected
// (no `Date.now()`) so expiry/revocation are unit-testable without a live clock or DB —
// same discipline as packages/accounting's effective-dated resolvers.
//
// Scope maps onto the existing five-role policy matrix rather than inventing a sixth:
// read_write behaves exactly like an internal accountant (ledger:write, tva:declare, …),
// read_only is deliberately mapped to the existing `readonly` role rather than a new one,
// so nothing in policy.ts needs to special-case a grant-derived session.
export function resolveGrantedRole(
  grant: { scope: AccountantAccessScope; expiresAt: Date; revokedAt: Date | null },
  now: Date,
): Role | null {
  if (grant.revokedAt !== null) {
    return null;
  }
  // Inclusive end, matching the effective-dated convention used for TVA rates/RAS
  // rules/IS brackets elsewhere in this codebase (`effectiveFrom <= date <= effectiveTo`).
  if (now > grant.expiresAt) {
    return null;
  }
  return grant.scope === "read_write" ? "accountant_external" : "readonly";
}
