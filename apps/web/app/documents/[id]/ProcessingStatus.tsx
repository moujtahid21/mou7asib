"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Multi-minute total latency (500-600s+ measured on CPU-only hardware in
// D1) makes tighter polling pointless — this interval balances
// responsiveness against load with negligible cost either way.
const POLL_INTERVAL_MS = 6000;

const STATUS_MESSAGES_FR: Record<string, string> = {
  uploaded: "Document reçu…",
  queued: "En attente de traitement…",
  processing:
    "Extraction en cours… généralement plusieurs minutes sur cet appareil.",
};

interface StatusResponse {
  status: string;
}

// CLAUDE.md §13 — honest, specific status copy at each state, never a bare
// spinner and never faking a result.
export default function ProcessingStatus({
  documentId,
  initialStatus,
}: {
  documentId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const interval = setInterval(() => {
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
    return () => {
      clearInterval(interval);
    };
  }, [documentId, router]);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Traitement en cours</h1>
      <p className="mt-3 text-sm text-slate-600">
        {STATUS_MESSAGES_FR[status] ?? "Traitement en cours…"}
      </p>
      <div className="mt-6 h-1 w-full overflow-hidden rounded bg-slate-200">
        <div className="h-full w-1/3 animate-pulse bg-slate-900" />
      </div>
    </main>
  );
}
