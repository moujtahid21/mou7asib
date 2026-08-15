export interface DrillableLine {
  accountCode: string;
  accountLabel: string;
  amount: string;
  entries: { entryId: string; date: string; label: string; amount: string }[];
}

export interface BilanData {
  actif: DrillableLine[];
  passif: DrillableLine[];
  totalActif: string;
  totalPassif: string;
  resultatNet: string;
  asOf: string;
}

export interface CpcData {
  produits: DrillableLine[];
  charges: DrillableLine[];
  totalProduits: string;
  totalCharges: string;
  resultatNet: string;
  periodStart: string;
  periodEnd: string;
}

function LineTable({ lines, tone }: { lines: DrillableLine[]; tone: "pos" | "neg" | "fg" }) {
  if (lines.length === 0) {
    return <p className="p-3 text-[12px] text-fg-3">Aucune écriture.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {lines.map((line) => (
          <tr key={line.accountCode} className="border-b border-border align-top">
            <td className="w-2/3 p-1.5">
              <details>
                <summary className="cursor-pointer text-[12.5px] text-fg">
                  <span className="font-mono text-fg-3">{line.accountCode}</span> {line.accountLabel}
                </summary>
                <ul className="mt-1 ms-4 space-y-0.5 text-[11px] text-fg-3">
                  {line.entries.map((e) => (
                    <li key={e.entryId} className="font-mono">
                      {e.date} — {e.label} : {e.amount}
                    </li>
                  ))}
                </ul>
              </details>
            </td>
            <td
              className={`p-1.5 text-end font-mono text-sm tabular-nums ${
                tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-fg"
              }`}
            >
              {line.amount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Every line is drillable (native <details>, no client JS needed) down to the journal
// entries composing it — CLAUDE.md §5.2's requirement. **Not the official CGNC
// structure** (docs/legal-inputs.md L-63 is still TODO(legal)) — a simplified class-level
// rollup instead, labelled as such everywhere it's shown (CLAUDE.md §14).
export default function EtatsSynthesePanel({ bilan, cpc }: { bilan: BilanData; cpc: CpcData }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-3.5 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">États de synthèse — non officiel</h2>
        <p className="mt-1 text-[11.5px] text-fg-2">
          Regroupement simplifié par classe CGNC (1-7), pas la structure officielle par rubrique — voir
          CLAUDE.md §5.2 et docs/legal-inputs.md L-62/L-63, toujours TODO(legal). Chaque ligne se déplie sur
          les écritures qui la composent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
        <div className="border-b border-border p-3.5 lg:border-e lg:border-b-0">
          <form method="get" className="mb-2 flex items-center gap-2 text-xs text-fg-2">
            <label htmlFor="asOf">Bilan au</label>
            <input
              id="asOf"
              type="date"
              name="asOf"
              defaultValue={bilan.asOf}
              className="rounded border border-border-2 px-1.5 py-1 text-xs"
            />
            <input type="hidden" name="periodStart" value={cpc.periodStart} />
            <input type="hidden" name="periodEnd" value={cpc.periodEnd} />
            <button type="submit" className="rounded border border-border-2 px-2 py-1 text-xs font-medium text-fg">
              Appliquer
            </button>
          </form>
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-2">Actif</h3>
          <LineTable lines={bilan.actif} tone="fg" />
          <div className="flex justify-between p-1.5 text-sm font-semibold text-fg">
            <span>Total actif</span>
            <span className="font-mono tabular-nums">{bilan.totalActif}</span>
          </div>
          <h3 className="m-0 mt-3 text-xs font-semibold uppercase tracking-wide text-fg-2">Passif</h3>
          <LineTable lines={bilan.passif} tone="fg" />
          <div className="flex justify-between p-1.5 text-sm font-semibold text-fg">
            <span>Total passif</span>
            <span className="font-mono tabular-nums">{bilan.totalPassif}</span>
          </div>
        </div>

        <div className="p-3.5">
          <form method="get" className="mb-2 flex flex-wrap items-center gap-2 text-xs text-fg-2">
            <label htmlFor="periodStart">CPC du</label>
            <input
              id="periodStart"
              type="date"
              name="periodStart"
              defaultValue={cpc.periodStart}
              className="rounded border border-border-2 px-1.5 py-1 text-xs"
            />
            <label htmlFor="periodEnd">au</label>
            <input
              id="periodEnd"
              type="date"
              name="periodEnd"
              defaultValue={cpc.periodEnd}
              className="rounded border border-border-2 px-1.5 py-1 text-xs"
            />
            <input type="hidden" name="asOf" value={bilan.asOf} />
            <button type="submit" className="rounded border border-border-2 px-2 py-1 text-xs font-medium text-fg">
              Appliquer
            </button>
          </form>
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-2">Produits</h3>
          <LineTable lines={cpc.produits} tone="pos" />
          <div className="flex justify-between p-1.5 text-sm font-semibold text-fg">
            <span>Total produits</span>
            <span className="font-mono tabular-nums text-pos">{cpc.totalProduits}</span>
          </div>
          <h3 className="m-0 mt-3 text-xs font-semibold uppercase tracking-wide text-fg-2">Charges</h3>
          <LineTable lines={cpc.charges} tone="neg" />
          <div className="flex justify-between p-1.5 text-sm font-semibold text-fg">
            <span>Total charges</span>
            <span className="font-mono tabular-nums text-neg">{cpc.totalCharges}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border p-1.5 text-sm font-semibold text-fg">
            <span>Résultat net</span>
            <span className="font-mono tabular-nums">{cpc.resultatNet}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
