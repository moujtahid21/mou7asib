import type { Role } from "@mou7asib/db";
import type { Locale } from "@/lib/locale";

// CLAUDE.md §8.2 — permissions checked against an explicit policy module, never scattered
// `if (role === 'owner')` checks at call sites. Grows with each phase (settings:manage
// today has one real caller pending — phase 16 — but the action exists so the matrix
// documents intent even where nothing enforces it yet).
export type Action =
  | "document:read"
  | "document:write"
  | "settings:manage"
  | "ledger:read"
  | "ledger:write"
  | "period:manage"
  | "bank:reconcile"
  | "invoice:read"
  | "invoice:write"
  | "tva:declare"
  | "ras:evaluate"
  | "is:manage"
  | "accountant:manage";

// tva:declare is deliberately narrower than ledger:write — a filing export is a
// higher-trust, audit-logged action (CLAUDE.md §8.2's "sensitive actions" list names
// "filing export" explicitly) than posting a routine entry, so a plain employee can book
// invoices but not file a declaration.
//
// accountant:manage (granting/revoking an AccountantAccess grant — CLAUDE.md §8.1) is
// owner-only, deliberately narrower even than settings:manage's holders: an accountant
// who is themselves granted access into this tenant must never be able to grant a third
// party further access into it.
const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  owner: [
    "document:read",
    "document:write",
    "settings:manage",
    "ledger:read",
    "ledger:write",
    "period:manage",
    "bank:reconcile",
    "invoice:read",
    "invoice:write",
    "tva:declare",
    "ras:evaluate",
    "is:manage",
    "accountant:manage",
  ],
  accountant_internal: [
    "document:read",
    "document:write",
    "ledger:read",
    "ledger:write",
    "bank:reconcile",
    "invoice:read",
    "invoice:write",
    "tva:declare",
    "ras:evaluate",
    "is:manage",
  ],
  accountant_external: [
    "document:read",
    "document:write",
    "ledger:read",
    "ledger:write",
    "bank:reconcile",
    "invoice:read",
    "invoice:write",
    "tva:declare",
    "ras:evaluate",
    "is:manage",
  ],
  employee: [
    "document:read",
    "document:write",
    "ledger:read",
    "ledger:write",
    "bank:reconcile",
    "invoice:read",
    "invoice:write",
  ],
  readonly: ["document:read", "ledger:read", "invoice:read"],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

const ROLE_LABELS: Record<Role, Record<Locale, string>> = {
  owner: { fr: "propriétaire", ar: "مالك" },
  accountant_internal: { fr: "comptable interne", ar: "محاسب داخلي" },
  accountant_external: { fr: "comptable externe", ar: "محاسب خارجي" },
  employee: { fr: "employé", ar: "موظف" },
  readonly: { fr: "lecture seule", ar: "قراءة فقط" },
};

export function roleLabel(role: Role, locale: Locale): string {
  return ROLE_LABELS[role][locale];
}
