import { setTvaRegime } from "@/app/actions/setTvaRegime";

const REGIME_LABELS: Record<"encaissement" | "debit", string> = {
  encaissement: "Encaissement",
  debit: "Débit",
};

// CLAUDE.md §5.3 — this setting is never defaulted; it stays null (shown here as
// "non défini") until the owner picks explicitly. What the regime actually changes
// (when TVA becomes due for the declaration) arrives with phase 11's declaration engine —
// this phase only stores the choice and surfaces it, see build-order.md's S7 scope note.
export default function TvaRegimePanel({
  regime,
  canManage,
}: {
  regime: "encaissement" | "debit" | null;
  canManage: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Régime de TVA</h2>
        <span
          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${
            regime === null ? "border-warn/30 bg-warn-bg text-warn" : "border-pos/30 bg-pos-bg text-pos"
          }`}
        >
          {regime === null ? "Non défini" : REGIME_LABELS[regime]}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-fg-2">
        Détermine quand la TVA devient exigible (facture vs encaissement) — obligatoire avant
        la déclaration TVA (phase 11). Ne jamais présumer le régime débit (CLAUDE.md §5.3).
      </p>
      {canManage && (
        <div className="mt-3 flex gap-2">
          <form action={setTvaRegime.bind(null, "encaissement")}>
            <button
              type="submit"
              disabled={regime === "encaissement"}
              className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-50"
            >
              Encaissement
            </button>
          </form>
          <form action={setTvaRegime.bind(null, "debit")}>
            <button
              type="submit"
              disabled={regime === "debit"}
              className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-50"
            >
              Débit
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
