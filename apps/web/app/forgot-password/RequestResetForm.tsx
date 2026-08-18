"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type RequestPasswordResetState } from "@/app/actions/requestPasswordReset";

const initialState: RequestPasswordResetState = null;

export default function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-fg">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm"
        />
      </div>

      {state?.message !== undefined && (
        <p role="status" className="rounded-lg border border-border bg-surface-2 p-3 text-sm text-fg-2">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg disabled:opacity-60"
      >
        {isPending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
      </button>

      <p className="text-center text-sm text-fg-2">
        <Link href="/login" className="font-medium text-ai">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
