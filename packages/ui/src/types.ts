export interface OrgMembership {
  tenantId: string;
  tenantName: string;
  /** Display label for the role, already translated by the caller — packages/ui doesn't
   * own the Role enum or its i18n. */
  roleLabel: string;
}

/**
 * Translated sidebar chrome strings (CLAUDE.md §10 i18n) — the caller (apps/web) owns the
 * FR/AR dictionary and passes the resolved strings in, so packages/ui stays decoupled
 * from any particular locale/dictionary implementation. This is the phase-1 scaffold's
 * boundary: only the primary nav chrome is threaded this way so far, not every string in
 * every component (Header's search placeholder, the command palette, the copilot panel
 * still read French literals) — see apps/web/lib/locale.ts's scope note.
 */
export interface ShellStrings {
  themeToDark: string;
  themeToLight: string;
  collapseMenu: string;
  switchToArabic: string;
  switchToFrench: string;
  logout: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Shown in the header under the page title when this item is active. */
  subtitle: string;
  /** SVG path `d` attribute — kept as data, not markup, per CLAUDE.md §7.3's spirit of not
   * concatenating untrusted content into structure. These are static, developer-authored. */
  iconPath: string;
  /** Set when this destination has real, live functionality behind it. Everything else
   * still links (ADR 0007: full nav from phase 0) but renders <UnderConstruction>. */
  isLive: boolean;
  badge?: string;
}
