import { confirmBankMatch } from "@/app/actions/confirmBankMatch";

export interface UnmatchedRow {
  transactionId: string;
  date: string;
  label: string;
  amount: string;
  isIncoming: boolean;
  suggestion: {
    lineId: string;
    entryLabel: string;
    entryDate: string;
    dateDiffDays: number;
  } | null;
}

// Three-part row (bank line / link / proposed ledger line), same spirit as the mockup's
// rapprochement screen — but every suggestion here comes from lib/bankMatching.ts's exact
// amount + closest-date ranking over this tenant's own posted lines, not a fabricated
// confidence percentage. Confirming never edits or creates a JournalLine (ADR 0003 point
// 4) — it only records the pairing.
export default function MatchList({ rows, canConfirm }: { rows: UnmatchedRow[]; canConfirm: boolean }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-fg-2 shadow-card">
        Aucune transaction en attente de lettrage.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-3.5 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">
          Transactions à lettrer <span className="font-mono text-[11px] font-normal text-fg-3">({rows.length})</span>
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const boundConfirm =
            row.suggestion !== null ? confirmBankMatch.bind(null, row.transactionId, row.suggestion.lineId) : null;
          return (
            <li key={row.transactionId} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-fg-3">{row.date}</span>
                  <span className="truncate text-[12.5px] font-medium text-fg">{row.label}</span>
                </div>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${row.isIncoming ? "text-pos" : "text-fg"}`}
                >
                  {row.amount}
                </span>
              </div>

              {row.suggestion === null ? (
                <span className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-fg-3">
                  Aucune correspondance
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-lg border border-ai-border bg-ai-bg px-2.5 py-1.5 text-[11.5px] text-fg-2">
                    <span className="font-semibold text-ai">Proposé —</span> {row.suggestion.entryLabel} (
                    {row.suggestion.entryDate}, écart {Math.round(row.suggestion.dateDiffDays)} j)
                  </div>
                  {canConfirm && boundConfirm !== null && (
                    <form action={boundConfirm}>
                      <button
                        type="submit"
                        className="rounded-lg bg-fg px-3 py-1.5 text-[11.5px] font-semibold text-bg"
                      >
                        Valider
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
