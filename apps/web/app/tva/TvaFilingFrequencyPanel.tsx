import { setTvaFilingFrequency } from "@/app/actions/setTvaFilingFrequency";

const FREQUENCY_LABELS: Record<"monthly" | "quarterly", string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
};

// CLAUDE.md §5.3 — real frequency derivation needs a turnover threshold (L-17, TODO(legal))
// this project doesn't have, so — same posture as TvaRegimePanel — never defaulted.
export default function TvaFilingFrequencyPanel({
  frequency,
  canManage,
}: {
  frequency: "monthly" | "quarterly" | null;
  canManage: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Périodicité de déclaration</h2>
        <span
          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${
            frequency === null ? "border-warn/30 bg-warn-bg text-warn" : "border-pos/30 bg-pos-bg text-pos"
          }`}
        >
          {frequency === null ? "Non définie" : FREQUENCY_LABELS[frequency]}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-fg-2">
        Le seuil de chiffre d&apos;affaires qui détermine la périodicité légale est
        TODO(legal) (L-17) — choix manuel en attendant.
      </p>
      {canManage && (
        <div className="mt-3 flex gap-2">
          <form action={setTvaFilingFrequency.bind(null, "monthly")}>
            <button
              type="submit"
              disabled={frequency === "monthly"}
              className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-50"
            >
              Mensuelle
            </button>
          </form>
          <form action={setTvaFilingFrequency.bind(null, "quarterly")}>
            <button
              type="submit"
              disabled={frequency === "quarterly"}
              className="rounded-lg border border-border-2 px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-50"
            >
              Trimestrielle
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
