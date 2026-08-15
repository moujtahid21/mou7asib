import type { Prisma } from "@mou7asib/db";
import { postJournalEntry } from "@/app/actions/postJournalEntry";
import { reverseJournalEntry } from "@/app/actions/reverseJournalEntry";

interface EntryLine {
  id: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  label: string | null;
  account: { code: string; label: string } | null;
}

interface Entry {
  id: string;
  date: Date;
  journalCode: string;
  label: string;
  status: "draft" | "posted";
  isReversal: boolean;
  reversedByEntryId: string | null;
  lines: EntryLine[];
}

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

function formatAmount(value: Prisma.Decimal): string {
  return value.isZero() ? "" : value.toFixed(2);
}

export default function EntryList({ entries, canWrite }: { entries: Entry[]; canWrite: boolean }) {
  if (entries.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-fg-2 shadow-card">
        Aucune écriture pour le moment.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Écritures</h2>
      </div>
      <ul className="divide-y divide-border">
        {entries.map((entry) => {
          const boundPost = postJournalEntry.bind(null, entry.id);
          const boundReverse = reverseJournalEntry.bind(null, entry.id);
          return (
            <li key={entry.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-fg-3">{dateFormatter.format(entry.date)}</span>
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-fg-2">
                  {entry.journalCode}
                </span>
                <span className="text-sm font-medium text-fg">{entry.label}</span>
                {entry.status === "draft" && (
                  <span className="rounded-full border border-warn/30 bg-warn-bg px-2 py-0.5 text-[10.5px] font-semibold text-warn">
                    Brouillon
                  </span>
                )}
                {entry.status === "posted" && (
                  <span className="rounded-full border border-pos/30 bg-pos-bg px-2 py-0.5 text-[10.5px] font-semibold text-pos">
                    Comptabilisée
                  </span>
                )}
                {entry.isReversal && (
                  <span className="rounded-full border border-ai-border bg-ai-bg px-2 py-0.5 text-[10.5px] font-semibold text-ai">
                    Extourne
                  </span>
                )}
                {entry.reversedByEntryId !== null && (
                  <span className="text-[10.5px] text-fg-3">extournée</span>
                )}

                <div className="ms-auto flex gap-2">
                  {canWrite && entry.status === "draft" && (
                    <form action={boundPost}>
                      <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-fg">
                        Comptabiliser
                      </button>
                    </form>
                  )}
                  {canWrite && entry.status === "posted" && entry.reversedByEntryId === null && (
                    <form action={boundReverse}>
                      <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-fg">
                        Extourner
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <table className="mt-2.5 w-full border-collapse text-xs">
                <caption className="sr-only">Lignes de l&apos;écriture {entry.label}</caption>
                <thead>
                  <tr className="text-fg-3">
                    <th scope="col" className="p-1 text-start font-medium">
                      Compte
                    </th>
                    <th scope="col" className="p-1 text-start font-medium">
                      Libellé
                    </th>
                    <th scope="col" className="p-1 text-end font-medium">
                      Débit
                    </th>
                    <th scope="col" className="p-1 text-end font-medium">
                      Crédit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="p-1 font-mono">{line.account?.code ?? "—"}</td>
                      <td className="p-1">{line.label ?? line.account?.label ?? ""}</td>
                      <td className="p-1 text-end font-mono tabular-nums">{formatAmount(line.debit)}</td>
                      <td className="p-1 text-end font-mono tabular-nums">{formatAmount(line.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
