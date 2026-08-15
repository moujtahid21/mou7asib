"use client";

import { useActionState } from "react";
import { confirmMfa, type ConfirmMfaState } from "@/app/actions/confirmMfa";

const initialState: ConfirmMfaState = null;

export default function ConfirmMfaForm() {
  const [state, formAction, isPending] = useActionState(confirmMfa, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-fg">
          Code à 6 chiffres
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          required
          autoComplete="one-time-code"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm font-mono tracking-widest"
        />
      </div>

      {state?.error !== undefined && (
        <p role="alert" className="rounded-lg border border-neg bg-neg-bg p-3 text-sm text-neg">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
      >
        {isPending ? "Vérification…" : "Confirmer et activer"}
      </button>
    </form>
  );
}
