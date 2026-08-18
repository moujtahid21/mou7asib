"use client";

import { useActionState } from "react";
import { resetPassword, type ResetPasswordState } from "@/app/actions/resetPassword";

const initialState: ResetPasswordState = null;

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-fg-3">Au moins 10 caractères.</p>
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
        {isPending ? "Enregistrement…" : "Réinitialiser le mot de passe"}
      </button>
    </form>
  );
}
