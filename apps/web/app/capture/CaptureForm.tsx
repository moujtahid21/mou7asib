"use client";

import { useActionState } from "react";
import { uploadDocument, type UploadState } from "@/app/actions/uploadDocument";

const initialState: UploadState = null;

export default function CaptureForm() {
  const [state, formAction, isPending] = useActionState(uploadDocument, initialState);

  return (
    <form action={formAction} className="mt-6">
      <label htmlFor="photo" className="block text-sm font-medium text-slate-900">
        Photo ou PDF de la facture
      </label>
      {/* No `capture` attribute: mobile browsers still offer "take photo" as
          one file-picker option, but this also allows choosing an existing
          file — needed for PDFs, which nobody photographs. */}
      <input
        id="photo"
        name="photo"
        type="file"
        accept="image/*,application/pdf"
        required
        className="mt-2 block w-full rounded border border-slate-300 p-2 text-sm"
      />

      {state?.error !== undefined && (
        <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Envoi en cours…" : "Envoyer"}
      </button>
    </form>
  );
}
