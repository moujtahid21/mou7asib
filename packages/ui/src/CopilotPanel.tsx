"use client";

import { Icon, ICON_PATHS } from "./icons";

export function CopilotPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-surface lg:static lg:inset-auto lg:z-auto lg:w-[372px] lg:flex-none lg:border-inline-start lg:border-border">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
        <Icon path={ICON_PATHS.sparkle} size={18} className="text-ai" />
        <span className="flex-1 text-[13px] font-semibold text-fg">Copilote comptable</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le copilote"
          className="grid place-items-center p-0.5 text-fg-3"
        >
          <Icon path={ICON_PATHS.close} size={18} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="m-0 text-[12.5px] text-fg-2">
          Le copilote proposera des actions à partir des écritures réelles du locataire
          (retrieval sur son propre historique) — pas encore construit.
        </p>
        <p className="m-0 text-[11px] text-fg-3">Voir la feuille de route, phase 14.</p>
      </div>
    </aside>
  );
}
