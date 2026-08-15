import { setPeriodStatus } from "@/app/actions/setPeriodStatus";

interface Period {
  id: string;
  startDate: Date;
  endDate: Date;
  status: "open" | "locked";
}

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

// Periods are auto-created (auto-vivified) the first time an entry posts into them —
// see lib/ledger.ts's findOrCreatePeriod — so an empty list here just means nothing has
// been posted yet, not a missing setup step.
export default function PeriodsPanel({ periods, canManage }: { periods: Period[]; canManage: boolean }) {
  if (periods.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">Périodes</h2>
      </div>
      <ul className="divide-y divide-border">
        {periods.map((period) => {
          const nextStatus = period.status === "open" ? "locked" : "open";
          const boundToggle = setPeriodStatus.bind(null, period.id, nextStatus);
          return (
            <li key={period.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="font-mono text-fg-2">
                {dateFormatter.format(period.startDate)} – {dateFormatter.format(period.endDate)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                  period.status === "locked"
                    ? "border-neg/30 bg-neg-bg text-neg"
                    : "border-pos/30 bg-pos-bg text-pos"
                }`}
              >
                {period.status === "locked" ? "Verrouillée" : "Ouverte"}
              </span>
              {canManage && (
                <form action={boundToggle} className="ms-auto">
                  <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-fg">
                    {period.status === "open" ? "Verrouiller" : "Déverrouiller"}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
