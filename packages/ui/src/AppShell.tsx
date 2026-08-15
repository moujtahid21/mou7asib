"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CopilotPanel } from "./CopilotPanel";
import { CommandPalette } from "./CommandPalette";
import { ToastProvider } from "./Toast";
import type { NavItem, OrgMembership, ShellStrings } from "./types";

export interface AppShellProps {
  orgName: string;
  nav: readonly NavItem[];
  memberships?: readonly OrgMembership[];
  currentTenantId?: string | null;
  onSwitchTenant?: (tenantId: string) => void;
  locale?: "fr" | "ar";
  onToggleLocale?: () => void;
  onLogout?: () => void;
  strings?: ShellStrings;
  /** Routes that render without the shell chrome — auth pages (login/signup), which have
   * no tenant/nav context to show yet. Prefix match, e.g. "/signup" also matches
   * "/signup/mfa". */
  chromelessPrefixes?: readonly string[];
  children: ReactNode;
}

const DEFAULT_STRINGS: ShellStrings = {
  themeToDark: "Thème sombre",
  themeToLight: "Thème clair",
  collapseMenu: "Réduire le menu",
  switchToArabic: "العربية",
  switchToFrench: "Français",
  logout: "Se déconnecter",
};

type Theme = "light" | "dark";

const THEME_ATTR = "data-m7-theme";
const THEME_STORAGE_KEY = "m7-theme";

export function AppShell({
  orgName,
  nav,
  memberships = [],
  currentTenantId = null,
  onSwitchTenant = () => {},
  locale = "fr",
  onToggleLocale = () => {},
  onLogout = () => {},
  strings = DEFAULT_STRINGS,
  chromelessPrefixes = [],
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const isChromeless = chromelessPrefixes.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );
  const activeItem = nav.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`));
  // The blocking init script in the root layout already set the attribute before paint
  // (avoids a flash of the wrong theme) — this just mirrors it into React state so the
  // toggle button and Sidebar's label stay in sync.
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Separate from sidebarOpen (which toggles the desktop icon-rail collapse): below the
  // lg breakpoint the sidebar is an off-canvas drawer, closed by default, so it doesn't
  // permanently eat the viewport on a phone (CLAUDE.md §10 — must work at 320px).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute(THEME_ATTR);
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((wasOpen) => !wasOpen);
      } else if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleTheme(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute(THEME_ATTR, next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
  }

  if (isChromeless) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="flex h-dvh min-w-0 overflow-hidden bg-bg">
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          />
        )}
        <Sidebar
          orgName={orgName}
          memberships={memberships}
          currentTenantId={currentTenantId}
          onSwitchTenant={onSwitchTenant}
          nav={nav}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((wasOpen) => !wasOpen)}
          onToggleTheme={toggleTheme}
          themeLabel={theme === "dark" ? strings.themeToLight : strings.themeToDark}
          collapseLabel={strings.collapseMenu}
          localeLabel={locale === "fr" ? strings.switchToArabic : strings.switchToFrench}
          onToggleLocale={onToggleLocale}
          logoutLabel={strings.logout}
          onLogout={onLogout}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            title={activeItem?.label ?? "mou7asib"}
            subtitle={activeItem?.subtitle}
            onOpenPalette={() => setPaletteOpen(true)}
            onToggleCopilot={() => setCopilotOpen((wasOpen) => !wasOpen)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            copilotOpen={copilotOpen}
          />
          <main className="flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-5">{children}</main>
        </div>

        {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </ToastProvider>
  );
}
