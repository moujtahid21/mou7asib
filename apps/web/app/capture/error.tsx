"use client";

import { useEffect } from "react";

// CLAUDE.md §13 — system errors show a correlation reference, not a raw
// stack trace; details are logged, not displayed.
export default function CaptureError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-slate-600">
        L&apos;envoi de la photo a échoué de façon inattendue.
        {error.digest !== undefined && (
          <span className="mt-1 block text-xs text-slate-400">
            Référence : {error.digest}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded border border-slate-300 px-4 py-2 text-sm font-medium"
      >
        Réessayer
      </button>
    </main>
  );
}
