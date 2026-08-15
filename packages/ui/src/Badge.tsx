import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "ai" | "pos" | "neg" | "warn";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-2 text-fg-2",
  ai: "border-ai-border bg-ai-bg text-ai",
  pos: "border-pos/30 bg-pos-bg text-pos",
  neg: "border-neg/30 bg-neg-bg text-neg",
  warn: "border-warn/30 bg-warn-bg text-warn",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
