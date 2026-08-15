import type { ReactNode } from "react";

/** Chrome around a data table — header row with title + meta, and the card border/shadow
 * every screen's tables share. The actual <table> markup stays with the caller so it can
 * pick the right semantics (caption, scope) for its own data, per CLAUDE.md §10. */
export function DataTableShell({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <h2 className="m-0 text-[13.5px] font-semibold text-fg">{title}</h2>
        {meta !== undefined && <div className="font-mono text-[11px] text-fg-3">{meta}</div>}
      </div>
      {children}
    </section>
  );
}
