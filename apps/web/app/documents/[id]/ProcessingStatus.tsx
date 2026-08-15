"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Multi-minute total latency (500-600s+ measured on CPU-only hardware in
// D1) makes tighter polling pointless — this interval balances
// responsiveness against load with negligible cost either way.
const POLL_INTERVAL_MS = 6000;
// Separate, faster clock purely for the displayed elapsed-time text — no
// network call, just a re-render.
const CLOCK_TICK_MS = 5000;
// Past this many minutes in `processing`, add a reassurance line rather than
// leaving the user to wonder — well past D1's measured 500-600s worst case.
const REASSURANCE_THRESHOLD_MINUTES = 10;

const STEPS = ["uploaded", "queued", "processing", "done"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS_FR: Record<Step, string> = {
  uploaded: "Reçu",
  queued: "En attente",
  processing: "Extraction",
  done: "Terminé",
};

interface StatusResponse {
  status: string;
}

function stepForStatus(status: string): Step {
  if (status === "extracted" || status === "failed") return "done";
  if (status === "processing") return "processing";
  if (status === "queued") return "queued";
  return "uploaded";
}

function formatElapsed(uploadedAt: string, now: number): string {
  const minutes = Math.floor((now - new Date(uploadedAt).getTime()) / 60000);
  if (minutes < 1) return "depuis moins d'une minute";
  if (minutes === 1) return "depuis 1 min";
  return `depuis ${minutes} min`;
}

// CLAUDE.md §13 — honest, specific status copy at each state, never a fake
// percentage and never faking a result. A discrete stepper over the real
// known states, not a continuous progress bar that implies a percentage
// nobody can actually compute — the previous static `animate-pulse` bar
// made a genuinely-stuck-forever `queued` state and normal in-progress look
// identical, which caused real confusion in testing. Elapsed time (not a
// fake percentage) is the actual signal that distinguishes them.
export default function ProcessingStatus({
  documentId,
  initialStatus,
  uploadedAt,
}: {
  documentId: string;
  initialStatus: string;
  uploadedAt: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetch(`/api/documents/${documentId}/status`)
        .then((response) => response.json() as Promise<StatusResponse>)
        .then((data) => {
          setStatus(data.status);
          if (data.status === "extracted" || data.status === "failed") {
            router.refresh();
          }
        })
        .catch(() => {
          // Transient poll failure — retry next interval, no need to alarm
          // the user over a single missed poll.
        });
    }, POLL_INTERVAL_MS);
    const clockInterval = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, [documentId, router]);

  const currentStep = stepForStatus(status);
  const currentStepIndex = STEPS.indexOf(currentStep);
  const elapsedMinutes = Math.floor((now - new Date(uploadedAt).getTime()) / 60000);

  return (
    <main className="mx-auto max-w-md rounded-xl border border-border bg-surface p-6 shadow-card">
      <h1 className="m-0 text-xl font-semibold text-fg">Traitement en cours</h1>

      <ol className="mt-6 flex items-center gap-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                index < currentStepIndex
                  ? "bg-fg text-bg"
                  : index === currentStepIndex
                    ? "border-2 border-fg text-fg"
                    : "border border-border-2 text-fg-3"
              }`}
            >
              {index < currentStepIndex ? "✓" : index + 1}
            </span>
            <span className={`text-xs ${index <= currentStepIndex ? "text-fg" : "text-fg-3"}`}>
              {STEP_LABELS_FR[step]}
            </span>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm text-fg-2">
        {currentStep === "queued" && `En attente de traitement ${formatElapsed(uploadedAt, now)}.`}
        {currentStep === "processing" &&
          `Extraction en cours ${formatElapsed(uploadedAt, now)} — généralement plusieurs minutes sur cet appareil.`}
        {currentStep === "uploaded" && "Document reçu…"}
      </p>

      {currentStep === "processing" && elapsedMinutes >= REASSURANCE_THRESHOLD_MINUTES && (
        <p className="mt-2 text-xs text-fg-3">
          Toujours en cours après {elapsedMinutes} min — c&apos;est normal sur cet appareil pour
          une extraction par photo/scan. Pas besoin de relancer.
        </p>
      )}
    </main>
  );
}
