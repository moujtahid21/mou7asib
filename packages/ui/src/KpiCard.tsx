import type { ReactNode } from "react";

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "pos" | "neg" | "neutral";
  sub?: ReactNode;
  alert?: boolean;
}

const DELTA_CLASSES: Record<NonNullable<KpiCardProps["deltaTone"]>, string> = {
  pos: "text-pos",
  neg: "text-neg",
  neutral: "text-fg-3",
};

/** A single dashboard KPI tile — presentational only, every value is a prop. Introduced in
 * phase 0 so phase 6 (real dashboard aggregates) has a component to render into, not a
 * reason to hardcode numbers before then. */
export function KpiCard({ label, value, unit, delta, deltaTone = "neutral", sub, alert = false }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-fg-2">{label}</span>
        {delta !== undefined && (
          <span className={`font-mono text-[10.5px] ${DELTA_CLASSES[deltaTone]}`}>{delta}</span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</span>
        {unit !== undefined && <span className="font-mono text-[11.5px] text-fg-3">{unit}</span>}
      </div>
      {sub !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-[11.5px] ${alert ? "text-neg" : "text-fg-3"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
