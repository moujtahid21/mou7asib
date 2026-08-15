"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "@/app/actions/signup";

const initialState: SignupState = null;

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-fg">
          Raison sociale
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          required
          autoComplete="organization"
          className="mt-1.5 block w-full rounded-lg border border-border-2 px-3 py-2 text-sm"
        />
      </div>

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

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-fg">
          Mot de passe
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
        {isPending ? "Création…" : "Continuer"}
      </button>

      <p className="text-center text-sm text-fg-2">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-ai">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
