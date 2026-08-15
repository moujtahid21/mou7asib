import { exportTvaDeclaration } from "@/app/actions/exportTvaDeclaration";
import type { DrillableLine } from "./EtatsSynthesePanel";

export interface DeclarationHistoryRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalDue: string;
  exportedAt: string;
}

interface TvaDeclarationPanelProps {
  periodStart: string;
  periodEnd: string;
  collectee: DrillableLine;
  deductible: DrillableLine;
  totalDue: string;
  canDeclare: boolean;
  exportedText: string | null;
  history: DeclarationHistoryRow[];
}

function AccountBlock({ line, tone }: { line: DrillableLine; tone: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-border-2 p-2.5">
      <details>
        <summary className="cursor-pointer text-[12.5px] text-fg">
          <span className="font-mono text-fg-3">{line.accountCode}</span> {line.accountLabel}
        </summary>
        {line.entries.length === 0 ? (
          <p className="mt-1 ms-4 text-[11px] text-fg-3">Aucune écriture sur la période.</p>
        ) : (
          <ul className="mt-1 ms-4 space-y-0.5 text-[11px] text-fg-3">
            {line.entries.map((e) => (
              <li key={e.entryId} className="font-mono">
                {e.date} — {e.label} : {e.amount}
              </li>
            ))}
          </ul>
        )}
      </details>
      <div className={`mt-1 text-end font-mono text-sm font-semibold tabular-nums ${tone === "pos" ? "text-pos" : "text-neg"}`}>
        {line.amount} MAD
      </div>
    </div>
  );
}

// CLAUDE.md §5.3 — figures shown before export, every one traceable, and the export
// itself logged. The "SIMPL export" produced here is deliberately not a DGI-format file —
// see packages/accounting/src/filings/simpl's comment; L-22 (the real format) is
// TODO(legal), the single largest unknown in this feature per build-order.md.
export default function TvaDeclarationPanel({
  periodStart,
  periodEnd,
  collectee,
  deductible,
  totalDue,
  canDeclare,
  exportedText,
  history,
}: TvaDeclarationPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 className="m-0 text-[13.5px] font-semibold text-fg">Déclaration TVA — non officielle</h2>
      <p className="mt-1 text-[11.5px] text-fg-2">
        Aucun format DGI/SIMPL réel (L-22 TODO(legal)) — export texte lisible uniquement, à
        imprimer en PDF depuis le navigateur si besoin. Chaque montant est traçable aux
        écritures qui le composent.
      </p>

      <form method="get" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-2">
        <label htmlFor="declPeriodStart">Période du</label>
        <input
          id="declPeriodStart"
          type="date"
          name="periodStart"
          defaultValue={periodStart}
          className="rounded border border-border-2 px-1.5 py-1 text-xs"
        />
        <label htmlFor="declPeriodEnd">au</label>
        <input
          id="declPeriodEnd"
          type="date"
          name="periodEnd"
          defaultValue={periodEnd}
          className="rounded border border-border-2 px-1.5 py-1 text-xs"
        />
        <input type="hidden" name="asOf" value={periodEnd} />
        <button type="submit" className="rounded border border-border-2 px-2 py-1 text-xs font-medium text-fg">
          Appliquer
        </button>
      </form>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <AccountBlock line={collectee} tone="pos" />
        <AccountBlock line={deductible} tone="neg" />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-surface-3 p-2.5 text-sm font-semibold text-fg">
        <span>TVA due (crédit reporté si négatif)</span>
        <span className="font-mono tabular-nums">{totalDue} MAD</span>
      </div>

      {canDeclare && (
        <form action={exportTvaDeclaration} className="mt-3">
          <input type="hidden" name="periodStart" value={periodStart} />
          <input type="hidden" name="periodEnd" value={periodEnd} />
          <button type="submit" className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg">
            Exporter (brouillon)
          </button>
        </form>
      )}

      {exportedText !== null && (
        <div className="mt-3">
          <p className="text-[11.5px] font-semibold text-pos">Export enregistré — voir l&apos;historique ci-dessous.</p>
          <pre className="mt-1 overflow-x-auto rounded-lg border border-border-2 bg-surface-2 p-3 text-[11px] text-fg">
            {exportedText}
          </pre>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-2">Historique des exports</h3>
          <ul className="mt-2 divide-y divide-border text-[11.5px] text-fg-2">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-mono">
                  {row.periodStart} → {row.periodEnd}
                </span>
                <span className="font-mono">{row.totalDue} MAD</span>
                <span className="font-mono text-fg-3">{row.exportedAt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
