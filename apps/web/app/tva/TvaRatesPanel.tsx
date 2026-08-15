export interface TvaRateRow {
  rateCode: string;
  label: string;
  ratePercent: string;
  effectiveFrom: string;
  isPlaceholder: boolean;
}

// Every row currently seeded is a placeholder (CLAUDE.md §14) — shown here, not hidden,
// per docs/legal-inputs.md L-01/L-02. This is read-only; editing rates is a Paramètres
// (phase 16) concern.
export default function TvaRatesPanel({ rates }: { rates: TvaRateRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-3.5 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Taux de TVA configurés</h2>
      </div>
      {rates.length === 0 ? (
        <p className="p-3.5 text-sm text-fg-2">Aucun taux configuré.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-fg-2">
              <th scope="col" className="p-2 text-start font-medium">Code</th>
              <th scope="col" className="p-2 text-start font-medium">Libellé</th>
              <th scope="col" className="p-2 text-end font-medium">Taux</th>
              <th scope="col" className="p-2 text-start font-medium">En vigueur depuis</th>
              <th scope="col" className="p-2 text-start font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.rateCode} className="border-b border-border">
                <td className="p-2 font-mono text-xs">{rate.rateCode}</td>
                <td className="p-2">{rate.label}</td>
                <td className="p-2 text-end font-mono tabular-nums">{rate.ratePercent}</td>
                <td className="p-2 font-mono text-xs text-fg-2">{rate.effectiveFrom}</td>
                <td className="p-2">
                  {rate.isPlaceholder && (
                    <span className="rounded-md border border-warn/30 bg-warn-bg px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-warn">
                      Non officiel
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
