import { Icon, ICON_PATHS } from "./icons";

/**
 * Honest placeholder for a nav destination whose phase hasn't landed yet (ADR 0007: full
 * nav ships from phase 0, but a screen with no real data behind it must say so rather than
 * show fabricated numbers or disappear). Replaced by the real screen as its phase completes
 * — never itself extended with fixtures.
 */
export function UnderConstruction({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-xl border border-dashed border-border-2 bg-surface-3 p-7 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg-3">
        <Icon path={ICON_PATHS.construction} size={22} />
      </div>
      <p className="m-0 text-[13.5px] font-semibold text-fg">{title} — pas encore construit</p>
      <p className="mx-0 mb-0 mt-1.5 text-xs text-fg-2">{note}</p>
    </div>
  );
}
