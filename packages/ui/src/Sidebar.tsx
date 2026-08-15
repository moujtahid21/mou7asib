"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Icon, ICON_PATHS } from "./icons";
import type { NavItem, OrgMembership } from "./types";

export interface SidebarProps {
  orgName: string;
  memberships: readonly OrgMembership[];
  currentTenantId: string | null;
  onSwitchTenant: (tenantId: string) => void;
  nav: readonly NavItem[];
  open: boolean;
  onToggle: () => void;
  onToggleTheme: () => void;
  themeLabel: string;
  collapseLabel: string;
  localeLabel: string;
  onToggleLocale: () => void;
  logoutLabel: string;
  onLogout: () => void;
  /** Below the lg breakpoint the sidebar is an off-canvas drawer instead of an
   * always-visible column — see AppShell's mobileNavOpen comment. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  orgName,
  memberships,
  currentTenantId,
  onSwitchTenant,
  nav,
  open,
  onToggle,
  onToggleTheme,
  themeLabel,
  collapseLabel,
  localeLabel,
  onToggleLocale,
  logoutLabel,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const canSwitchOrg = memberships.length > 1;

  return (
    <aside
      className={`fixed inset-y-0 start-0 z-40 flex flex-col border-inline-end border-border bg-surface transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] lg:duration-150 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
      }`}
      style={{ width: open ? "234px" : "64px" }}
    >
      <div className="relative flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-fg text-[14px] font-bold tracking-tight text-bg">
          m7
        </div>
        {open &&
          (canSwitchOrg ? (
            <button
              type="button"
              onClick={() => setOrgMenuOpen((wasOpen) => !wasOpen)}
              aria-expanded={orgMenuOpen}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-start text-[13px] font-semibold leading-tight text-fg"
            >
              <span className="min-w-0 flex-1 truncate">{orgName}</span>
              <Icon path={ICON_PATHS.chevronUpDown} size={14} className="flex-none text-fg-3" />
            </button>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-fg">
              {orgName}
            </span>
          ))}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fermer le menu"
          className="ms-auto grid size-7 flex-none place-items-center text-fg-3 lg:hidden"
        >
          <Icon path={ICON_PATHS.close} size={18} />
        </button>

        {orgMenuOpen && canSwitchOrg && (
          <div className="absolute inset-inline-start-2 top-full z-10 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-card">
            {memberships.map((membership) => (
              <button
                key={membership.tenantId}
                type="button"
                onClick={() => {
                  setOrgMenuOpen(false);
                  onSwitchTenant(membership.tenantId);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-[12.5px] ${
                  membership.tenantId === currentTenantId ? "bg-surface-2 font-semibold text-fg" : "text-fg-2 hover:bg-surface-2"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{membership.tenantName}</span>
                <span className="flex-none font-mono text-[10.5px] text-fg-3">{membership.roleLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {nav.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.id}
              // NavItem.href is data-driven (apps/web/lib/nav.ts), not a link literal
              // next's typedRoutes plugin can verify statically — see next.config.ts.
              href={item.href as Route}
              title={item.label}
              onClick={onCloseMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${
                active ? "bg-surface-2 font-semibold text-fg" : "font-normal text-fg-2 hover:bg-surface-2"
              }`}
            >
              <span className="flex size-5 flex-none items-center justify-center">
                <Icon path={item.iconPath} size={20} />
              </span>
              {open && <span className="min-w-0 flex-1 truncate text-start">{item.label}</span>}
              {open && item.badge !== undefined && (
                <span className="flex-none rounded-full border border-ai-border bg-ai-bg px-1.5 py-px text-center font-mono text-[10.5px] font-semibold text-ai">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <button
          type="button"
          onClick={onToggleLocale}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] text-fg-2 hover:bg-surface-2"
        >
          <Icon path={ICON_PATHS.globe} size={20} className="flex-none" />
          {open && <span>{localeLabel}</span>}
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] text-fg-2 hover:bg-surface-2"
        >
          <Icon path={ICON_PATHS.themeSun} size={20} className="flex-none" />
          {open && <span>{themeLabel}</span>}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] text-fg-2 hover:bg-surface-2"
        >
          <Icon path={ICON_PATHS.collapseMenu} size={20} className="flex-none" />
          {open && <span>{collapseLabel}</span>}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] text-fg-2 hover:bg-surface-2"
        >
          <Icon path={ICON_PATHS.logout} size={20} className="flex-none" />
          {open && <span>{logoutLabel}</span>}
        </button>
      </div>
    </aside>
  );
}
