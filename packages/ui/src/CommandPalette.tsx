"use client";

import { useState } from "react";
import { Icon, ICON_PATHS } from "./icons";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K shell. Search and command execution are real starting phase 15 (accounts, tiers,
 * documents, AI commands) — until then the palette opens and closes for real but lists no
 * results, rather than the mockup's invented commands. An empty result set is an honest
 * state; fabricated command entries would not be.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 pt-[14vh] backdrop-blur-[2px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-border-2 bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
          <Icon path={ICON_PATHS.search} size={18} className="text-fg-3" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Compte, tiers, facture, ou commande IA…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-border-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-3">
            esc
          </kbd>
        </div>
        <div className="max-h-[340px] overflow-y-auto p-6 text-center text-xs text-fg-3">
          {query.trim().length > 0
            ? `Aucun résultat pour « ${query.trim()} ».`
            : "Recherche et commandes disponibles à partir de la phase 15."}
        </div>
      </div>
    </div>
  );
}
