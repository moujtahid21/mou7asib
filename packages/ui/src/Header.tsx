"use client";

import { Icon, ICON_PATHS } from "./icons";

export interface HeaderProps {
  title: string;
  subtitle?: string | undefined;
  onOpenPalette: () => void;
  onToggleCopilot: () => void;
  onOpenMobileNav: () => void;
  copilotOpen: boolean;
}

export function Header({
  title,
  subtitle,
  onOpenPalette,
  onToggleCopilot,
  onOpenMobileNav,
  copilotOpen,
}: HeaderProps) {
  return (
    <header className="flex flex-none items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:gap-3.5 sm:px-5">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Ouvrir le menu"
        className="grid size-8 flex-none place-items-center rounded-lg border border-border text-fg-2 lg:hidden"
      >
        <Icon path={ICON_PATHS.collapseMenu} size={18} />
      </button>
      <div className="min-w-0 flex-1 sm:flex-none">
        <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle !== undefined && (
          <p className="mt-0.5 hidden truncate text-[11.5px] text-fg-3 sm:block">{subtitle}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Rechercher ou commander"
        className="ms-auto flex size-8 flex-none items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-3 sm:w-[280px] sm:justify-start sm:gap-2 sm:px-2.5 sm:py-1.5"
      >
        <Icon path={ICON_PATHS.search} size={16} />
        <span className="hidden flex-1 text-start sm:inline">Rechercher ou commander…</span>
        <kbd className="hidden rounded border border-border-2 bg-surface px-1.5 py-px font-mono text-[10.5px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onToggleCopilot}
        aria-pressed={copilotOpen}
        aria-label="Copilote"
        className="flex flex-none items-center gap-1.5 rounded-lg border border-ai-border bg-ai-bg px-2.5 py-1.5 text-[12.5px] font-semibold text-ai"
      >
        <Icon path={ICON_PATHS.sparkle} size={18} />
        <span className="hidden sm:inline">Copilote</span>
      </button>
    </header>
  );
}
